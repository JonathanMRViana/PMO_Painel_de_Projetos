import { getDb } from '@/db';

const defaultProjects = [
  ['AMP', '#d9c7f3'],
  ['5S8', '#aee4ec'],
  ['ALPPEX', '#f7c2c5'],
  ['RINVEST', '#bce8c8'],
  ['ECOPÓS', '#4b5558'],
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
  if (existing?.total) return;
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
