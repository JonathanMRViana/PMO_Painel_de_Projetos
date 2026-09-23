import { getDb } from '@/db';
import { readStandardTemplate } from '@/lib/project-tracking-db';

type ScheduleProject = { id: string; name: string; projectCode: string };

/**
 * Ensures that every registered PMO project has its own copy of the standard
 * schedule before a fleet is included through the OPR.
 */
export async function ensureProjectSchedule(projectCode: string): Promise<ScheduleProject> {
  const db = getDb();
  const existing = await db
    .prepare('SELECT id, name, project_code FROM project_tracking_projects WHERE project_code = ?')
    .bind(projectCode)
    .first<{ id: string; name: string; project_code: string }>();
  if (existing) return { id: existing.id, name: existing.name, projectCode: existing.project_code };

  const hubProject = await db
    .prepare('SELECT name FROM pmo_projects WHERE code = ?')
    .bind(projectCode)
    .first<{ name: string }>();
  if (!hubProject) throw new Error('Projeto não encontrado.');

  const template = await readStandardTemplate();
  const projectId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare('INSERT INTO project_tracking_projects (id, name, project_code, template_revision, start_date, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(projectId, hubProject.name, projectCode, template.revision, '', now, now),
    ...template.tasks.map((task) =>
      db
        .prepare('INSERT INTO project_tracking_project_tasks (id, project_id, source_task_id, parent_id, pillar, item, title, owner, criticality, duration_days, predecessor_id, start_date, end_date, progress, status, observation, kind, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)')
        .bind(
          `${projectId}:${task.id}`,
          projectId,
          task.id,
          task.parentId ? `${projectId}:${task.parentId}` : null,
          task.pillar,
          task.item,
          task.title,
          task.owner,
          task.criticality,
          task.durationDays,
          task.predecessorId ? `${projectId}:${task.predecessorId}` : null,
          '',
          '',
          'Não iniciado',
          '',
          task.kind,
          task.sortOrder,
        ),
    ),
    db
      .prepare('INSERT INTO project_tracking_project_tasks (id, project_id, source_task_id, parent_id, pillar, item, title, owner, duration_days, predecessor_id, start_date, end_date, progress, status, observation, kind, sort_order) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 0, NULL, ?, ?, 0, ?, ?, ?, ?)')
      .bind(
        `${projectId}:automatic:start`,
        projectId,
        'automatic:start',
        'Empresa',
        'M.0',
        'INÍCIO DO PROJETO',
        'PMO',
        '',
        '',
        'Não iniciado',
        '',
        'milestone',
        -1,
      ),
  ]);

  return { id: projectId, name: hubProject.name, projectCode };
}
