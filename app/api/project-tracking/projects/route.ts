import { getDb } from '@/db';
import { requireEditor } from '@/lib/editor-auth';
import {
  readStandardTemplate,
  rowToTrackingTask,
  trackingError,
} from '@/lib/project-tracking-db';

export async function GET(request: Request) {
  try {
    const db = getDb();
    const projectId = new URL(request.url).searchParams.get('id');
    const projectsResult = await db
      .prepare(
        'SELECT id, name, template_revision, created_at FROM project_tracking_projects ORDER BY created_at DESC, name',
      )
      .all();
    const projects = projectsResult.results.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      templateRevision: Number(row.template_revision),
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
        'SELECT id, parent_id, pillar, item, title, owner, duration_days, kind, sort_order FROM project_tracking_project_tasks WHERE project_id = ? ORDER BY sort_order, item',
      )
      .bind(projectId)
      .all();
    return Response.json({
      projects,
      project: selected,
      tasks: tasks.results.map((row) =>
        rowToTrackingTask(row as Record<string, unknown>),
      ),
    });
  } catch (error) {
    return trackingError(error, 'Não foi possível carregar os projetos.');
  }
}

export async function POST(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim().replace(/\s+/g, ' ') ?? '';
    if (name.length < 2 || name.length > 80)
      return Response.json(
        { error: 'Informe um nome de projeto entre 2 e 80 caracteres.' },
        { status: 400 },
      );

    const template = await readStandardTemplate();
    const db = getDb();
    const projectId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const statements = [
      db
        .prepare(
          'INSERT INTO project_tracking_projects (id, name, template_revision, created_at) VALUES (?, ?, ?, ?)',
        )
        .bind(projectId, name, template.revision, createdAt),
      ...template.tasks.map((task) =>
        db
          .prepare(
            'INSERT INTO project_tracking_project_tasks (id, project_id, source_task_id, parent_id, pillar, item, title, owner, duration_days, kind, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
            task.durationDays,
            task.kind,
            task.sortOrder,
          ),
      ),
    ];
    await db.batch(statements);
    return Response.json(
      {
        project: {
          id: projectId,
          name,
          templateRevision: template.revision,
          createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return trackingError(error, 'Não foi possível criar o projeto.');
  }
}
