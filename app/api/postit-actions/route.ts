import { getDb } from '@/db';
import { requireEditor } from '@/lib/editor-auth';

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
    createdAt: String(row.created_at ?? ''),
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
export async function GET(request: Request) {
  try {
    const actionId = new URL(request.url).searchParams.get('history');
    if (actionId) {
      const history = await getDb().prepare('SELECT id, previous_date, new_date, changed_at FROM postit_action_date_history WHERE action_id = ? ORDER BY changed_at DESC').bind(actionId).all();
      return Response.json({ history: history.results.map((row) => ({ id: String(row.id), previousDate: String(row.previous_date), newDate: String(row.new_date), changedAt: String(row.changed_at) })) });
    }
    const r = await getDb()
      .prepare(
        'SELECT id, title, observation, owner, action_date, board_day, sector, project, criticality, completed, created_at FROM postit_actions ORDER BY sector, board_day, action_date, created_at',
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
    const denied = await requireEditor(request);
    if (denied) return denied;
    const a = clean((await request.json()) as Payload);
    const createdAt = new Date().toISOString();
    await getDb()
      .prepare(
        'INSERT INTO postit_actions (id, title, observation, owner, action_date, board_day, sector, project, status, criticality, completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        createdAt,
        createdAt,
      )
      .run();
    return Response.json({ action: { ...a, createdAt } }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
export async function PUT(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const a = clean((await request.json()) as Payload);
    const db = getDb();
    const before = await db.prepare('SELECT action_date, created_at FROM postit_actions WHERE id = ?').bind(a.id).first<{ action_date: string; created_at: string }>();
    const r = await db
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
    if (before && before.action_date !== a.date) {
      await db.prepare('INSERT INTO postit_action_date_history (id, action_id, previous_date, new_date, changed_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), a.id, before.action_date, a.date, new Date().toISOString()).run();
    }
    return Response.json({ action: { ...a, createdAt: before?.created_at ?? '' } });
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const { id, all } = (await request.json()) as { id?: string; all?: boolean };
    if (all) {
      const db = getDb();
      const total = await db.prepare('SELECT COUNT(*) AS total FROM postit_actions').first<{ total: number }>();
      await db.batch([
        db.prepare('DELETE FROM postit_action_date_history'),
        db.prepare('DELETE FROM postit_actions'),
      ]);
      return Response.json({ ok: true, deleted: total?.total ?? 0 });
    }
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
