import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const postitActions = sqliteTable(
  'postit_actions',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    observation: text('observation').notNull().default(''),
    owner: text('owner').notNull(),
    actionDate: text('action_date').notNull(),
    boardDay: text('board_day').notNull(),
    sector: text('sector').notNull(),
    project: text('project').notNull(),
    projectCode: text('project_code').notNull().default(''),
    status: text('status').notNull(),
    criticality: text('criticality').notNull().default('Médio'),
    completed: integer('completed', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => [
    index('idx_postit_actions_sector_day').on(table.sector, table.boardDay),
  ],
);

export const postitBoardCatalog = sqliteTable(
  'postit_board_catalog',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => [
    index('idx_postit_board_catalog_type_name').on(table.type, table.name),
  ],
);

export const postitActionDateHistory = sqliteTable(
  'postit_action_date_history',
  {
    id: text('id').primaryKey(),
    actionId: text('action_id').notNull(),
    previousDate: text('previous_date').notNull(),
    newDate: text('new_date').notNull(),
    changedAt: text('changed_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => [
    index('idx_postit_action_date_history_action_changed').on(
      table.actionId,
      table.changedAt,
    ),
  ],
);

export const projectTrackingSettings = sqliteTable(
  'project_tracking_settings',
  {
    id: text('id').primaryKey(),
    revision: integer('revision').notNull().default(1),
    sourceVersion: text('source_version').notNull().default('legacy'),
    updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  },
);

export const projectTrackingTemplateTasks = sqliteTable(
  'project_tracking_template_tasks',
  {
    id: text('id').primaryKey(),
    parentId: text('parent_id'),
    pillar: text('pillar').notNull(),
    item: text('item').notNull(),
    title: text('title').notNull(),
    owner: text('owner').notNull().default(''),
    durationDays: integer('duration_days').notNull().default(1),
    predecessorId: text('predecessor_id'),
    kind: text('kind').notNull().default('task'),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => [
    uniqueIndex('idx_project_tracking_template_item').on(table.item),
    index('idx_project_tracking_template_pillar_order').on(
      table.pillar,
      table.sortOrder,
    ),
    index('idx_project_tracking_template_parent').on(table.parentId),
  ],
);

export const projectTrackingProjects = sqliteTable(
  'project_tracking_projects',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    projectCode: text('project_code').notNull().default(''),
    templateRevision: integer('template_revision').notNull(),
    startDate: text('start_date').notNull().default(''),
    updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => [uniqueIndex('idx_project_tracking_projects_name').on(table.name)],
);

export const pmoProjects = sqliteTable(
  'pmo_projects',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#d8e5e5'),
    status: text('status').notNull().default('Planejamento'),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => [
    uniqueIndex('idx_pmo_projects_code').on(table.code),
    uniqueIndex('idx_pmo_projects_name').on(table.name),
  ],
);

export const projectOprFleets = sqliteTable(
  'project_opr_fleets',
  {
    id: text('id').primaryKey(),
    projectCode: text('project_code').notNull(),
    client: text('client').notNull().default(''),
    fleet: text('fleet').notNull().default(''),
    description: text('description').notNull().default(''),
    plannedDate: text('planned_date').notNull().default(''),
    matrixArrivalDate: text('matrix_arrival_date').notNull().default(''),
    fleetDefinition: text('fleet_definition').notNull().default(''),
    basicKit: text('basic_kit').notNull().default(''),
    maintenanceRelease: text('maintenance_release').notNull().default(''),
    configuration: text('configuration').notNull().default(''),
    acquisition: text('acquisition').notNull().default(''),
    adaptations: text('adaptations').notNull().default(''),
    fleetDocumentation: text('fleet_documentation').notNull().default(''),
    teamDefinition: text('team_definition').notNull().default(''),
    badge: text('badge').notNull().default(''),
    teamDocumentation: text('team_documentation').notNull().default(''),
    pgrPcmso: text('pgr_pcmso').notNull().default(''),
    legalDocuments: text('legal_documents').notNull().default(''),
    clientInspection: text('client_inspection').notNull().default(''),
    billing: text('billing').notNull().default(''),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => [
    index('idx_project_opr_fleets_project').on(table.projectCode),
  ],
);

export const projectTrackingProjectTasks = sqliteTable(
  'project_tracking_project_tasks',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    sourceTaskId: text('source_task_id').notNull(),
    parentId: text('parent_id'),
    pillar: text('pillar').notNull(),
    item: text('item').notNull(),
    title: text('title').notNull(),
    owner: text('owner').notNull().default(''),
    durationDays: integer('duration_days').notNull().default(1),
    predecessorId: text('predecessor_id'),
    startDate: text('start_date').notNull().default(''),
    endDate: text('end_date').notNull().default(''),
    actualStartDate: text('actual_start_date').notNull().default(''),
    actualEndDate: text('actual_end_date').notNull().default(''),
    linkedActionId: text('linked_action_id'),
    progress: integer('progress').notNull().default(0),
    status: text('status').notNull().default('Não iniciado'),
    observation: text('observation').notNull().default(''),
    kind: text('kind').notNull().default('task'),
    sortOrder: integer('sort_order').notNull(),
  },
  (table) => [
    index('idx_project_tracking_project_tasks_project_order').on(
      table.projectId,
      table.sortOrder,
    ),
    index('idx_project_tracking_project_tasks_parent').on(table.parentId),
  ],
);
