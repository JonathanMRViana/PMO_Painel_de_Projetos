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
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => [index('idx_postit_actions_sector_day').on(table.sector, table.boardDay)],
);
