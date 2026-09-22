CREATE TABLE `pmo_project_scopes` (
	`project_code` text PRIMARY KEY NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
