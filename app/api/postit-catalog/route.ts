import { getDb } from '@/db';
import { requireEditor } from '@/lib/editor-auth';
import { ensureProjectInBoard, ensureProjectRecord, updateProjectStatus } from '@/lib/project-hub';

const defaultSectors = [
  'Manutenção',
  'Operação / MKT',
  'Suprimentos',
  'Financeiro',
  'DP / Gente & Gestão',
  'CDI',
  'Engenharia',
  'SMS',
];

async function ensureDefaults() {
  const db = getDb();
  // Registros antigos podem ter sido repetidos por sincronizações anteriores.
  // O catálogo não referencia ações pelo id, portanto manter a primeira cópia é seguro.
  await db.prepare(
    `DELETE FROM postit_board_catalog
     WHERE id IN (
       SELECT id FROM (
         SELECT id, ROW_NUMBER() OVER (
           PARTITION BY type, lower(trim(name)) ORDER BY created_at, id
         ) AS position
         FROM postit_board_catalog
       ) WHERE position > 1
     )`,
  ).run();
  const existing = await db
    .prepare('SELECT COUNT(*) AS total FROM postit_board_catalog')
    .first<{ total: number }>();
  if (existing?.total) {
    // Atualiza somente a antiga cor padrão escura; cores escolhidas manualmente são preservadas.
    await db.batch([
      db.prepare("UPDATE postit_board_catalog SET color = ? WHERE type = 'project' AND name = 'ECOPÓS' AND color = ?")
        .bind('#9bc6bb', '#4b5558'),
      db.prepare("UPDATE postit_board_catalog SET color = ? WHERE type = 'project' AND upper(name) = 'ALPEK'")
        .bind('#f3a3b3'),
      db.prepare("UPDATE postit_board_catalog SET color = ? WHERE type = 'project' AND upper(name) = 'RNEST'")
        .bind('#9bcf9e'),
    ]);
    // Todo projeto já criado no Cockpit também deve estar disponível como filtro no quadro.
    const hubProjects = await db
      .prepare('SELECT name, color FROM pmo_projects')
      .all<{ name: string; color: string | null }>();
    const catalogProjects = await db
      .prepare("SELECT name FROM postit_board_catalog WHERE type = 'project'")
      .all<{ name: string }>();
    const catalogNames = new Set(catalogProjects.results.map((project) => project.name.trim().toLocaleLowerCase('pt-BR')));
    const statements = hubProjects.results
      .filter((project) => !catalogNames.has(project.name.trim().toLocaleLowerCase('pt-BR')))
      .map((project) => db
        .prepare(
          "INSERT INTO postit_board_catalog (id, type, name, color, created_at) VALUES (?, 'project', ?, ?, CURRENT_TIMESTAMP)",
        )
        .bind(crypto.randomUUID(), project.name, project.color || '#d8e5e5'));
    if (statements.length) await db.batch(statements);
    return;
  }
  const statements = [
    ...defaultSectors.map((name) =>
      db
        .prepare(
          'INSERT INTO postit_board_catalog (id, type, name) VALUES (?, ?, ?)',
        )
        .bind(crypto.randomUUID(), 'sector', name),
    ),
  ];
  await db.batch(statements);
}

export async function GET() {
  try {
    await ensureDefaults();
    const rows = await getDb()
      .prepare(
        'SELECT id, type, name, color FROM postit_board_catalog ORDER BY type, created_at, name',
      )
      .all();
    const uniqueByName = (type: string) => {
      const names = new Set<string>();
      return rows.results.filter((row) => {
        if (row.type !== type) return false;
        const key = String(row.name).trim().toLocaleLowerCase('pt-BR');
        if (names.has(key)) return false;
        names.add(key);
        return true;
      });
    };
    return Response.json({ projects: uniqueByName('project'), sectors: uniqueByName('sector') });
  } catch {
    return Response.json(
      { error: 'Não foi possível carregar os projetos e setores.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    await ensureDefaults();
    const body = (await request.json()) as {
      type?: string;
      name?: string;
      color?: string;
      status?: string;
    };
    const type =
      body.type === 'project' || body.type === 'sector' ? body.type : '';
    const name = body.name?.trim().replace(/\s+/g, ' ') ?? '';
    if (!type || !name || name.length > 40)
      throw new Error('Informe um nome de até 40 caracteres.');
    const duplicate = await getDb()
      .prepare(
        'SELECT id FROM postit_board_catalog WHERE type = ? AND lower(name) = lower(?)',
      )
      .bind(type, name)
      .first();
    if (duplicate) throw new Error('Este cadastro já existe.');
    if (type === 'project') {
      const project = await ensureProjectInBoard(name, body.color || '#d8e5e5');
      await updateProjectStatus(project.name, body.status || 'Planejamento');
      return Response.json({ item: { id: project.id, type, name: project.name, color: project.color, code: project.code } }, { status: 201 });
    }
    const item = { id: crypto.randomUUID(), type, name, color: null };
    await getDb()
      .prepare(
        'INSERT INTO postit_board_catalog (id, type, name, color) VALUES (?, ?, ?, ?)',
      )
      .bind(item.id, item.type, item.name, item.color)
      .run();
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível salvar o cadastro.',
      },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const body = (await request.json()) as { type?: string; oldName?: string; name?: string; color?: string; status?: string };
    const type = body.type === 'project' || body.type === 'sector' ? body.type : '';
    const oldName = body.oldName?.trim() ?? '';
    const name = body.name?.trim().replace(/\s+/g, ' ') ?? '';
    if (!type || !oldName || !name || name.length > 40) throw new Error('Informe um nome de até 40 caracteres.');
    if (name !== oldName) {
      const duplicate = await getDb().prepare('SELECT id FROM postit_board_catalog WHERE type = ? AND lower(name) = lower(?)').bind(type, name).first();
      if (duplicate) throw new Error(`Este ${type === 'project' ? 'projeto' : 'setor'} já existe.`);
    }
    const db = getDb();
    const color = type === 'project' ? body.color || '#d8e5e5' : null;
    await db.batch(type === 'project'
      ? [
          db.prepare('UPDATE postit_board_catalog SET name = ?, color = ? WHERE type = ? AND name = ?').bind(name, color, type, oldName),
          db.prepare('UPDATE postit_actions SET project = ? WHERE project = ?').bind(name, oldName),
          db.prepare('UPDATE project_tracking_projects SET name = ? WHERE name = ?').bind(name, oldName),
          db.prepare('UPDATE pmo_projects SET name = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE lower(name) = lower(?)').bind(name, color, oldName),
        ]
      : [
          db.prepare('UPDATE postit_board_catalog SET name = ? WHERE type = ? AND name = ?').bind(name, type, oldName),
          db.prepare('UPDATE postit_actions SET sector = ? WHERE sector = ?').bind(name, oldName),
        ]);
    const project = type === 'project' ? await ensureProjectRecord(name, color || '#d8e5e5') : null;
    if (type === 'project' && body.status !== undefined) await updateProjectStatus(name, body.status);
    return Response.json({ item: { type, name, color, code: project?.code }, oldName });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar o cadastro.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const body = (await request.json()) as { type?: string; name?: string };
    const type = body.type === 'project' ? body.type : '';
    const name = body.name?.trim() ?? '';
    if (!type || !name) throw new Error('Projeto não informado.');
    const db = getDb();
    const linked = await db.prepare('SELECT COUNT(*) AS total FROM postit_actions WHERE project = ?').bind(name).first<{ total: number }>();
    if (linked?.total) throw new Error(`Não é possível excluir: existem ${linked.total} post-it(s) vinculados a este projeto.`);
    const result = await db.prepare('DELETE FROM postit_board_catalog WHERE type = ? AND name = ?').bind(type, name).run();
    if (!result.meta.changes) throw new Error('Projeto não encontrado.');
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível excluir o projeto.' }, { status: 400 });
  }
}
