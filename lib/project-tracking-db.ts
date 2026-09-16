import { getDb } from '@/db';
import { defaultTemplateTasks } from '@/lib/project-template';

export type TrackingTask = {
  id: string;
  parentId: string | null;
  pillar: string;
  item: string;
  title: string;
  owner: string;
  durationDays: number;
  kind: string;
  sortOrder: number;
};

export function rowToTrackingTask(row: Record<string, unknown>): TrackingTask {
  return {
    id: String(row.id),
    parentId: row.parent_id ? String(row.parent_id) : null,
    pillar: String(row.pillar),
    item: String(row.item),
    title: String(row.title),
    owner: String(row.owner ?? ''),
    durationDays: Number(row.duration_days ?? 0),
    kind: String(row.kind ?? 'task'),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export async function ensureStandardTemplate() {
  const db = getDb();
  await db
    .prepare(
      "INSERT OR IGNORE INTO project_tracking_settings (id, revision, updated_at) VALUES ('standard', 1, CURRENT_TIMESTAMP)",
    )
    .run();
  const current = await db
    .prepare('SELECT COUNT(*) AS total FROM project_tracking_template_tasks')
    .first<{ total: number }>();
  if (Number(current?.total ?? 0) > 0) return;

  await db.batch(
    defaultTemplateTasks.map((task) =>
      db
        .prepare(
          'INSERT OR IGNORE INTO project_tracking_template_tasks (id, parent_id, pillar, item, title, owner, duration_days, kind, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        )
        .bind(
          task.id,
          task.parentId,
          task.pillar,
          task.item,
          task.title,
          task.owner,
          task.durationDays,
          task.kind,
          task.sortOrder,
        ),
    ),
  );
}

export async function readStandardTemplate() {
  await ensureStandardTemplate();
  const db = getDb();
  const [settings, tasks] = await Promise.all([
    db
      .prepare(
        "SELECT revision, updated_at FROM project_tracking_settings WHERE id = 'standard'",
      )
      .first<{ revision: number; updated_at: string }>(),
    db
      .prepare(
        'SELECT id, parent_id, pillar, item, title, owner, duration_days, kind, sort_order FROM project_tracking_template_tasks ORDER BY sort_order, item',
      )
      .all(),
  ]);
  return {
    revision: Number(settings?.revision ?? 1),
    updatedAt: String(settings?.updated_at ?? ''),
    tasks: tasks.results.map((row) =>
      rowToTrackingTask(row as Record<string, unknown>),
    ),
  };
}

export function trackingError(error: unknown, fallback: string, status = 500) {
  const message = error instanceof Error ? error.message : fallback;
  const conflict = /UNIQUE constraint failed/i.test(message);
  return Response.json(
    {
      error: conflict
        ? 'Já existe um registro com esse nome ou item.'
        : message,
    },
    { status: conflict ? 409 : status },
  );
}
