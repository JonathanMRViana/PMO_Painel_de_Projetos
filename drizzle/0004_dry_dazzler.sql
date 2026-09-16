CREATE TABLE `project_tracking_project_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source_task_id` text NOT NULL,
	`parent_id` text,
	`pillar` text NOT NULL,
	`item` text NOT NULL,
	`title` text NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`duration_days` integer DEFAULT 1 NOT NULL,
	`kind` text DEFAULT 'task' NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_project_tracking_project_tasks_project_order` ON `project_tracking_project_tasks` (`project_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_project_tracking_project_tasks_parent` ON `project_tracking_project_tasks` (`parent_id`);--> statement-breakpoint
CREATE TABLE `project_tracking_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`template_revision` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_project_tracking_projects_name` ON `project_tracking_projects` (`name`);--> statement-breakpoint
CREATE TABLE `project_tracking_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_tracking_template_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`pillar` text NOT NULL,
	`item` text NOT NULL,
	`title` text NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`duration_days` integer DEFAULT 1 NOT NULL,
	`kind` text DEFAULT 'task' NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_project_tracking_template_item` ON `project_tracking_template_tasks` (`item`);--> statement-breakpoint
CREATE INDEX `idx_project_tracking_template_pillar_order` ON `project_tracking_template_tasks` (`pillar`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_project_tracking_template_parent` ON `project_tracking_template_tasks` (`parent_id`);