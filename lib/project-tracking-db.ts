import { getDb } from '@/db';
import {
  defaultTemplateTasks,
  STANDARD_TEMPLATE_VERSION,
} from '@/lib/project-template';

export type TrackingTask = {
  id: string;
  parentId: string | null;
  pillar: string;
  item: string;
  title: string;
  owner: string;
  durationDays: number;
  predecessorId: string | null;
  startDate: string;
  endDate: string;
  progress: number;
  status: string;
  observation: string;
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
    predecessorId: row.predecessor_id ? String(row.predecessor_id) : null,
    startDate: String(row.start_date ?? ''),
    endDate: String(row.end_date ?? ''),
    progress: Number(row.progress ?? 0),
    status: String(row.status ?? 'Não iniciado'),
    observation: String(row.observation ?? ''),
    kind: String(row.kind ?? 'task'),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export async function ensureStandardTemplate() {
  const db = getDb();
  await db
    .prepare(
      "INSERT OR IGNORE INTO project_tracking_settings (id, revision, source_version, updated_at) VALUES ('standard', 1, 'legacy', CURRENT_TIMESTAMP)",
    )
    .run();
  const settings = await db
    .prepare(
      "SELECT source_version FROM project_tracking_settings WHERE id = 'standard'",
    )
    .first<{ source_version: string }>();
  const current = await db
    .prepare('SELECT COUNT(*) AS total FROM project_tracking_template_tasks')
    .first<{ total: number }>();
  const requiresRefresh =
    Number(current?.total ?? 0) === 0 ||
    settings?.source_version !== STANDARD_TEMPLATE_VERSION;
  if (!requiresRefresh) return;

  await db.batch([
    db.prepare('DELETE FROM project_tracking_template_tasks'),
    ...defaultTemplateTasks.map((task) =>
      db
        .prepare(
          'INSERT INTO project_tracking_template_tasks (id, parent_id, pillar, item, title, owner, duration_days, predecessor_id, kind, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        )
        .bind(
          task.id,
          task.parentId,
          task.pillar,
          task.item,
          task.title,
          task.owner,
          task.durationDays,
          task.predecessorId,
          task.kind,
          task.sortOrder,
        ),
    ),
    db
      .prepare(
        "UPDATE project_tracking_settings SET revision = revision + 1, source_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'standard'",
      )
      .bind(STANDARD_TEMPLATE_VERSION),
  ]);
}

export async function readStandardTemplate() {
  await ensureStandardTemplate();
  const db = getDb();
  const [settings, tasks] = await Promise.all([
    db
      .prepare(
        "SELECT revision, source_version, updated_at FROM project_tracking_settings WHERE id = 'standard'",
      )
      .first<{
        revision: number;
        source_version: string;
        updated_at: string;
      }>(),
    db
      .prepare(
        'SELECT id, parent_id, pillar, item, title, owner, duration_days, predecessor_id, kind, sort_order FROM project_tracking_template_tasks ORDER BY sort_order, item',
      )
      .all(),
  ]);
  return {
    revision: Number(settings?.revision ?? 1),
    sourceVersion: String(settings?.source_version ?? ''),
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
