CREATE TABLE `postit_board_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_postit_board_catalog_type_name` ON `postit_board_catalog` (`type`,`name`);