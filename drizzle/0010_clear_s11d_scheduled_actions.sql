DELETE FROM `postit_action_date_history`
WHERE `action_id` LIKE 'schedule:b021f200-8978-4813-865d-5efaef52f58b:%';
--> statement-breakpoint
DELETE FROM `postit_actions`
WHERE `id` LIKE 'schedule:b021f200-8978-4813-865d-5efaef52f58b:%';
