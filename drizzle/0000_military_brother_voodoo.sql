CREATE TABLE `postit_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`observation` text DEFAULT '' NOT NULL,
	`owner` text NOT NULL,
	`action_date` text NOT NULL,
	`board_day` text NOT NULL,
	`sector` text NOT NULL,
	`project` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_postit_actions_sector_day` ON `postit_actions` (`sector`,`board_day`);