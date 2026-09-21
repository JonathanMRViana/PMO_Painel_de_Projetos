ALTER TABLE `project_tracking_project_tasks` ADD `actual_start_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_tracking_project_tasks` ADD `actual_end_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_tracking_project_tasks` ADD `linked_action_id` text;