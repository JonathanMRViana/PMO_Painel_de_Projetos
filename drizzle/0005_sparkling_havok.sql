ALTER TABLE `project_tracking_project_tasks` ADD `predecessor_id` text;--> statement-breakpoint
ALTER TABLE `project_tracking_project_tasks` ADD `start_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_tracking_project_tasks` ADD `end_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_tracking_project_tasks` ADD `progress` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `project_tracking_project_tasks` ADD `status` text DEFAULT 'Não iniciado' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_tracking_project_tasks` ADD `observation` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_tracking_projects` ADD `start_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_tracking_projects` ADD `updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_tracking_settings` ADD `source_version` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_tracking_template_tasks` ADD `predecessor_id` text;