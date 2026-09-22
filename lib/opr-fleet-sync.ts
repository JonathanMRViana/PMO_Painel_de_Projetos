import { getDb } from '@/db';

type EquipmentTaskRow = {
  id: string;
  project_code: string;
  project_name: string;
  title: string;
  observation: string;
  start_date: string;
  actual_start_date: string;
};

/** Keeps OPR source data aligned with equipment added in a project schedule. */
export async function syncOprFleetsFromSchedules() {
  const db = getDb();
  const equipment = await db
    .prepare(
      `SELECT task.id, project.project_code, project.name AS project_name,
        task.title, task.observation, task.start_date, task.actual_start_date
      FROM project_tracking_project_tasks AS task
      INNER JOIN project_tracking_projects AS project ON project.id = task.project_id
      WHERE task.pillar = 'Equipamentos'
        AND task.kind = 'task'
        AND task.item GLOB 'EQ.*'`,
    )
    .all<EquipmentTaskRow>();

  const now = new Date().toISOString();
  const statements = equipment.results.map((task) =>
    db
      .prepare(
        `INSERT INTO project_opr_fleets (
          id, project_code, source_task_id, client, fleet, description, planned_date,
          matrix_arrival_date, fleet_definition, basic_kit, maintenance_release,
          configuration, acquisition, adaptations, fleet_documentation, team_definition,
          badge, team_documentation, pgr_pcmso, legal_documents, client_inspection,
          billing, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', '', '', '', '', '', '', '', '', '', '', '', '', ?, ?)
        ON CONFLICT(source_task_id) DO UPDATE SET
          project_code = excluded.project_code,
          client = excluded.client,
          fleet = excluded.fleet,
          description = excluded.description,
          planned_date = excluded.planned_date,
          matrix_arrival_date = excluded.matrix_arrival_date,
          updated_at = excluded.updated_at`,
      )
      .bind(
        crypto.randomUUID(),
        task.project_code,
        task.id,
        task.project_name,
        task.title,
        task.observation,
        task.start_date,
        task.actual_start_date,
        now,
        now,
      ),
  );

  statements.push(
    db.prepare(
      `DELETE FROM project_opr_fleets
       WHERE source_task_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM project_tracking_project_tasks AS task
           WHERE task.id = project_opr_fleets.source_task_id
             AND task.pillar = 'Equipamentos'
             AND task.kind = 'task'
             AND task.item GLOB 'EQ.*'
         )`,
    ),
  );
  if (statements.length) await db.batch(statements);
}
