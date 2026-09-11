import { getDb } from '@/db';
import { requireEditor } from '@/lib/editor-auth';

const defaultProjects = [
  ['AMP', '#d9c7f3'],
  ['5S8', '#aee4ec'],
  ['ALPPEX', '#f7c2c5'],
  ['RINVEST', '#bce8c8'],
  ['ECOPÓS', '#9bc6bb'],
  ['Geral', '#f1e6a9'],
];
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
    return;
  }
  const statements = [
    ...defaultProjects.map(([name, color]) =>
      db
        .prepare(
          'INSERT INTO postit_board_catalog (id, type, name, color) VALUES (?, ?, ?, ?)',
        )
        .bind(crypto.randomUUID(), 'project', name, color),
    ),
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
    return Response.json({
      projects: rows.results.filter((r) => r.type === 'project'),
      sectors: rows.results.filter((r) => r.type === 'sector'),
    });
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
    const item = {
      id: crypto.randomUUID(),
      type,
      name,
      color: type === 'project' ? body.color || '#d8e5e5' : null,
    };
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
    const body = (await request.json()) as { type?: string; oldName?: string; name?: string; color?: string };
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
        ]
      : [
          db.prepare('UPDATE postit_board_catalog SET name = ? WHERE type = ? AND name = ?').bind(name, type, oldName),
          db.prepare('UPDATE postit_actions SET sector = ? WHERE sector = ?').bind(name, oldName),
        ]);
    return Response.json({ item: { type, name, color }, oldName });
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
