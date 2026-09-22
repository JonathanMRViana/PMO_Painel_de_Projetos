import { getDb } from '@/db';
import { requireEditor } from '@/lib/editor-auth';
import { syncOprFleetsFromSchedules } from '@/lib/opr-fleet-sync';

export async function PUT(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const body = await request.json() as { code?: string; taskId?: string; fleet?: string; description?: string; plannedDate?: string };
    const code = String(body.code || '').trim();
    const taskId = String(body.taskId || '').trim();
    const fleet = String(body.fleet || '').trim().slice(0, 160);
    const description = String(body.description || '').trim().slice(0, 1000);
    const plannedDate = String(body.plannedDate || '').trim();
    if (!code || !taskId || !fleet) return Response.json({ error: 'Informe projeto e frota.' }, { status: 400 });
    if (plannedDate && !/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) return Response.json({ error: 'Data inválida.' }, { status: 400 });
    const db = getDb();
    const task = await db.prepare(`SELECT task.id, task.duration_days, project.id AS project_id
      FROM project_tracking_project_tasks AS task
      INNER JOIN project_tracking_projects AS project ON project.id = task.project_id
      WHERE project.project_code = ? AND task.id = ? AND task.pillar = 'Equipamentos' AND task.kind = 'task' AND task.item GLOB 'EQ.*'`)
      .bind(code, taskId).first<{ id: string; duration_days: number; project_id: string }>();
    if (!task) return Response.json({ error: 'Equipamento não encontrado no cronograma.' }, { status: 404 });
    const endDate = plannedDate ? new Date(Date.parse(`${plannedDate}T12:00:00Z`) + (Math.max(1, Number(task.duration_days)) - 1) * 86_400_000).toISOString().slice(0, 10) : '';
    await db.batch([
      db.prepare('UPDATE project_tracking_project_tasks SET title = ?, observation = ?, start_date = ?, end_date = ? WHERE id = ?').bind(fleet, description, plannedDate, endDate, taskId),
      db.prepare('UPDATE project_tracking_projects SET updated_at = ? WHERE id = ?').bind(new Date().toISOString(), task.project_id),
    ]);
    await syncOprFleetsFromSchedules();
    return Response.json({ saved: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível editar a frota.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const body = await request.json() as { code?: string; taskId?: string };
    const code = String(body.code || '').trim();
    const taskId = String(body.taskId || '').trim();
    const db = getDb();
    const task = await db.prepare(`SELECT task.id, project.id AS project_id
      FROM project_tracking_project_tasks AS task
      INNER JOIN project_tracking_projects AS project ON project.id = task.project_id
      WHERE project.project_code = ? AND task.id = ? AND task.pillar = 'Equipamentos' AND task.kind = 'task' AND task.item GLOB 'EQ.*'`)
      .bind(code, taskId).first<{ id: string; project_id: string }>();
    if (!task) return Response.json({ error: 'Equipamento não encontrado no cronograma.' }, { status: 404 });
    await db.batch([
      db.prepare('DELETE FROM project_tracking_project_tasks WHERE id = ?').bind(taskId),
      db.prepare('UPDATE project_tracking_projects SET updated_at = ? WHERE id = ?').bind(new Date().toISOString(), task.project_id),
    ]);
    await syncOprFleetsFromSchedules();
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível excluir a frota.' }, { status: 500 });
  }
}
