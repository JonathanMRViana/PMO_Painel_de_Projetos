import { getDb } from '@/db';
import { requireEditor } from '@/lib/editor-auth';
import { syncOprFleetsFromSchedules } from '@/lib/opr-fleet-sync';
import { s11dSourceRows } from '@/lib/s11d-source';
import { trackingError } from '@/lib/project-tracking-db';

const importPrefix = 's11d-20260922:';
const sourceStartDate = '2026-09-16';

type ExistingTask = {
  id: string;
  source_task_id: string;
  linked_action_id: string | null;
  progress: number;
  actual_start_date: string;
  actual_end_date: string;
  observation: string;
  item: string;
};

function dateStatus(start: string, end: string, actualStart: string, actualEnd: string) {
  if (actualEnd) return 'Concluído';
  if (actualStart) return 'Em andamento';
  if (!start && !end) return 'Não planejado';
  return 'Não iniciado';
}

export async function POST(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const { projectId } = (await request.json()) as { projectId?: string };
    if (!projectId) return Response.json({ error: 'Projeto não informado.' }, { status: 400 });
    const db = getDb();
    const project = await db
      .prepare('SELECT id, name FROM project_tracking_projects WHERE id = ?')
      .bind(projectId)
      .first<{ id: string; name: string }>();
    if (!project || project.name.trim().toUpperCase() !== 'S11D')
      return Response.json({ error: 'Importação disponível somente para o S11D.' }, { status: 400 });

    const existing = await db
      .prepare('SELECT id, source_task_id, linked_action_id, progress, actual_start_date, actual_end_date, observation, item FROM project_tracking_project_tasks WHERE project_id = ?')
      .bind(projectId)
      .all<ExistingTask>();
    if (existing.results.some((task) => task.source_task_id.startsWith(importPrefix)))
      return Response.json({ error: 'O cronograma S11D já foi importado.' }, { status: 409 });

    // Conservar quaisquer registros já editados ou vinculados a ações.
    const keep = existing.results.filter(
      (task) =>
        task.source_task_id === 'automatic:start' ||
        Boolean(task.linked_action_id || task.progress || task.actual_start_date || task.actual_end_date || task.observation) ||
        task.item.startsWith('EQ.'),
    );
    const keepIds = new Set(keep.map((task) => task.id));
    const statements = existing.results
      .filter((task) => !keepIds.has(task.id))
      .map((task) =>
        db.prepare('DELETE FROM project_tracking_project_tasks WHERE id = ? AND project_id = ?')
          .bind(task.id, projectId),
      );
    const parents: Record<number, string> = {};
    let fleetNumber = 0;
    let imported = 0;
    for (const [
      row, level, sourceItem, title, owner, startDate, endDate,
      actualStartDate, actualEndDate, sourceStatus, sourceObservation,
    ] of s11dSourceRows) {
      if (level === 0) {
        for (const key of Object.keys(parents)) delete parents[Number(key)];
        continue;
      }
      const pillar = row < 41 ? 'Empresa' : row < 62 ? 'Pessoas' : 'Equipamentos';
      const fleet = pillar === 'Equipamentos' && level === 1;
      if (fleet) fleetNumber += 1;
      const item = fleet ? `EQ.${fleetNumber}` : sourceItem || `S11D.${row}`;
      const id = `${projectId}:s11d-r${row}`;
      const parentId = parents[level - 1] ?? null;
      parents[level] = id;
      for (const key of Object.keys(parents))
        if (Number(key) > level) delete parents[Number(key)];
      const next = s11dSourceRows[row - 5];
      const hasChildren = Boolean(next && next[1] > level);
      const kind = fleet ? 'task' : hasChildren ? 'group' : 'task';
      const durationDays = startDate && endDate
        ? Math.max(1, Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1)
        : kind === 'group' ? 0 : 1;
      const note = [
        sourceObservation,
        sourceStatus && !actualEndDate ? `Status na planilha: ${sourceStatus}` : '',
        startDate && endDate && endDate < startDate
          ? 'Revisar datas da planilha: término previsto anterior ao início.'
          : '',
      ].filter(Boolean).join(' | ');
      statements.push(
        db.prepare(
          'INSERT INTO project_tracking_project_tasks (id, project_id, source_task_id, parent_id, pillar, item, title, owner, duration_days, predecessor_id, start_date, end_date, actual_start_date, actual_end_date, linked_action_id, progress, status, observation, kind, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)',
        ).bind(
          id, projectId, `${importPrefix}r${row}`, parentId, pillar, item, title,
          owner, durationDays, startDate, endDate, actualStartDate, actualEndDate,
          actualEndDate ? 100 : 0,
          dateStatus(startDate, endDate, actualStartDate, actualEndDate),
          note, kind, row * 10,
        ),
      );
      imported += 1;
    }
    for (const task of keep) {
      if (task.source_task_id === 'automatic:start') {
        statements.push(
          db.prepare('UPDATE project_tracking_project_tasks SET start_date = ?, end_date = ? WHERE id = ?')
            .bind(sourceStartDate, sourceStartDate, task.id),
        );
      } else {
        statements.push(
          db.prepare('UPDATE project_tracking_project_tasks SET parent_id = NULL, sort_order = ? WHERE id = ?')
            .bind(5_000 + keep.indexOf(task) * 10, task.id),
        );
      }
    }
    statements.push(
      db.prepare('UPDATE project_tracking_projects SET start_date = ?, updated_at = ? WHERE id = ?')
        .bind(sourceStartDate, new Date().toISOString(), projectId),
    );
    await db.batch(statements);
    await syncOprFleetsFromSchedules();
    return Response.json({ imported, preserved: keep.length, fleets: fleetNumber });
  } catch (error) {
    return trackingError(error, 'Não foi possível importar o cronograma S11D.');
  }
}
