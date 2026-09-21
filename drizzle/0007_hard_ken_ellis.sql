CREATE TABLE `project_opr_fleets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_code` text NOT NULL,
	`client` text DEFAULT '' NOT NULL,
	`fleet` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`planned_date` text DEFAULT '' NOT NULL,
	`matrix_arrival_date` text DEFAULT '' NOT NULL,
	`fleet_definition` text DEFAULT '' NOT NULL,
	`basic_kit` text DEFAULT '' NOT NULL,
	`maintenance_release` text DEFAULT '' NOT NULL,
	`configuration` text DEFAULT '' NOT NULL,
	`acquisition` text DEFAULT '' NOT NULL,
	`adaptations` text DEFAULT '' NOT NULL,
	`fleet_documentation` text DEFAULT '' NOT NULL,
	`team_definition` text DEFAULT '' NOT NULL,
	`badge` text DEFAULT '' NOT NULL,
	`team_documentation` text DEFAULT '' NOT NULL,
	`pgr_pcmso` text DEFAULT '' NOT NULL,
	`legal_documents` text DEFAULT '' NOT NULL,
	`client_inspection` text DEFAULT '' NOT NULL,
	`billing` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_project_opr_fleets_project` ON `project_opr_fleets` (`project_code`);