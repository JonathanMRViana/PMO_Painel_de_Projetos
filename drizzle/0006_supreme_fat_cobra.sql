CREATE TABLE `pmo_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#d8e5e5' NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_pmo_projects_code` ON `pmo_projects` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_pmo_projects_name` ON `pmo_projects` (`name`);--> statement-breakpoint
ALTER TABLE `postit_actions` ADD `project_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_tracking_projects` ADD `project_code` text DEFAULT '' NOT NULL;