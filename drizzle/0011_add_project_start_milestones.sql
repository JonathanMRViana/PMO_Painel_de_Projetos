INSERT INTO `project_tracking_project_tasks` (
  `id`, `project_id`, `source_task_id`, `parent_id`, `pillar`, `item`, `title`, `owner`,
  `duration_days`, `predecessor_id`, `start_date`, `end_date`, `actual_start_date`, `actual_end_date`,
  `linked_action_id`, `progress`, `status`, `observation`, `kind`, `sort_order`
)
SELECT
  `id` || ':automatic:start', `id`, 'automatic:start', NULL, 'Empresa', 'M.0', 'INÍCIO DO PROJETO', 'PMO',
  0, NULL, `start_date`, `start_date`, '', '', NULL, 0, 'Não iniciado', '', 'milestone', -1
FROM `project_tracking_projects`
WHERE NOT EXISTS (
  SELECT 1
  FROM `project_tracking_project_tasks`
  WHERE `project_tracking_project_tasks`.`project_id` = `project_tracking_projects`.`id`
    AND `project_tracking_project_tasks`.`source_task_id` = 'automatic:start'
);
