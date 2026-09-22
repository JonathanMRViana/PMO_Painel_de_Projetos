import { getDb } from '@/db';
import { requireEditor } from '@/lib/editor-auth';
import { syncOprFleetsFromSchedules } from '@/lib/opr-fleet-sync';
import { ensureProjectSchedule } from '@/lib/project-schedule';

const fields = [
  'client', 'fleet', 'description', 'plannedDate', 'matrixArrivalDate',
  'fleetDefinition', 'basicKit', 'maintenanceRelease', 'configuration',
  'acquisition', 'adaptations', 'fleetDocumentation', 'teamDefinition',
  'badge', 'teamDocumentation', 'pgrPcmso', 'legalDocuments',
  'clientInspection', 'billing',
] as const;

type OprBody = Partial<Record<(typeof fields)[number], unknown>> & {
  id?: unknown;
  projectCode?: unknown;
};

const selectColumns = `id, project_code, source_task_id, client, fleet, description, planned_date,
  matrix_arrival_date, fleet_definition, basic_kit, maintenance_release,
  configuration, acquisition, adaptations, fleet_documentation, team_definition,
  badge, team_documentation, pgr_pcmso, legal_documents, client_inspection,
  billing, created_at, updated_at`;

function clean(value: unknown) {
  return String(value ?? '').trim().slice(0, 160);
}

function rowToOpr(row: Record<string, unknown>) {
  return {
    id: String(row.id), projectCode: String(row.project_code), client: String(row.client || ''),
    sourceTaskId: row.source_task_id ? String(row.source_task_id) : null,
    fleet: String(row.fleet || ''), description: String(row.description || ''),
    plannedDate: String(row.planned_date || ''), matrixArrivalDate: String(row.matrix_arrival_date || ''),
    fleetDefinition: String(row.fleet_definition || ''), basicKit: String(row.basic_kit || ''),
    maintenanceRelease: String(row.maintenance_release || ''), configuration: String(row.configuration || ''),
    acquisition: String(row.acquisition || ''), adaptations: String(row.adaptations || ''),
    fleetDocumentation: String(row.fleet_documentation || ''), teamDefinition: String(row.team_definition || ''),
    badge: String(row.badge || ''), teamDocumentation: String(row.team_documentation || ''),
    pgrPcmso: String(row.pgr_pcmso || ''), legalDocuments: String(row.legal_documents || ''),
    clientInspection: String(row.client_inspection || ''), billing: String(row.billing || ''),
    createdAt: String(row.created_at || ''), updatedAt: String(row.updated_at || ''),
  };
}

export async function GET(request: Request) {
  try {
    await syncOprFleetsFromSchedules();
    const projectCode = new URL(request.url).searchParams.get('projeto')?.trim() || '';
    const db = getDb();
    const query = projectCode
      ? db.prepare(`SELECT ${selectColumns} FROM project_opr_fleets WHERE project_code = ? ORDER BY planned_date, fleet`).bind(projectCode)
      : db.prepare(`SELECT ${selectColumns} FROM project_opr_fleets ORDER BY project_code, planned_date, fleet`);
    const result = await query.all();
    return Response.json({ records: result.results.map((row) => rowToOpr(row as Record<string, unknown>)) });
  } catch {
    return Response.json({ error: 'Não foi possível carregar a OPR.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const body = await request.json() as OprBody;
    const projectCode = clean(body.projectCode);
    const fleet = clean(body.fleet);
    if (!projectCode) return Response.json({ error: 'Selecione um projeto.' }, { status: 400 });
    if (!fleet) return Response.json({ error: 'Informe a frota.' }, { status: 400 });
    const values = fields.map((field) => clean(body[field]));
    const db = getDb();
    const project = await ensureProjectSchedule(projectCode);
    const [equipmentRows, parent, order] = await Promise.all([
      db.prepare("SELECT item FROM project_tracking_project_tasks WHERE project_id = ? AND item GLOB 'EQ.*'").bind(project.id).all<{ item: string }>(),
      db.prepare("SELECT id FROM project_tracking_project_tasks WHERE project_id = ? AND pillar = 'Equipamentos' AND kind = 'group' AND upper(title) LIKE '%FROTA%' ORDER BY sort_order LIMIT 1").bind(project.id).first<{ id: string }>(),
      db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS total FROM project_tracking_project_tasks WHERE project_id = ?').bind(project.id).first<{ total: number }>(),
    ]);
    const maxEquipment = equipmentRows.results.reduce((maximum, row) => {
      const number = Number(String(row.item).slice(3));
      return Number.isFinite(number) ? Math.max(maximum, number) : maximum;
    }, 0);
    const taskId = crypto.randomUUID();
    const plannedDate = values[3];
    const matrixArrivalDate = values[4];
    const now = new Date().toISOString();
    await db.prepare(
      'INSERT INTO project_tracking_project_tasks (id, project_id, source_task_id, parent_id, pillar, item, title, owner, duration_days, predecessor_id, start_date, end_date, actual_start_date, actual_end_date, linked_action_id, progress, status, observation, kind, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL, 0, ?, ?, ?, ?)',
    ).bind(
      taskId,
      project.id,
      `manual:${taskId}`,
      parent?.id ?? null,
      'Equipamentos',
      `EQ.${maxEquipment + 1}`,
      fleet,
      'Operação',
      1,
      plannedDate,
      plannedDate,
      matrixArrivalDate,
      '',
      matrixArrivalDate ? 'Em andamento' : 'Não iniciado',
      values[2],
      'task',
      Number(order?.total ?? 0) + 1,
    ).run();
    await db.prepare('UPDATE project_tracking_projects SET updated_at = ? WHERE id = ?').bind(now, project.id).run();
    await syncOprFleetsFromSchedules();
    await db.prepare(`UPDATE project_opr_fleets SET
      fleet_definition = ?, basic_kit = ?, maintenance_release = ?, configuration = ?, acquisition = ?,
      adaptations = ?, fleet_documentation = ?, team_definition = ?, badge = ?, team_documentation = ?,
      pgr_pcmso = ?, legal_documents = ?, client_inspection = ?, billing = ?, updated_at = ?
      WHERE source_task_id = ?`)
      .bind(...values.slice(5), now, taskId).run();
    const record = await db.prepare(`SELECT ${selectColumns} FROM project_opr_fleets WHERE source_task_id = ?`).bind(taskId).first<Record<string, unknown>>();
    return Response.json({ record: rowToOpr(record!) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível salvar a frota.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const body = await request.json() as OprBody;
    const id = clean(body.id);
    const projectCode = clean(body.projectCode);
    const fleet = clean(body.fleet);
    if (!id || !projectCode || !fleet) return Response.json({ error: 'Informe projeto e frota.' }, { status: 400 });
    const db = getDb();
    const existing = await db.prepare('SELECT source_task_id FROM project_opr_fleets WHERE id = ?').bind(id).first<{ source_task_id: string | null }>();
    if (!existing) return Response.json({ error: 'Registro não encontrado.' }, { status: 404 });
    const values = fields.map((field) => clean(body[field]));
    const result = existing.source_task_id
      ? await db.prepare(`UPDATE project_opr_fleets SET
          fleet_definition = ?, basic_kit = ?, maintenance_release = ?, configuration = ?, acquisition = ?,
          adaptations = ?, fleet_documentation = ?, team_definition = ?, badge = ?, team_documentation = ?,
          pgr_pcmso = ?, legal_documents = ?, client_inspection = ?, billing = ?, updated_at = ? WHERE id = ?`)
        .bind(...values.slice(5), new Date().toISOString(), id).run()
      : await db.prepare(`UPDATE project_opr_fleets SET
      project_code = ?, client = ?, fleet = ?, description = ?, planned_date = ?, matrix_arrival_date = ?,
      fleet_definition = ?, basic_kit = ?, maintenance_release = ?, configuration = ?, acquisition = ?,
      adaptations = ?, fleet_documentation = ?, team_definition = ?, badge = ?, team_documentation = ?,
      pgr_pcmso = ?, legal_documents = ?, client_inspection = ?, billing = ?, updated_at = ? WHERE id = ?`)
      .bind(projectCode, ...values, new Date().toISOString(), id).run();
    if (!result.meta.changes) return Response.json({ error: 'Registro não encontrado.' }, { status: 404 });
    const record = await getDb().prepare(`SELECT ${selectColumns} FROM project_opr_fleets WHERE id = ?`).bind(id).first<Record<string, unknown>>();
    return Response.json({ record: rowToOpr(record!) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar a frota.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const id = clean((await request.json() as OprBody).id);
    if (!id) return Response.json({ error: 'Registro não informado.' }, { status: 400 });
    const db = getDb();
    const existing = await db.prepare('SELECT source_task_id FROM project_opr_fleets WHERE id = ?').bind(id).first<{ source_task_id: string | null }>();
    if (existing?.source_task_id)
      return Response.json({ error: 'Esta frota é controlada pelo cronograma. Exclua o equipamento no projeto.' }, { status: 400 });
    await db.prepare('DELETE FROM project_opr_fleets WHERE id = ?').bind(id).run();
    return Response.json({ deletedId: id });
  } catch {
    return Response.json({ error: 'Não foi possível excluir a frota.' }, { status: 500 });
  }
}
