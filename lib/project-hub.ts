import { getDb } from '@/db';

const fallbackColor = '#d8e5e5';

export async function ensureProjectInBoard(name: string, color = fallbackColor) {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (!normalized) return;
  await getDb()
    .prepare(
      "INSERT OR IGNORE INTO postit_board_catalog (id, type, name, color, created_at) VALUES (?, 'project', ?, ?, CURRENT_TIMESTAMP)",
    )
    .bind(crypto.randomUUID(), normalized, color)
    .run();
}

export async function readProjectOverview() {
  const db = getDb();
  const [catalog, schedules, actionCounts] = await Promise.all([
    db.prepare("SELECT name, color, created_at FROM postit_board_catalog WHERE type = 'project' ORDER BY created_at DESC, name").all(),
    db.prepare('SELECT id, name, start_date, created_at, updated_at FROM project_tracking_projects ORDER BY created_at DESC, name').all(),
    db.prepare('SELECT project, COUNT(*) AS total, SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) AS open_total FROM postit_actions GROUP BY project').all(),
  ]);
  const schedulesByName = new Map(
    schedules.results.map((row) => [String(row.name).toLocaleLowerCase('pt-BR'), row]),
  );
  const actionsByName = new Map(
    actionCounts.results.map((row) => [String(row.project).toLocaleLowerCase('pt-BR'), row]),
  );
  const names = new Map<string, { name: string; color: string; createdAt: string }>();
  catalog.results.forEach((row) => names.set(String(row.name).toLocaleLowerCase('pt-BR'), {
    name: String(row.name),
    color: String(row.color || fallbackColor),
    createdAt: String(row.created_at || ''),
  }));
  schedules.results.forEach((row) => {
    const key = String(row.name).toLocaleLowerCase('pt-BR');
    if (!names.has(key)) names.set(key, { name: String(row.name), color: fallbackColor, createdAt: String(row.created_at || '') });
  });
  return [...names.entries()]
    .map(([key, project]) => {
      const schedule = schedulesByName.get(key) as Record<string, unknown> | undefined;
      const actions = actionsByName.get(key) as Record<string, unknown> | undefined;
      return {
        ...project,
        scheduleId: schedule ? String(schedule.id) : null,
        startDate: schedule ? String(schedule.start_date || '') : '',
        updatedAt: schedule ? String(schedule.updated_at || '') : project.createdAt,
        actionCount: Number(actions?.total || 0),
        openActionCount: Number(actions?.open_total || 0),
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name));
}
