import { getDb } from '@/db';

const fallbackColor = '#d8e5e5';
export const projectStatuses = ['Em mobilização', 'Concluído', 'Cancelado'] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export function isProjectStatus(status: string): status is ProjectStatus {
  return projectStatuses.includes(status as ProjectStatus);
}

export function normalizeProjectStatus(status: string): ProjectStatus {
  if (isProjectStatus(status)) return status;
  return status.trim().toLocaleLowerCase('pt-BR') === 'bloqueado' ? 'Cancelado' : 'Em mobilização';
}

export type ProjectRecord = {
  id: string;
  code: string;
  name: string;
  color: string;
  status: string;
  contractStartDate: string;
  createdAt: string;
  updatedAt: string;
};

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

async function nextProjectCode() {
  const year = new Date().getFullYear();
  const current = await getDb()
    .prepare("SELECT code FROM pmo_projects WHERE code GLOB ? ORDER BY code DESC LIMIT 1")
    .bind(`PRJ-${year}-*`)
    .first<{ code: string }>();
  const sequence = current ? Number(current.code.slice(-4)) + 1 : 1;
  return `PRJ-${year}-${String(sequence).padStart(4, '0')}`;
}

export async function findProjectByName(name: string) {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  const row = await getDb()
    .prepare('SELECT id, code, name, color, status, contract_start_date, created_at, updated_at FROM pmo_projects WHERE lower(name) = lower(?)')
    .bind(normalized)
    .first<Record<string, unknown>>();
  return row ? {
    id: String(row.id), code: String(row.code), name: String(row.name),
    color: String(row.color || fallbackColor), status: normalizeProjectStatus(String(row.status || '')), contractStartDate: String(row.contract_start_date || ''), createdAt: String(row.created_at || ''), updatedAt: String(row.updated_at || ''),
  } satisfies ProjectRecord : null;
}

export async function ensureProjectRecord(name: string, color = fallbackColor) {
  const normalized = normalizeName(name);
  if (!normalized) throw new Error('Informe o nome do projeto.');
  const found = await findProjectByName(normalized);
  if (found) return found;
  const record: ProjectRecord = {
    id: crypto.randomUUID(), code: await nextProjectCode(), name: normalized, color, status: 'Em mobilização', contractStartDate: '',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  await getDb().prepare('INSERT INTO pmo_projects (id, code, name, color, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(record.id, record.code, record.name, record.color, record.status, record.createdAt, record.updatedAt).run();
  return record;
}

export async function ensureProjectInBoard(name: string, color = fallbackColor) {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error('Informe o nome do projeto.');
  const project = await ensureProjectRecord(normalized, color);
  await getDb()
    .prepare(
      "INSERT OR IGNORE INTO postit_board_catalog (id, type, name, color, created_at) VALUES (?, 'project', ?, ?, CURRENT_TIMESTAMP)",
    )
    .bind(crypto.randomUUID(), normalized, color)
    .run();
  return project;
}

export async function updateProjectStatus(name: string, status: string) {
  const value = normalizeProjectStatus(status);
  await getDb().prepare('UPDATE pmo_projects SET status = ?, updated_at = ? WHERE lower(name) = lower(?)')
    .bind(value, new Date().toISOString(), name.trim()).run();
}

export async function updateContractStartDate(code: string, date: string) {
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Informe uma data contratual válida.');
  const result = await getDb().prepare('UPDATE pmo_projects SET contract_start_date = ?, updated_at = ? WHERE code = ?')
    .bind(date, new Date().toISOString(), code).run();
  if (!result.meta.changes) throw new Error('Projeto não encontrado.');
}

function bufferDays(contractDate: string, scheduleDate: string) {
  if (!contractDate || !scheduleDate) return null;
  const contractTime = Date.parse(`${contractDate}T00:00:00Z`);
  const scheduleTime = Date.parse(`${scheduleDate}T00:00:00Z`);
  if (!Number.isFinite(contractTime) || !Number.isFinite(scheduleTime)) return null;
  return Math.round((contractTime - scheduleTime) / 86_400_000);
}

export async function ensureProjectRegistry() {
  const db = getDb();
  const [catalog, schedules] = await Promise.all([
    db.prepare("SELECT name, color FROM postit_board_catalog WHERE type = 'project'").all(),
    db.prepare('SELECT name FROM project_tracking_projects').all(),
  ]);
  for (const row of [...catalog.results, ...schedules.results]) {
    await ensureProjectRecord(String(row.name), String(row.color || fallbackColor));
  }
  await db.batch([
    db.prepare("UPDATE pmo_projects SET status = CASE WHEN status IN ('Concluído', 'Cancelado') THEN status WHEN lower(trim(status)) = 'bloqueado' THEN 'Cancelado' ELSE 'Em mobilização' END, updated_at = CURRENT_TIMESTAMP WHERE status NOT IN ('Em mobilização', 'Concluído', 'Cancelado')"),
    db.prepare("UPDATE project_tracking_projects SET project_code = COALESCE((SELECT code FROM pmo_projects WHERE lower(pmo_projects.name) = lower(project_tracking_projects.name)), '') WHERE project_code = ''"),
    db.prepare("UPDATE postit_actions SET project_code = COALESCE((SELECT code FROM pmo_projects WHERE lower(pmo_projects.name) = lower(postit_actions.project)), '') WHERE project_code = ''"),
  ]);
}

export async function readProjectOverview() {
  const db = getDb();
  await ensureProjectRegistry();
  const [projects, schedules, actionCounts, lastScheduleDates, scheduleTasks] = await Promise.all([
    db.prepare('SELECT id, code, name, color, status, contract_start_date, created_at, updated_at FROM pmo_projects ORDER BY created_at DESC, name').all(),
    db.prepare('SELECT id, name, project_code, start_date, created_at, updated_at FROM project_tracking_projects ORDER BY created_at DESC, name').all(),
    db.prepare('SELECT project_code, COUNT(*) AS total, SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) AS open_total FROM postit_actions GROUP BY project_code').all(),
    db.prepare("SELECT project.project_code, MAX(task.end_date) AS last_date FROM project_tracking_projects AS project INNER JOIN project_tracking_project_tasks AS task ON task.project_id = project.id WHERE task.kind != 'group' AND task.status != 'N/A' AND task.end_date != '' GROUP BY project.project_code").all(),
    db.prepare('SELECT project_id, id, parent_id, pillar, kind, progress, status FROM project_tracking_project_tasks').all(),
  ]);
  const schedulesByCode = new Map(
    schedules.results.map((row) => [String(row.project_code), row]),
  );
  const actionsByCode = new Map(
    actionCounts.results.map((row) => [String(row.project_code), row]),
  );
  const lastDateByCode = new Map(lastScheduleDates.results.map((row) => [String(row.project_code), String(row.last_date || '')]));
  const tasksBySchedule = new Map<string, Record<string, unknown>[]>();
  for (const task of scheduleTasks.results) {
    const scheduleId = String(task.project_id);
    tasksBySchedule.set(scheduleId, [...(tasksBySchedule.get(scheduleId) || []), task]);
  }
  return projects.results
    .map((project) => {
      const code = String(project.code);
      const schedule = schedulesByCode.get(code) as Record<string, unknown> | undefined;
      const actions = actionsByCode.get(code) as Record<string, unknown> | undefined;
      const contractStartDate = String(project.contract_start_date || '');
      const lastScheduleDate = lastDateByCode.get(code) || '';
      const scheduleRows = schedule ? tasksBySchedule.get(String(schedule.id)) || [] : [];
      const parentIds = new Set(scheduleRows.map((task) => String(task.parent_id || '')).filter(Boolean));
      const pillarProgress = Object.fromEntries(['Empresa', 'Pessoas', 'Equipamentos'].map((pillar) => {
        const leaves = scheduleRows.filter((task) => task.pillar === pillar && task.kind === 'task' && task.status !== 'N/A' && !parentIds.has(String(task.id)));
        return [pillar, leaves.length
          ? Math.round(leaves.reduce((sum, task) => sum + Number(task.progress || 0), 0) / leaves.length)
          : null];
      }));
      return {
        id: String(project.id), code, name: String(project.name), color: String(project.color || fallbackColor), status: normalizeProjectStatus(String(project.status || '')), createdAt: String(project.created_at || ''),
        scheduleId: schedule ? String(schedule.id) : null,
        startDate: schedule ? String(schedule.start_date || '') : '',
        contractStartDate,
        lastScheduleDate,
        bufferDays: bufferDays(contractStartDate, lastScheduleDate),
        pillarProgress,
        updatedAt: schedule ? String(schedule.updated_at || '') : String(project.updated_at || project.created_at || ''),
        actionCount: Number(actions?.total || 0),
        openActionCount: Number(actions?.open_total || 0),
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name));
}
