import { getDb } from '@/db';

const ownerSectors: Record<string, string> = {
  'Gente e Gestão': 'DP / Gente & Gestão', DP: 'DP / Gente & Gestão', Operação: 'Operação / MKT', Comercial: 'Operação / MKT', MKT: 'Operação / MKT', Técnica: 'Engenharia', Ativos: 'Manutenção', Transportes: 'Operação / MKT',
};
function sectorFor(owner: string) { return ownerSectors[owner] || owner || 'Operação / MKT'; }
function boardDayFor(date: string) {
  const target = new Date(`${date}T12:00:00`), now = new Date(), monday = new Date(now);
  monday.setHours(0, 0, 0, 0); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
  if (target < monday || target > friday) return 'd7';
  return ['seg', 'ter', 'qua', 'qui', 'sex'][target.getDay() - 1] || 'd7';
}
export async function syncScheduleActions(projectId: string, projectName: string, projectCode = '') {
  const db = getDb();
  const tasks = await db.prepare("SELECT id, title, owner, end_date, kind, observation, progress FROM project_tracking_project_tasks WHERE project_id = ? AND kind != 'group' AND owner != '' AND end_date != '' AND linked_action_id IS NULL").bind(projectId).all();
  const statements = tasks.results.flatMap((row) => {
    const owner = String(row.owner || '').trim(), sector = sectorFor(owner), date = String(row.end_date || ''), id = `schedule:${projectId}:${String(row.id)}`;
    return [
      db.prepare("INSERT OR IGNORE INTO postit_board_catalog (id, type, name, color, created_at) VALUES (?, 'sector', ?, NULL, CURRENT_TIMESTAMP)").bind(crypto.randomUUID(), sector),
      db.prepare("INSERT INTO postit_actions (id, title, observation, owner, action_date, board_day, sector, project, project_code, status, criticality, completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Médio', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET title = excluded.title, observation = excluded.observation, owner = excluded.owner, action_date = excluded.action_date, board_day = excluded.board_day, sector = excluded.sector, project = excluded.project, project_code = excluded.project_code, status = excluded.status, completed = excluded.completed, updated_at = CURRENT_TIMESTAMP").bind(id, String(row.title), String(row.observation || ''), owner, date, boardDayFor(date), sector, projectName, projectCode, Number(row.progress) >= 100 ? 'Concluído' : 'No prazo', Number(row.progress) >= 100 ? 1 : 0),
    ];
  });
  if (statements.length) await db.batch(statements);
}
