import { getDb } from '@/db';
import { requireEditor } from '@/lib/editor-auth';
import {
  readStandardTemplate,
  rowToTrackingTask,
  trackingError,
} from '@/lib/project-tracking-db';
import { ensureProjectInBoard, isProjectStatus, normalizeProjectStatus, updateContractStartDate, updateProjectStatus } from '@/lib/project-hub';
import { syncScheduleActions } from '@/lib/schedule-action-sync';
import { syncOprFleetsFromSchedules } from '@/lib/opr-fleet-sync';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function cleanDate(value: unknown) {
  const date = String(value ?? '').trim();
  if (date && !datePattern.test(date))
    throw new Error('Informe uma data válida.');
  return date;
}

function addDays(date: string, days: number) {
  if (!date) return '';
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysInclusive(start: string, end: string) {
  if (!start || !end) return 1;
  const delta =
    (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) /
    86_400_000;
  return Math.max(1, Math.round(delta) + 1);
}

function automaticStatus(
  startDate: string,
  endDate: string,
  actualStartDate: string,
  actualEndDate: string,
) {
  if (actualEndDate) return 'Concluído';
  const today = new Date().toISOString().slice(0, 10);
  if (actualStartDate) return endDate && endDate < today ? 'Atrasado' : 'Em andamento';
  if (!startDate && !endDate) return 'Não planejado';
  return endDate && endDate < today ? 'Atrasado' : 'Não iniciado';
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const projectId = new URL(request.url).searchParams.get('id');
    const projectsResult = await db
      .prepare(
        'SELECT id, name, project_code, template_revision, start_date, updated_at, created_at FROM project_tracking_projects ORDER BY created_at DESC, name',
      )
      .all();
    const projects = projectsResult.results.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      code: String(row.project_code || ''),
      templateRevision: Number(row.template_revision),
      startDate: String(row.start_date ?? ''),
      updatedAt: String(row.updated_at ?? ''),
      createdAt: String(row.created_at),
    }));
    if (!projectId) return Response.json({ projects });
    const selected = projects.find((project) => project.id === projectId);
    if (!selected)
      return Response.json(
        { error: 'Projeto não encontrado.' },
        { status: 404 },
      );
    const tasks = await db
      .prepare(
        'SELECT id, parent_id, pillar, item, title, owner, criticality, duration_days, predecessor_id, start_date, end_date, actual_start_date, actual_end_date, linked_action_id, progress, status, observation, kind, sort_order FROM project_tracking_project_tasks WHERE project_id = ? ORDER BY sort_order, item',
      )
      .bind(projectId)
      .all();
    const actions = await db
      .prepare(
        'SELECT id, title, action_date, completed FROM postit_actions WHERE project_code = ? OR lower(project) = lower(?) ORDER BY completed, action_date, title',
      )
      .bind(selected.code, selected.name)
      .all();
    return Response.json({
      projects,
      project: selected,
      tasks: tasks.results.map((row) =>
        rowToTrackingTask(row as Record<string, unknown>),
      ),
      actions: actions.results.map((row) => ({
        id: String(row.id),
        title: String(row.title),
        actionDate: String(row.action_date ?? ''),
        completed: Boolean(row.completed),
      })),
    });
  } catch (error) {
    return trackingError(error, 'Não foi possível carregar os projetos.');
  }
}

export async function POST(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const body = (await request.json()) as {
      name?: string;
      projectId?: string;
      parentId?: string | null;
      predecessorId?: string | null;
      pillar?: string;
      item?: string;
      title?: string;
      owner?: string;
      criticality?: string;
      durationDays?: number;
      kind?: string;
      startDate?: string;
      endDate?: string;
      color?: string;
      status?: string;
      contractStartDate?: string;
    };
    if (body.projectId?.trim()) {
      const db = getDb();
      const projectId = body.projectId.trim();
      const project = await db
        .prepare('SELECT id FROM project_tracking_projects WHERE id = ?')
        .bind(projectId)
        .first();
      if (!project)
        return Response.json({ error: 'Projeto não encontrado.' }, { status: 404 });
      const item = String(body.item ?? '').trim();
      const title = String(body.title ?? '').trim();
      if (!item || !title)
        return Response.json(
          { error: 'Informe o item e o nome da atividade.' },
          { status: 400 },
        );
      const pillar = ['Empresa', 'Pessoas', 'Equipamentos'].includes(
        String(body.pillar),
      )
        ? String(body.pillar)
        : 'Empresa';
      const kind = ['task', 'milestone', 'group'].includes(String(body.kind))
        ? String(body.kind)
        : 'task';
      const startDate = cleanDate(body.startDate);
      let endDate = cleanDate(body.endDate);
      let durationDays =
        kind === 'group' || kind === 'milestone'
          ? 0
          : Math.max(1, Math.round(Number(body.durationDays ?? 1)));
      if (kind === 'milestone' && startDate) endDate = startDate;
      if (kind === 'task' && startDate && !endDate)
        endDate = addDays(startDate, durationDays - 1);
      if (kind === 'task' && startDate && endDate)
        durationDays = daysInclusive(startDate, endDate);
      if (startDate && endDate && endDate < startDate)
        return Response.json(
          { error: 'A data de término não pode ser anterior ao início.' },
          { status: 400 },
        );
      const taskId = crypto.randomUUID();
      const order = await db
        .prepare(
          'SELECT COALESCE(MAX(sort_order), 0) AS total FROM project_tracking_project_tasks WHERE project_id = ?',
        )
        .bind(projectId)
        .first<{ total: number }>();
      await db
        .prepare(
          'INSERT INTO project_tracking_project_tasks (id, project_id, source_task_id, parent_id, pillar, item, title, owner, criticality, duration_days, predecessor_id, start_date, end_date, actual_start_date, actual_end_date, linked_action_id, progress, status, observation, kind, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?, ?)',
        )
        .bind(
          taskId,
          projectId,
          `manual:${taskId}`,
          body.parentId?.trim() || null,
          pillar,
          item,
          title,
          String(body.owner ?? '').trim(),
          ['Baixo', 'Médio', 'Alto', 'Crítico'].includes(String(body.criticality)) ? body.criticality : 'Médio',
          durationDays,
          body.predecessorId?.trim() || null,
          startDate,
          endDate,
          '',
          '',
          'Não planejado',
          '',
          kind,
          Number(order?.total ?? 0) + 1,
        )
        .run();
      await syncOprFleetsFromSchedules();
      return Response.json({ id: taskId }, { status: 201 });
    }
    const name = body.name?.trim().replace(/\s+/g, ' ') ?? '';
    const startDate = cleanDate(body.startDate);
    if (name.length < 2 || name.length > 80)
      return Response.json(
        { error: 'Informe um nome de projeto entre 2 e 80 caracteres.' },
        { status: 400 },
      );
    if (body.status !== undefined && !isProjectStatus(String(body.status)))
      return Response.json({ error: 'Status de projeto inválido.' }, { status: 400 });
    const contractStartDate = String(body.contractStartDate ?? '').trim();
    if (contractStartDate && !datePattern.test(contractStartDate))
      return Response.json({ error: 'Informe uma data de início do contrato válida.' }, { status: 400 });
    const color = /^#[0-9a-f]{6}$/i.test(String(body.color ?? ''))
      ? String(body.color)
      : undefined;

    const template = await readStandardTemplate();
    const db = getDb();
    const projectId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const statements = [
      db
        .prepare(
          'INSERT INTO project_tracking_projects (id, name, project_code, template_revision, start_date, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          projectId,
          name,
          '',
          template.revision,
          startDate,
          createdAt,
          createdAt,
        ),
      ...template.tasks.map((task) => {
        return db
          .prepare(
            'INSERT INTO project_tracking_project_tasks (id, project_id, source_task_id, parent_id, pillar, item, title, owner, criticality, duration_days, predecessor_id, start_date, end_date, progress, status, observation, kind, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)',
          )
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
          );
      }),
      db
        .prepare(
          'INSERT INTO project_tracking_project_tasks (id, project_id, source_task_id, parent_id, pillar, item, title, owner, duration_days, predecessor_id, start_date, end_date, progress, status, observation, kind, sort_order) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 0, NULL, ?, ?, 0, ?, ?, ?, ?)',
        )
        .bind(
          `${projectId}:automatic:start`,
          projectId,
          'automatic:start',
          'Empresa',
          'M.0',
          'INÍCIO DO PROJETO',
          'PMO',
          startDate,
          startDate,
          'Não iniciado',
          '',
          'milestone',
          -1,
        ),
    ];
    await db.batch(statements);
    const hubProject = await ensureProjectInBoard(name, color);
    await updateProjectStatus(hubProject.name, normalizeProjectStatus(String(body.status ?? '')));
    if (contractStartDate) await updateContractStartDate(hubProject.code, contractStartDate);
    await db.prepare('UPDATE project_tracking_projects SET project_code = ? WHERE id = ?').bind(hubProject.code, projectId).run();
    if (startDate) await syncScheduleActions();
    return Response.json(
      {
        project: {
          id: projectId,
          name,
          code: hubProject.code,
          templateRevision: template.revision,
          startDate,
          updatedAt: createdAt,
          createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return trackingError(error, 'Não foi possível criar o projeto.');
  }
}

export async function PUT(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const body = (await request.json()) as {
      projectId?: string;
      taskId?: string;
      projectStartDate?: string;
      owner?: string;
      durationDays?: number;
      predecessorId?: string | null;
      startDate?: string;
      endDate?: string;
      actualStartDate?: string;
      actualEndDate?: string;
      linkedActionId?: string | null;
      progress?: number;
      criticality?: string;
      status?: string;
      observation?: string;
    };
    const projectId = body.projectId?.trim() ?? '';
    if (!projectId)
      return Response.json(
        { error: 'Projeto não informado.' },
        { status: 400 },
      );
    const db = getDb();
    const updatedAt = new Date().toISOString();

    if (!body.taskId) {
      const projectStartDate = cleanDate(body.projectStartDate);
      const result = await db
        .prepare(
          'UPDATE project_tracking_projects SET start_date = ?, updated_at = ? WHERE id = ?',
        )
        .bind(projectStartDate, updatedAt, projectId)
        .run();
      if (!result.meta.changes)
        return Response.json(
          { error: 'Projeto não encontrado.' },
          { status: 404 },
        );
      await db
        .prepare(
          "UPDATE project_tracking_project_tasks SET start_date = ?, end_date = ? WHERE project_id = ? AND source_task_id = 'automatic:start'",
        )
        .bind(projectStartDate, projectStartDate, projectId)
        .run();
      return Response.json({ updatedAt });
    }

    const taskId = body.taskId.trim();
    const current = await db
      .prepare(
        'SELECT kind, status, criticality FROM project_tracking_project_tasks WHERE id = ? AND project_id = ?',
      )
      .bind(taskId, projectId)
      .first<{ kind: string; status: string; criticality: string }>();
    if (!current)
      return Response.json(
        { error: 'Atividade não encontrada.' },
        { status: 404 },
      );
    if (current.kind === 'group')
      return Response.json(
        { error: 'As datas de um grupo são consolidadas pelas subtarefas.' },
        { status: 400 },
      );

    let startDate = cleanDate(body.startDate);
    let endDate = cleanDate(body.endDate);
    const actualStartDate = cleanDate(body.actualStartDate);
    const actualEndDate = cleanDate(body.actualEndDate);
    const linkedActionId = body.linkedActionId?.trim() || null;
    const predecessorId = body.predecessorId?.trim() || null;
    let durationDays = Math.max(0, Math.round(Number(body.durationDays ?? 1)));
    if (predecessorId && !startDate) {
      const predecessor = await db
        .prepare(
          'SELECT end_date FROM project_tracking_project_tasks WHERE id = ? AND project_id = ?',
        )
        .bind(predecessorId, projectId)
        .first<{ end_date: string }>();
      if (!predecessor)
        return Response.json(
          { error: 'Predecessora inválida.' },
          { status: 400 },
        );
      if (predecessor.end_date) startDate = addDays(predecessor.end_date, 1);
    }
    if (startDate && endDate) durationDays = daysInclusive(startDate, endDate);
    else if (startDate)
      endDate = addDays(startDate, Math.max(0, durationDays - 1));
    if (startDate && endDate && endDate < startDate)
      return Response.json(
        { error: 'A data de término não pode ser anterior ao início.' },
        { status: 400 },
      );
    let progress = Math.min(
      100,
      Math.max(0, Math.round(Number(body.progress ?? 0))),
    );
    if (actualEndDate) progress = 100;
    else if (actualStartDate && progress === 0) progress = 1;
    const status = (body.status ?? current.status) === 'N/A'
      ? 'N/A'
      : automaticStatus(startDate, endDate, actualStartDate, actualEndDate);
    const criticality = String(body.criticality ?? current.criticality);
    if (!['Baixo', 'Médio', 'Alto', 'Crítico'].includes(criticality))
      return Response.json({ error: 'Criticidade inválida.' }, { status: 400 });

    await db.batch([
      db
        .prepare(
          'UPDATE project_tracking_project_tasks SET owner = ?, criticality = ?, duration_days = ?, predecessor_id = ?, start_date = ?, end_date = ?, actual_start_date = ?, actual_end_date = ?, linked_action_id = ?, progress = ?, status = ?, observation = ? WHERE id = ? AND project_id = ?',
        )
        .bind(
          String(body.owner ?? '').trim(),
          criticality,
          durationDays,
          predecessorId,
          startDate,
          endDate,
          actualStartDate,
          actualEndDate,
          linkedActionId,
          progress,
          status,
          String(body.observation ?? '').trim(),
          taskId,
          projectId,
        ),
      db
        .prepare(
          'UPDATE project_tracking_projects SET updated_at = ? WHERE id = ?',
        )
        .bind(updatedAt, projectId),
      ...(linkedActionId
        ? [
            db
              .prepare('DELETE FROM postit_actions WHERE id = ? AND id != ?')
              .bind(`schedule:${projectId}:${taskId}`, linkedActionId),
          ]
        : []),
    ]);
    const project = await db
      .prepare('SELECT name, project_code FROM project_tracking_projects WHERE id = ?')
      .bind(projectId)
      .first<{ name: string; project_code: string }>();
    if (project) await syncScheduleActions();
    await syncOprFleetsFromSchedules();
    return Response.json({ updatedAt });
  } catch (error) {
    return trackingError(error, 'Não foi possível atualizar o cronograma.');
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const body = (await request.json()) as {
      projectId?: string;
      taskId?: string;
      confirmationName?: string;
    };
    const projectId = body.projectId?.trim() ?? '';
    const taskId = body.taskId?.trim() ?? '';
    const confirmationName = body.confirmationName?.trim() ?? '';
    if (!projectId)
      return Response.json(
        { error: 'Projeto não informado.' },
        { status: 400 },
      );

    const db = getDb();
    const project = await db
      .prepare('SELECT name FROM project_tracking_projects WHERE id = ?')
      .bind(projectId)
      .first<{ name: string }>();
    if (!project)
      return Response.json(
        { error: 'Projeto não encontrado.' },
        { status: 404 },
      );
    if (taskId) {
      const task = await db.prepare(
        "SELECT id FROM project_tracking_project_tasks WHERE id = ? AND project_id = ? AND pillar = 'Equipamentos' AND kind = 'task' AND item GLOB 'EQ.*'",
      ).bind(taskId, projectId).first();
      if (!task) return Response.json({ error: 'Somente equipamentos adicionados ao projeto podem ser excluídos aqui.' }, { status: 400 });
      await db.batch([
        db.prepare('DELETE FROM project_tracking_project_tasks WHERE id = ? AND project_id = ?').bind(taskId, projectId),
        db.prepare('UPDATE project_tracking_projects SET updated_at = ? WHERE id = ?').bind(new Date().toISOString(), projectId),
      ]);
      await syncOprFleetsFromSchedules();
      return Response.json({ deletedTaskId: taskId });
    }
    if (confirmationName !== project.name)
      return Response.json(
        { error: 'Digite o nome exato do projeto para confirmar a exclusão.' },
        { status: 400 },
      );

    await db.batch([
      db
        .prepare(
          'DELETE FROM project_tracking_project_tasks WHERE project_id = ?',
        )
        .bind(projectId),
      db
        .prepare('DELETE FROM project_tracking_projects WHERE id = ?')
        .bind(projectId),
    ]);
    await syncOprFleetsFromSchedules();

    const projectsResult = await db
      .prepare(
        'SELECT id, name, project_code, template_revision, start_date, updated_at, created_at FROM project_tracking_projects ORDER BY created_at DESC, name',
      )
      .all();
    const projects = projectsResult.results.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      code: String(row.project_code || ''),
      templateRevision: Number(row.template_revision),
      startDate: String(row.start_date ?? ''),
      updatedAt: String(row.updated_at ?? ''),
      createdAt: String(row.created_at),
    }));
    return Response.json({ deletedProjectId: projectId, projects });
  } catch (error) {
    return trackingError(error, 'Não foi possível excluir o projeto.');
  }
}
