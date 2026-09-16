import { getDb } from '@/db';
import { requireEditor } from '@/lib/editor-auth';
import { pillars } from '@/lib/project-template';
import { readStandardTemplate, trackingError } from '@/lib/project-tracking-db';

type Payload = {
  id?: string;
  parentId?: string | null;
  pillar?: string;
  item?: string;
  title?: string;
  owner?: string;
  durationDays?: number;
  predecessorId?: string | null;
  kind?: string;
};

function clean(payload: Payload) {
  const task = {
    id: payload.id?.trim() ?? '',
    parentId: payload.parentId?.trim() || null,
    pillar: payload.pillar?.trim() ?? '',
    item: payload.item?.trim() ?? '',
    title: payload.title?.trim() ?? '',
    owner: payload.owner?.trim() ?? '',
    durationDays: Math.max(0, Math.round(Number(payload.durationDays ?? 1))),
    predecessorId: payload.predecessorId?.trim() || null,
    kind: payload.kind?.trim() ?? 'task',
  };
  if (
    !pillars.includes(task.pillar as (typeof pillars)[number]) ||
    !task.item ||
    !task.title ||
    !['group', 'task', 'milestone'].includes(task.kind)
  ) {
    throw new Error('Preencha o pilar, o item e o nome da atividade.');
  }
  return task;
}

export async function GET() {
  try {
    return Response.json(await readStandardTemplate());
  } catch (error) {
    return trackingError(error, 'Não foi possível carregar o modelo padrão.');
  }
}

export async function POST(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const task = clean((await request.json()) as Payload);
    const db = getDb();
    const id = crypto.randomUUID();
    if (task.parentId) {
      const parent = await db
        .prepare(
          'SELECT pillar FROM project_tracking_template_tasks WHERE id = ?',
        )
        .bind(task.parentId)
        .first<{ pillar: string }>();
      if (!parent || parent.pillar !== task.pillar)
        return Response.json(
          {
            error:
              'A subtarefa deve permanecer no mesmo pilar da tarefa principal.',
          },
          { status: 400 },
        );
    }
    const position = task.parentId
      ? await db
          .prepare(
            'WITH RECURSIVE descendants(id, sort_order) AS (SELECT id, sort_order FROM project_tracking_template_tasks WHERE id = ? UNION ALL SELECT task.id, task.sort_order FROM project_tracking_template_tasks task JOIN descendants parent ON task.parent_id = parent.id) SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order FROM descendants',
          )
          .bind(task.parentId)
          .first<{ next_order: number }>()
      : await db
          .prepare(
            'SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order FROM project_tracking_template_tasks WHERE pillar = ?',
          )
          .bind(task.pillar)
          .first<{ next_order: number }>();
    const nextOrder = Number(position?.next_order ?? 10);
    const statements = [];
    if (task.parentId) {
      statements.push(
        db
          .prepare(
            'UPDATE project_tracking_template_tasks SET sort_order = sort_order + 10 WHERE pillar = ? AND sort_order >= ?',
          )
          .bind(task.pillar, nextOrder),
      );
    }
    statements.push(
      db
        .prepare(
          'INSERT INTO project_tracking_template_tasks (id, parent_id, pillar, item, title, owner, duration_days, predecessor_id, kind, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        )
        .bind(
          id,
          task.parentId,
          task.pillar,
          task.item,
          task.title,
          task.owner,
          task.kind === 'group' ? 0 : task.durationDays,
          task.predecessorId,
          task.kind,
          nextOrder,
        ),
      db.prepare(
        "UPDATE project_tracking_settings SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 'standard'",
      ),
    );
    await db.batch(statements);
    return Response.json(
      { ...(await readStandardTemplate()), createdId: id },
      { status: 201 },
    );
  } catch (error) {
    return trackingError(error, 'Não foi possível criar a atividade.');
  }
}

export async function PUT(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const task = clean((await request.json()) as Payload);
    if (!task.id)
      return Response.json(
        { error: 'Atividade não informada.' },
        { status: 400 },
      );
    const db = getDb();
    const result = await db.batch([
      db
        .prepare(
          'UPDATE project_tracking_template_tasks SET item = ?, title = ?, owner = ?, duration_days = ?, predecessor_id = ?, kind = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        )
        .bind(
          task.item,
          task.title,
          task.owner,
          task.kind === 'group' ? 0 : task.durationDays,
          task.predecessorId,
          task.kind,
          task.id,
        ),
      db.prepare(
        "UPDATE project_tracking_settings SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 'standard'",
      ),
    ]);
    if (!result[0].meta.changes)
      return Response.json(
        { error: 'Atividade não encontrada.' },
        { status: 404 },
      );
    return Response.json(await readStandardTemplate());
  } catch (error) {
    return trackingError(error, 'Não foi possível atualizar a atividade.');
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const { id } = (await request.json()) as { id?: string };
    if (!id)
      return Response.json(
        { error: 'Atividade não informada.' },
        { status: 400 },
      );
    const db = getDb();
    await db.batch([
      db
        .prepare(
          'WITH RECURSIVE descendants(id) AS (SELECT id FROM project_tracking_template_tasks WHERE id = ? UNION ALL SELECT task.id FROM project_tracking_template_tasks task JOIN descendants parent ON task.parent_id = parent.id) DELETE FROM project_tracking_template_tasks WHERE id IN (SELECT id FROM descendants)',
        )
        .bind(id),
      db.prepare(
        "UPDATE project_tracking_settings SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 'standard'",
      ),
    ]);
    return Response.json(await readStandardTemplate());
  } catch (error) {
    return trackingError(error, 'Não foi possível excluir a atividade.');
  }
}
