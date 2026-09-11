CREATE TABLE `postit_action_date_history` (
	`id` text PRIMARY KEY NOT NULL,
	`action_id` text NOT NULL,
	`previous_date` text NOT NULL,
	`new_date` text NOT NULL,
	`changed_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_postit_action_date_history_action_changed` ON `postit_action_date_history` (`action_id`,`changed_at`);