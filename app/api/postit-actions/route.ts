import { getDb } from '@/db';

const days = ['seg', 'ter', 'qua', 'qui', 'sex', 'd7'];
const criticalities = ['Baixo', 'Médio', 'Alto', 'Crítico'];
type Payload = {
  id?: string;
  title?: string;
  observation?: string;
  owner?: string;
  date?: string;
  day?: string;
  sector?: string;
  project?: string;
  criticality?: string;
  completed?: boolean;
};

function clean(payload: Payload) {
  const action = {
    id: payload.id?.trim() ?? crypto.randomUUID(),
    title: payload.title?.trim() ?? '',
    observation: payload.observation?.trim() ?? '',
    owner: payload.owner?.trim() ?? '',
    date: payload.date?.trim() ?? '',
    day: payload.day?.trim() ?? '',
    sector: payload.sector?.trim() ?? '',
    project: payload.project?.trim() ?? '',
    criticality: payload.criticality?.trim() ?? 'Médio',
    completed: Boolean(payload.completed),
  };
  if (
    !action.id ||
    !action.title ||
    !action.owner ||
    !/^\d{4}-\d{2}-\d{2}$/.test(action.date) ||
    !days.includes(action.day) ||
    !action.sector ||
    !action.project ||
    !criticalities.includes(action.criticality)
  )
    throw new Error('Dados da ação incompletos ou inválidos.');
  return action;
}
function rowToAction(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title),
    observation: String(row.observation ?? ''),
    owner: String(row.owner),
    date: String(row.action_date),
    day: String(row.board_day),
    sector: String(row.sector),
    project: String(row.project),
    criticality: String(row.criticality ?? 'Médio'),
    completed: Boolean(row.completed),
  };
}
function fail(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a ação.',
    },
    { status: 500 },
  );
}
export async function GET() {
  try {
    const r = await getDb()
      .prepare(
        'SELECT id, title, observation, owner, action_date, board_day, sector, project, criticality, completed FROM postit_actions ORDER BY sector, board_day, action_date, created_at',
      )
      .all();
    return Response.json({
      actions: r.results.map((row) =>
        rowToAction(row as Record<string, unknown>),
      ),
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    const a = clean((await request.json()) as Payload);
    await getDb()
      .prepare(
        'INSERT INTO postit_actions (id, title, observation, owner, action_date, board_day, sector, project, status, criticality, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        a.id,
        a.title,
        a.observation,
        a.owner,
        a.date,
        a.day,
        a.sector,
        a.project,
        'No prazo',
        a.criticality,
        a.completed ? 1 : 0,
      )
      .run();
    return Response.json({ action: a }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
export async function PUT(request: Request) {
  try {
    const a = clean((await request.json()) as Payload);
    const r = await getDb()
      .prepare(
        'UPDATE postit_actions SET title = ?, observation = ?, owner = ?, action_date = ?, board_day = ?, sector = ?, project = ?, criticality = ?, completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      )
      .bind(
        a.title,
        a.observation,
        a.owner,
        a.date,
        a.day,
        a.sector,
        a.project,
        a.criticality,
        a.completed ? 1 : 0,
        a.id,
      )
      .run();
    if (!r.meta.changes)
      return Response.json({ error: 'Ação não encontrada.' }, { status: 404 });
    return Response.json({ action: a });
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(request: Request) {
  try {
    const { id } = (await request.json()) as { id?: string };
    if (!id)
      return Response.json({ error: 'Ação não informada.' }, { status: 400 });
    await getDb()
      .prepare('DELETE FROM postit_actions WHERE id = ?')
      .bind(id)
      .run();
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
