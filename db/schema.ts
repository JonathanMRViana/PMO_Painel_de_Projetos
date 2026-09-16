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
    templateRevision: integer('template_revision').notNull(),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => [uniqueIndex('idx_project_tracking_projects_name').on(table.name)],
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
