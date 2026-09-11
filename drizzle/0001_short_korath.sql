ALTER TABLE `postit_actions` ADD `criticality` text DEFAULT 'Médio' NOT NULL;--> statement-breakpoint
ALTER TABLE `postit_actions` ADD `completed` integer DEFAULT false NOT NULL;