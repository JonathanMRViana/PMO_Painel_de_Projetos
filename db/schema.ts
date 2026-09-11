import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
  (table) => [index('idx_postit_action_date_history_action_changed').on(table.actionId, table.changedAt)],
);
