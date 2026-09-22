ALTER TABLE `project_opr_fleets` ADD `source_task_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_project_opr_fleets_source_task` ON `project_opr_fleets` (`source_task_id`);
