'use client';
import '@/lib/github-pages-api';
import { redirectToOfficialEditor } from '@/lib/github-pages-api';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronRight,
  HardHat,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Star,
  Table2,
  Trash2,
  Truck,
} from 'lucide-react';
import { PmoToolHeader } from '@/components/pmo-tool-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Pillar = 'Empresa' | 'Pessoas' | 'Equipamentos';
type TaskKind = 'group' | 'task' | 'milestone';
type Criticality = 'Baixo' | 'Médio' | 'Alto' | 'Crítico';
const criticalities: Criticality[] = ['Baixo', 'Médio', 'Alto', 'Crítico'];
type Task = {
  id: string;
  parentId: string | null;
  pillar: Pillar;
  item: string;
  title: string;
  owner: string;
  criticality: Criticality;
  durationDays: number;
  predecessorId: string | null;
  startDate: string;
  endDate: string;
  actualStartDate: string;
  actualEndDate: string;
  linkedActionId: string | null;
  progress: number;
  status: string;
  observation: string;
  kind: TaskKind;
  sortOrder: number;
};
type Project = {
  id: string;
  name: string;
  code: string;
  templateRevision: number;
  startDate: string;
  updatedAt: string;
  createdAt: string;
};
type BoardAction = {
  id: string;
  title: string;
  actionDate: string;
  completed: boolean;
};
type LinkedActionDraft = {
  task: Task;
  title: string;
  observation: string;
  owner: string;
  date: string;
  sector: string;
  criticality: 'Baixo' | 'Médio' | 'Alto' | 'Crítico';
};
type TaskDraft = Pick<
  Task,
  | 'id'
  | 'pillar'
  | 'item'
  | 'title'
  | 'owner'
  | 'criticality'
  | 'durationDays'
  | 'kind'
  | 'startDate'
  | 'endDate'
> & { parentId: string; predecessorId: string };

const pillarMeta: Record<
  Pillar,
  { icon: typeof Building2; accent: string; soft: string }
> = {
  Empresa: { icon: Building2, accent: '#103f85', soft: '#edf2fb' },
  Pessoas: { icon: HardHat, accent: '#548235', soft: '#eef6e9' },
  Equipamentos: { icon: Truck, accent: '#c65911', soft: '#fff2e8' },
};
const emptyDraft: TaskDraft = {
  id: '',
  parentId: '',
  predecessorId: '',
  pillar: 'Empresa',
  item: '',
  title: '',
  owner: '',
  criticality: 'Médio',
  durationDays: 1,
  kind: 'task',
  startDate: '',
  endDate: '',
};

async function json<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(body.error || 'Não foi possível concluir a operação.');
  return body;
}

function taskDepth(task: Task, map: Map<string, Task>) {
  let depth = 0;
  let parent = task.parentId ? map.get(task.parentId) : undefined;
  while (parent && depth < 5) {
    depth += 1;
    parent = parent.parentId ? map.get(parent.parentId) : undefined;
  }
  return depth;
}

function formatDate(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(
    new Date(`${value}T12:00:00Z`),
  );
}

function automaticTaskStatus(task: Pick<Task, 'startDate' | 'endDate' | 'actualStartDate' | 'actualEndDate'>) {
  if (task.actualEndDate) return 'Concluído';
  const today = new Date().toISOString().slice(0, 10);
  if (task.actualStartDate)
    return task.endDate && task.endDate < today ? 'Atrasado' : 'Em andamento';
  if (!task.startDate && !task.endDate) return 'Não planejado';
  return task.endDate && task.endDate < today ? 'Atrasado' : 'Não iniciado';
}

function hiddenByCollapsedGroup(task: Task, map: Map<string, Task>, collapsedGroups: Set<string>) {
  let parentId = task.parentId;
  while (parentId) {
    if (collapsedGroups.has(parentId)) return true;
    parentId = map.get(parentId)?.parentId ?? null;
  }
  return false;
}

function boardDay(date: string) {
  if (!date) return 'd7';
  const due = new Date(`${date}T12:00:00`);
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const distance = Math.round((due.getTime() - monday.getTime()) / 86_400_000);
  if (distance < 0 || distance > 4) return 'd7';
  return (['seg', 'ter', 'qua', 'qui', 'sex'][distance] ?? 'd7');
}

function defaultSectorFor(task: Task) {
  if (task.pillar === 'Pessoas') return 'DP / Gente & Gestão';
  if (task.pillar === 'Equipamentos') return 'Manutenção';
  return 'Engenharia';
}

function withGroupSummaries(tasks: Task[]) {
  const children = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.parentId) continue;
    children.set(task.parentId, [...(children.get(task.parentId) ?? []), task]);
  }
  const descendants = (id: string): Task[] =>
    (children.get(id) ?? []).flatMap((child) =>
      child.kind === 'group' ? descendants(child.id) : [child],
    );
  return tasks.map((task) => {
    if (task.kind !== 'group') return task;
    const leaves = descendants(task.id).filter((child) => child.status !== 'N/A');
    const allNotApplicable = descendants(task.id).length > 0 && leaves.length === 0;
    const starts = leaves
      .map((child) => child.startDate)
      .filter(Boolean)
      .sort();
    const ends = leaves
      .map((child) => child.endDate)
      .filter(Boolean)
      .sort();
    const actualStarts = leaves
      .map((child) => child.actualStartDate)
      .filter(Boolean)
      .sort();
    const actualEnds = leaves
      .map((child) => child.actualEndDate)
      .filter(Boolean)
      .sort();
    const progress = leaves.length
      ? Math.round(
          leaves.reduce((sum, child) => sum + child.progress, 0) /
            leaves.length,
        )
      : 0;
    return {
      ...task,
      startDate: starts[0] ?? '',
      endDate: ends.at(-1) ?? '',
      actualStartDate: actualStarts[0] ?? '',
      actualEndDate: actualEnds.at(-1) ?? '',
      progress,
      status: allNotApplicable ? 'N/A' : automaticTaskStatus({
        startDate: starts[0] ?? '',
        endDate: ends.at(-1) ?? '',
        actualStartDate: actualStarts[0] ?? '',
        actualEndDate: actualEnds.at(-1) ?? '',
      }),
    };
  });
}

export function TrackingClient() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<'projects' | 'template'>('projects');
  const [projectMode, setProjectMode] = useState<'schedule' | 'gantt'>(
    'schedule',
  );
  const [collapsedPillars, setCollapsedPillars] = useState<Set<Pillar>>(
    new Set(),
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [templateTasks, setTemplateTasks] = useState<Task[]>([]);
  const [revision, setRevision] = useState(1);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [projectActions, setProjectActions] = useState<BoardAction[]>([]);
  const [boardSectors, setBoardSectors] = useState<string[]>([]);
  const [isEditor, setIsEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<
    'project' | 'task' | 'schedule' | 'deleteProject' | null
  >(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectStartDate, setProjectStartDate] = useState('');
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogPurpose, setTaskDialogPurpose] = useState<
    'activity' | 'equipment' | 'milestone'
  >('activity');
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(emptyDraft);
  const [taskTarget, setTaskTarget] = useState<'template' | 'project'>(
    'template',
  );
  const [linkedActionDraft, setLinkedActionDraft] =
    useState<LinkedActionDraft | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [deleteProjectConfirmation, setDeleteProjectConfirmation] =
    useState('');

  const loadProject = useCallback(async (id: string) => {
    if (!id) {
      setSelectedProject(null);
      setProjectTasks([]);
      setProjectActions([]);
      return;
    }
    const data = await json<{
      project: Project;
      projects: Project[];
      tasks: Task[];
      actions: BoardAction[];
    }>(
      await fetch(
        `/api/project-tracking/projects?id=${encodeURIComponent(id)}`,
        {
          cache: 'no-store',
        },
      ),
    );
    setProjects(data.projects);
    setSelectedProject(data.project);
    setProjectStartDate(data.project.startDate);
    setProjectTasks(data.tasks);
    setProjectActions(data.actions ?? []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [template, projectData, session, catalog] = await Promise.all([
        json<{ revision: number; tasks: Task[] }>(
          await fetch('/api/project-tracking/template', { cache: 'no-store' }),
        ),
        json<{ projects: Project[] }>(
          await fetch('/api/project-tracking/projects', { cache: 'no-store' }),
        ),
        json<{ authenticated: boolean }>(
          await fetch('/api/editor-session', { cache: 'no-store' }),
        ),
        json<{ sectors: Array<{ name: string }> }>(
          await fetch('/api/postit-catalog', { cache: 'no-store' }),
        ),
      ]);
      setTemplateTasks(template.tasks);
      setRevision(template.revision);
      setProjects(projectData.projects);
      setIsEditor(session.authenticated);
      setBoardSectors(catalog.sectors.map((sector) => sector.name));
      const next =
        projectData.projects.find((project) => project.id === selectedProjectId)
          ?.id ??
        projectData.projects[0]?.id ??
        '';
      setSelectedProjectId(next);
      await loadProject(next);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível carregar o acompanhamento.',
      );
    } finally {
      setLoading(false);
    }
  }, [loadProject, selectedProjectId]);

  useEffect(() => {
    void loadAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const projectId = searchParams.get('projeto')?.trim();
    const newProject = searchParams.get('novo')?.trim();
    if (projectId && projects.some((project) => project.id === projectId)) {
      setSelectedProjectId(projectId);
      void loadProject(projectId);
    }
    if (newProject && isEditor && !projects.some((project) => project.name.toLocaleLowerCase('pt-BR') === newProject.toLocaleLowerCase('pt-BR'))) {
      setProjectName(newProject);
      setProjectDialogOpen(true);
    }
  }, [isEditor, loadProject, projects, searchParams]);

  const displayProjectTasks = useMemo(
    () => withGroupSummaries(projectTasks),
    [projectTasks],
  );
  const visibleTasks =
    view === 'template' ? templateTasks : displayProjectTasks;
  const counts = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(pillarMeta) as Pillar[]).map((pillar) => [
          pillar,
          visibleTasks.filter(
            (task) => task.pillar === pillar && task.kind !== 'group' && task.status !== 'N/A',
          ).length,
        ]),
      ) as Record<Pillar, number>,
    [visibleTasks],
  );
  const progressByPillar = useMemo(() => {
    const parentIds = new Set(visibleTasks.map((task) => task.parentId).filter(Boolean));
    return Object.fromEntries(
      (Object.keys(pillarMeta) as Pillar[]).map((pillar) => {
        const leaves = visibleTasks.filter(
          (task) => task.pillar === pillar && task.kind === 'task' && task.status !== 'N/A' && !parentIds.has(task.id),
        );
        return [
          pillar,
          leaves.length
            ? Math.round(leaves.reduce((total, task) => total + task.progress, 0) / leaves.length)
            : null,
        ];
      }),
    ) as Record<Pillar, number | null>;
  }, [visibleTasks]);

  function openNewTask(parent?: Task) {
    setTaskDialogPurpose('activity');
    setTaskTarget('template');
    setTaskDraft({
      ...emptyDraft,
      pillar: parent?.pillar ?? 'Empresa',
      parentId: parent?.id ?? '',
    });
    setTaskDialogOpen(true);
  }

  function openNewProjectTask(parent?: Task) {
    setTaskDialogPurpose('activity');
    setTaskTarget('project');
    setTaskDraft({
      ...emptyDraft,
      pillar: parent?.pillar ?? 'Empresa',
      parentId: parent?.id ?? '',
    });
    setTaskDialogOpen(true);
  }

  function nextProjectItem(prefix: 'EQ' | 'M') {
    const total = projectTasks.filter((task) =>
      new RegExp(`^${prefix}\\.\\d+$`).test(task.item),
    ).length;
    return `${prefix}.${total + 1}`;
  }

  function openNewEquipment() {
    if (!selectedProject) return;
    setTaskDialogPurpose('equipment');
    setTaskTarget('project');
    setTaskDraft({
      ...emptyDraft,
      pillar: 'Equipamentos',
      item: nextProjectItem('EQ'),
      title: '',
      durationDays: 1,
      startDate: selectedProject.startDate,
      endDate: selectedProject.startDate,
    });
    setTaskDialogOpen(true);
  }

  function openNewMilestone() {
    if (!selectedProject) return;
    setTaskDialogPurpose('milestone');
    setTaskTarget('project');
    setTaskDraft({
      ...emptyDraft,
      pillar: 'Empresa',
      item: nextProjectItem('M'),
      title: '',
      durationDays: 0,
      kind: 'milestone',
      startDate: selectedProject.startDate,
      endDate: selectedProject.startDate,
    });
    setTaskDialogOpen(true);
  }

  function togglePillar(pillar: Pillar) {
    setCollapsedPillars((current) => {
      const next = new Set(current);
      if (next.has(pillar)) next.delete(pillar);
      else next.add(pillar);
      return next;
    });
  }

  function toggleGroup(id: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openDeleteProject(project: Project) {
    setDeleteProjectConfirmation('');
    setDeleteProject(project);
  }

  function requireAccess(
    action: 'project' | 'task' | 'schedule' | 'deleteProject',
  ) {
    if (redirectToOfficialEditor()) return;
    if (isEditor) {
      if (action === 'project') setProjectDialogOpen(true);
      if (action === 'task')
        view === 'projects' ? openNewProjectTask() : openNewTask();
      if (action === 'deleteProject' && selectedProject)
        openDeleteProject(selectedProject);
      return;
    }
    setPendingAction(action);
    setAuthOpen(true);
  }

  async function authenticate() {
    setSaving(true);
    setError('');
    try {
      await json(
        await fetch('/api/editor-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        }),
      );
      setIsEditor(true);
      setAuthOpen(false);
      setPassword('');
      if (pendingAction === 'project') setProjectDialogOpen(true);
      if (pendingAction === 'task')
        view === 'projects' ? openNewProjectTask() : openNewTask();
      if (pendingAction === 'deleteProject' && selectedProject)
        openDeleteProject(selectedProject);
      setPendingAction(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Senha inválida.');
    } finally {
      setSaving(false);
    }
  }

  async function createProject() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const data = await json<{ project: Project }>(
        await fetch('/api/project-tracking/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: projectName,
            startDate: projectStartDate,
          }),
        }),
      );
      setProjectDialogOpen(false);
      setProjectName('');
      setProjects((current) => [data.project, ...current]);
      setSelectedProjectId(data.project.id);
      await loadProject(data.project.id);
      setView('projects');
      setNotice(`Projeto ${data.project.name} criado com cronograma padrão.`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível criar o projeto.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveProjectStart() {
    if (!selectedProject) return;
    setSaving(true);
    setError('');
    try {
      await json(
        await fetch('/api/project-tracking/projects', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: selectedProject.id,
            projectStartDate,
          }),
        }),
      );
      await loadProject(selectedProject.id);
      setNotice('Data inicial do projeto salva automaticamente.');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível salvar a data.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function importS11dSchedule() {
    if (!selectedProject || !window.confirm(
      'Aplicar ao S11D as atividades e datas do cronograma enviado? Atividades já editadas ou vinculadas a ações serão preservadas.',
    )) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await json<{ imported: number; fleets: number }>(
        await fetch('/api/project-tracking/import-s11d', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: selectedProject.id }),
        }),
      );
      await loadProject(selectedProject.id);
      setNotice(`Cronograma S11D importado: ${result.imported} linhas e ${result.fleets} frotas.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível importar o cronograma S11D.');
    } finally {
      setSaving(false);
    }
  }

  function patchProjectTask(id: string, changes: Partial<Task>) {
    setProjectTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, ...changes } : task)),
    );
  }

  async function saveProjectTask(task: Task) {
    if (!selectedProject) return;
    setError('');
    setNotice('');
    try {
      await json(
        await fetch('/api/project-tracking/projects', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: selectedProject.id,
            taskId: task.id,
            ...task,
          }),
        }),
      );
      await loadProject(selectedProject.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível salvar a atividade.',
      );
    }
  }

  async function deleteProjectEquipment(task: Task) {
    if (!selectedProject || !window.confirm(`Excluir o equipamento “${task.title}”? A frota vinculada também será removida da OPR.`)) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await json(
        await fetch('/api/project-tracking/projects', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: selectedProject.id, taskId: task.id }),
        }),
      );
      await loadProject(selectedProject.id);
      setNotice('Equipamento removido do cronograma e da OPR.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível excluir o equipamento.');
    } finally {
      setSaving(false);
    }
  }

  function openCreateLinkedAction(task: Task) {
    setLinkedActionDraft({
      task,
      title: task.title,
      observation: task.observation,
      owner: task.owner,
      date: task.endDate,
      sector: defaultSectorFor(task),
      criticality: 'Médio',
    });
  }

  async function createLinkedAction() {
    if (!selectedProject || !linkedActionDraft) return;
    const draft = linkedActionDraft;
    if (!draft.title.trim() || !draft.owner.trim() || !draft.date || !draft.sector)
      return setError('Informe título, responsável, prazo previsto e setor da ação.');
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const created = await json<{ action: { id: string } }>(
        await fetch('/api/postit-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: crypto.randomUUID(),
            title: draft.title,
            observation: draft.observation,
            owner: draft.owner,
            date: draft.date,
            day: boardDay(draft.date),
            sector: draft.sector,
            project: selectedProject.name,
            criticality: draft.criticality,
            completed: false,
          }),
        }),
      );
      await json(
        await fetch('/api/project-tracking/projects', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: selectedProject.id,
            taskId: draft.task.id,
            ...draft.task,
            linkedActionId: created.action.id,
          }),
        }),
      );
      setLinkedActionDraft(null);
      await loadProject(selectedProject.id);
      setNotice('Ação criada no quadro e vinculada à tarefa do cronograma.');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível criar a ação vinculada.',
      );
    } finally {
      setSaving(false);
    }
  }

  function openEditTask(task: Task) {
    setTaskTarget('template');
    setTaskDraft({
      id: task.id,
      parentId: task.parentId ?? '',
      predecessorId: task.predecessorId ?? '',
      pillar: task.pillar,
      item: task.item,
      title: task.title,
      owner: task.owner,
      criticality: task.criticality,
      durationDays: task.durationDays,
      kind: task.kind,
      startDate: task.startDate,
      endDate: task.endDate,
    });
    setTaskDialogOpen(true);
  }

  async function saveTask() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (taskTarget === 'project') {
        if (!selectedProject) throw new Error('Selecione um projeto.');
        await json(
          await fetch('/api/project-tracking/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...taskDraft,
              projectId: selectedProject.id,
              parentId: taskDraft.parentId || null,
              predecessorId: taskDraft.predecessorId || null,
            }),
          }),
        );
        setTaskDialogOpen(false);
        await loadProject(selectedProject.id);
        setNotice(
          taskDraft.kind === 'milestone'
            ? 'Marco adicionado ao cronograma do projeto.'
            : 'Atividade adicionada ao cronograma do projeto.',
        );
        return;
      }
      const method = taskDraft.id ? 'PUT' : 'POST';
      const data = await json<{ revision: number; tasks: Task[] }>(
        await fetch('/api/project-tracking/template', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...taskDraft,
            parentId: taskDraft.parentId || null,
            predecessorId: taskDraft.predecessorId || null,
          }),
        }),
      );
      setTemplateTasks(data.tasks);
      setRevision(data.revision);
      setTaskDialogOpen(false);
      setNotice(
        taskDraft.id
          ? 'Atividade atualizada no padrão.'
          : 'Atividade adicionada ao padrão.',
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível salvar a atividade.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTask) return;
    setSaving(true);
    setError('');
    try {
      const data = await json<{ revision: number; tasks: Task[] }>(
        await fetch('/api/project-tracking/template', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: deleteTask.id }),
        }),
      );
      setTemplateTasks(data.tasks);
      setRevision(data.revision);
      setDeleteTask(null);
      setNotice(
        'Atividade removida do padrão. Projetos existentes permanecem inalterados.',
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível excluir a atividade.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteProject() {
    if (!deleteProject) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const data = await json<{ projects: Project[] }>(
        await fetch('/api/project-tracking/projects', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: deleteProject.id,
            confirmationName: deleteProjectConfirmation,
          }),
        }),
      );
      const nextProjectId = data.projects[0]?.id ?? '';
      setProjects(data.projects);
      setSelectedProjectId(nextProjectId);
      setDeleteProject(null);
      setDeleteProjectConfirmation('');
      if (nextProjectId) await loadProject(nextProjectId);
      else {
        setSelectedProject(null);
        setProjectTasks([]);
        setProjectStartDate('');
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível excluir o projeto.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function selectProject(id: string) {
    setSelectedProjectId(id);
    setError('');
    try {
      await loadProject(id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível abrir o projeto.',
      );
    }
  }

  const draftTasks = taskTarget === 'project' ? projectTasks : templateTasks;
  const parentChoices = draftTasks.filter(
    (task) => task.pillar === taskDraft.pillar && task.id !== taskDraft.id,
  );
  const predecessorChoices = draftTasks.filter(
    (task) => task.kind !== 'group' && task.id !== taskDraft.id,
  );

  return (
    <main className="min-h-screen bg-[#f4f6f7] text-slate-900">
      <PmoToolHeader title="Cronograma padrão de projetos" subtitle="Acompanhamento geral de projetos" backHref="/">
        {isEditor ? (
          <Button size="lg" onClick={() => requireAccess('project')}><Plus /> Novo projeto</Button>
        ) : (
          <Button size="lg" variant="outline" onClick={() => requireAccess('project')}><KeyRound /> Acessar edição</Button>
        )}
      </PmoToolHeader>

      <div className="mx-auto w-full max-w-none px-3 py-7 sm:px-5">
        <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#ed1c24]">
              Estrutura corporativa
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Cronograma padrão de projetos
            </h1>
          </div>
          <div
            className="flex w-fit rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
            role="tablist"
            aria-label="Área de acompanhamento"
          >
            <button
              onClick={() => setView('projects')}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${view === 'projects' ? 'bg-[#103f85] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Projetos
            </button>
            <button
              onClick={() => setView('template')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${view === 'template' ? 'bg-[#103f85] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Settings2 size={16} /> Padrão
            </button>
          </div>
        </section>

        {(error || notice) && (
          <div
            role="status"
            className={`mt-5 rounded-xl border px-4 py-3 text-sm font-medium ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
          >
            {error || notice}
          </div>
        )}

        {view === 'projects' && projectTasks.some(
          (task) => task.startDate && task.endDate && task.endDate < task.startDate,
        ) && (
          <p role="status" className="mt-4 text-sm font-medium text-amber-800">
            Há atividades com término previsto anterior ao início na planilha. Revise essas datas no cronograma.
          </p>
        )}

        <section
          className="mt-7 grid gap-4 md:grid-cols-3"
          aria-label="Pilares do modelo"
        >
          {(Object.keys(pillarMeta) as Pillar[]).map((pillar) => {
            const meta = pillarMeta[pillar];
            const Icon = meta.icon;
            return (
              <article
                key={pillar}
                className="rounded-2xl border border-t-4 border-slate-200 bg-white p-5 shadow-sm"
                style={{ borderTopColor: meta.accent }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ color: meta.accent, background: meta.soft }}
                  >
                    <Icon size={21} />
                  </span>
                  <span className="text-sm font-bold text-slate-500">
                    {counts[pillar] ?? 0} ações
                  </span>
                </div>
                <div className="mt-4 flex items-baseline justify-between gap-3">
                  <h2 className="text-xl font-bold">{pillar}</h2>
                  {view === 'projects' && (
                    <span className="text-sm font-bold text-slate-700">
                      {progressByPillar[pillar] === null ? 'N/A' : `${progressByPillar[pillar]}%`}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 xl:flex-row xl:items-end xl:justify-between">
            {view === 'projects' ? (
              <div className="flex min-w-0 flex-wrap items-end gap-3">
                <div className="flex h-10 items-center whitespace-nowrap">
                  <h2 className="text-lg font-bold">Cronograma do projeto</h2>
                </div>
                {projects.length > 0 && (
                  <select
                    value={selectedProjectId}
                    onChange={(event) => void selectProject(event.target.value)}
                    className="h-10 w-56 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#103f85] focus:ring-2 focus:ring-[#103f85]/20"
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                )}
                {selectedProject && (
                  <label className="grid gap-1 text-xs font-bold text-slate-500">
                    Início do projeto
                    <input
                      type="date"
                      value={projectStartDate}
                      disabled={!isEditor}
                      onChange={(event) =>
                        setProjectStartDate(event.target.value)
                      }
                      onBlur={() => {
                        if (isEditor) void saveProjectStart();
                      }}
                      className="h-10 w-36 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 disabled:bg-slate-50"
                    />
                  </label>
                )}
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-bold">Padrão Makro editável</h2>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {view === 'projects' && selectedProject?.code && (
                <a href={`/projetos/detalhe?codigo=${encodeURIComponent(selectedProject.code)}`} className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-[#103f85] hover:bg-slate-50">Premissas do projeto</a>
              )}
              {view === 'projects' && selectedProject && isEditor && (
                <div className="flex rounded-lg border border-slate-200 p-1">
                  <button
                    onClick={() => setProjectMode('schedule')}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold ${projectMode === 'schedule' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}
                  >
                    <Table2 size={14} /> Tabela
                  </button>
                  <button
                    onClick={() => setProjectMode('gantt')}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold ${projectMode === 'gantt' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}
                  >
                    <BarChart3 size={14} /> Gantt
                  </button>
                </div>
              )}
              {view === 'projects' && selectedProject && !isEditor && (
                <Button
                  variant="outline"
                  onClick={() => requireAccess('schedule')}
                >
                  <KeyRound /> Editar cronograma
                </Button>
              )}
              {view === 'projects' && selectedProject && isEditor && (
                <>
                  {selectedProject.name.trim().toUpperCase() === 'S11D' &&
                    !projectTasks.some((task) => task.id.includes(':s11d-r')) && (
                      <Button variant="outline" disabled={saving} onClick={() => void importS11dSchedule()}>
                        Importar cronograma S11D
                      </Button>
                    )}
                  <Button variant="outline" onClick={openNewEquipment}>
                    <Truck /> Adicionar equipamento
                  </Button>
                  <Button variant="outline" onClick={openNewMilestone}>
                    <Star /> Adicionar marco
                  </Button>
                  <Button onClick={() => requireAccess('task')}>
                    <Plus /> Nova atividade
                  </Button>
                </>
              )}
              {view === 'projects' && selectedProject && (
                <Button
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() => requireAccess('deleteProject')}
                >
                  <Trash2 /> Excluir projeto
                </Button>
              )}
              {view === 'template' &&
                (isEditor ? (
                  <Button onClick={() => openNewTask()}>
                    <Plus /> Nova atividade
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => requireAccess('task')}
                  >
                    <KeyRound /> Editar padrão
                  </Button>
                ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-16 text-slate-500">
              <RefreshCw className="animate-spin" size={18} /> Carregando
              cronograma...
            </div>
          ) : view === 'projects' && projects.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf2fb] text-[#103f85]">
                <Building2 />
              </div>
              <h3 className="mt-4 text-lg font-bold">Nenhum projeto criado</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Crie o primeiro projeto para receber a estrutura padrão e montar
                o cronograma com datas e acompanhamento.
              </p>
              <Button className="mt-5" onClick={() => requireAccess('project')}>
                <Plus /> Criar projeto
              </Button>
            </div>
          ) : view === 'template' ? (
            <TemplateTable
              tasks={templateTasks}
              editable={isEditor}
              collapsedPillars={collapsedPillars}
              collapsedGroups={collapsedGroups}
              onTogglePillar={togglePillar}
              onToggleGroup={toggleGroup}
              onAdd={openNewTask}
              onEdit={openEditTask}
              onDelete={setDeleteTask}
            />
          ) : projectMode === 'gantt' ? (
            <GanttView
              tasks={displayProjectTasks}
              collapsedPillars={collapsedPillars}
              collapsedGroups={collapsedGroups}
              onTogglePillar={togglePillar}
              onToggleGroup={toggleGroup}
            />
          ) : (
            <ProjectScheduleTable
              tasks={displayProjectTasks}
              actions={projectActions}
              editable={isEditor}
              collapsedPillars={collapsedPillars}
              collapsedGroups={collapsedGroups}
              onTogglePillar={togglePillar}
              onToggleGroup={toggleGroup}
              onChange={patchProjectTask}
              onSave={saveProjectTask}
              onCreateAction={openCreateLinkedAction}
              onDeleteEquipment={deleteProjectEquipment}
            />
          )}
        </section>
      </div>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acesso de edição</DialogTitle>
            <DialogDescription>
              Informe a senha do PMO para editar o padrão, criar projetos ou
              atualizar cronogramas.
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2 text-sm font-semibold">
            Senha
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void authenticate();
              }}
              autoFocus
            />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuthOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void authenticate()}
              disabled={saving || !password}
            >
              {saving ? 'Validando...' : 'Entrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>
              O cronograma será criado com as frentes de contrato, frota, mão
              de obra, informações legais e CFI.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-semibold">
              Nome do projeto
              <Input
                placeholder="Ex.: S11D"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                autoFocus
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Data inicial do projeto{' '}
              <span className="font-normal text-slate-500">
                Pode ser alterada depois.
              </span>
              <Input
                type="date"
                value={projectStartDate}
                onChange={(event) => setProjectStartDate(event.target.value)}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProjectDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void createProject()}
              disabled={saving || projectName.trim().length < 2}
            >
              {saving ? 'Criando...' : 'Criar projeto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {taskDraft.id
                ? 'Editar atividade'
                : taskDialogPurpose === 'equipment'
                  ? 'Adicionar equipamento'
                  : taskDialogPurpose === 'milestone'
                    ? 'Adicionar marco'
                : taskDraft.parentId
                  ? 'Nova subtarefa'
                  : 'Nova atividade'}
            </DialogTitle>
            <DialogDescription>
              {taskTarget === 'project'
                ? 'Esta atividade será incluída somente neste projeto.'
                : 'Esta mudança atualiza o padrão usado por projetos criados daqui em diante.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              Pilar
              <select
                value={taskDraft.pillar}
                disabled={Boolean(
                  taskDraft.id || taskDraft.parentId || taskDialogPurpose === 'equipment',
                )}
                onChange={(event) =>
                  setTaskDraft((draft) => ({
                    ...draft,
                    pillar: event.target.value as Pillar,
                    parentId: '',
                  }))
                }
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm disabled:bg-slate-100"
              >
                {(Object.keys(pillarMeta) as Pillar[]).map((pillar) => (
                  <option key={pillar}>{pillar}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Tipo
              <select
                value={taskDraft.kind}
                disabled={taskDialogPurpose === 'equipment' || taskDialogPurpose === 'milestone'}
                onChange={(event) =>
                  setTaskDraft((draft) => ({
                    ...draft,
                    kind: event.target.value as TaskKind,
                  }))
                }
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
              >
                <option value="task">Atividade</option>
                <option value="group">Grupo</option>
                <option value="milestone">Marco</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Item
              <Input
                placeholder="Ex.: 2.5.5"
                value={taskDraft.item}
                onChange={(event) =>
                  setTaskDraft((draft) => ({
                    ...draft,
                    item: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              {taskDraft.kind === 'milestone'
                ? 'Duração do marco (dias)'
                : taskTarget === 'project'
                  ? 'Duração (dias)'
                  : 'Duração padrão (dias)'}
              <Input
                type="number"
                min={0}
                disabled={taskDraft.kind === 'group'}
                value={taskDraft.durationDays}
                onChange={(event) =>
                  setTaskDraft((draft) => ({
                    ...draft,
                    durationDays: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              {taskDialogPurpose === 'equipment' ? 'Nome do equipamento' : taskDraft.kind === 'milestone' ? 'Nome do marco' : 'Atividade'}
              <Input
                value={taskDraft.title}
                onChange={(event) =>
                  setTaskDraft((draft) => ({
                    ...draft,
                    title: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              {taskTarget === 'project' ? 'Responsável' : 'Responsável padrão'}
              <Input
                value={taskDraft.owner}
                onChange={(event) =>
                  setTaskDraft((draft) => ({
                    ...draft,
                    owner: event.target.value,
                  }))
                }
              />
            </label>
            {taskDraft.kind !== 'group' && <label className="grid gap-2 text-sm font-semibold">
              Criticidade {taskTarget === 'template' ? 'padrão' : ''}
              <select value={taskDraft.criticality} onChange={(event) => setTaskDraft((draft) => ({ ...draft, criticality: event.target.value as Criticality }))} className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm">
                {criticalities.map((criticality) => <option key={criticality} value={criticality}>{criticality}</option>)}
              </select>
            </label>}
            {taskTarget === 'project' && taskDraft.kind !== 'group' && (
              <>
                <label className="grid gap-2 text-sm font-semibold">
                  {taskDraft.kind === 'milestone' ? 'Data prevista' : 'Início previsto'}
                  <Input
                    type="date"
                    value={taskDraft.startDate}
                    onChange={(event) =>
                      setTaskDraft((draft) => ({
                        ...draft,
                        startDate: event.target.value,
                        endDate:
                          draft.kind === 'milestone'
                            ? event.target.value
                            : draft.endDate,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  {taskDraft.kind === 'milestone' ? 'Data do marco' : 'Término previsto'}
                  <Input
                    type="date"
                    value={taskDraft.endDate}
                    disabled={taskDraft.kind === 'milestone'}
                    onChange={(event) =>
                      setTaskDraft((draft) => ({ ...draft, endDate: event.target.value }))
                    }
                  />
                </label>
              </>
            )}
            {!taskDraft.id && (
              <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                {taskTarget === 'project'
                  ? 'Tarefa principal (opcional)'
                  : 'Tarefa principal (opcional)'}
                <select
                  value={taskDraft.parentId}
                  onChange={(event) =>
                    setTaskDraft((draft) => ({
                      ...draft,
                      parentId: event.target.value,
                    }))
                  }
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
                >
                  <option value="">Sem tarefa principal</option>
                  {parentChoices.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.item} — {task.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {taskDraft.kind !== 'group' && (
              <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                {taskTarget === 'project'
                  ? 'Predecessora (opcional)'
                  : 'Predecessora padrão (opcional)'}
                <select
                  value={taskDraft.predecessorId}
                  onChange={(event) =>
                    setTaskDraft((draft) => ({
                      ...draft,
                      predecessorId: event.target.value,
                    }))
                  }
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
                >
                  <option value="">Sem predecessora</option>
                  {predecessorChoices.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.item} — {task.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void saveTask()}
              disabled={
                saving || !taskDraft.item.trim() || !taskDraft.title.trim()
              }
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(linkedActionDraft)}
        onOpenChange={(open) => {
          if (!open && !saving) setLinkedActionDraft(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar ação vinculada</DialogTitle>
            <DialogDescription>
              A ação será criada no Quadro de Ações e ficará vinculada à tarefa{' '}
              {linkedActionDraft?.task.item} do projeto {selectedProject?.name}.
            </DialogDescription>
          </DialogHeader>
          {linkedActionDraft && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                Título da ação
                <Input
                  value={linkedActionDraft.title}
                  onChange={(event) =>
                    setLinkedActionDraft((draft) =>
                      draft ? { ...draft, title: event.target.value } : draft,
                    )
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                Observação
                <textarea
                  value={linkedActionDraft.observation}
                  onChange={(event) =>
                    setLinkedActionDraft((draft) =>
                      draft
                        ? { ...draft, observation: event.target.value }
                        : draft,
                    )
                  }
                  className="min-h-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#103f85]"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Responsável
                <Input
                  value={linkedActionDraft.owner}
                  onChange={(event) =>
                    setLinkedActionDraft((draft) =>
                      draft ? { ...draft, owner: event.target.value } : draft,
                    )
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Prazo previsto
                <Input
                  type="date"
                  value={linkedActionDraft.date}
                  onChange={(event) =>
                    setLinkedActionDraft((draft) =>
                      draft ? { ...draft, date: event.target.value } : draft,
                    )
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Setor
                <select
                  value={linkedActionDraft.sector}
                  onChange={(event) =>
                    setLinkedActionDraft((draft) =>
                      draft ? { ...draft, sector: event.target.value } : draft,
                    )
                  }
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
                >
                  {[...new Set([linkedActionDraft.sector, ...boardSectors])].map(
                    (sector) => (
                      <option key={sector}>{sector}</option>
                    ),
                  )}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Criticidade
                <select
                  value={linkedActionDraft.criticality}
                  onChange={(event) =>
                    setLinkedActionDraft((draft) =>
                      draft
                        ? {
                            ...draft,
                            criticality: event.target.value as LinkedActionDraft['criticality'],
                          }
                        : draft,
                    )
                  }
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
                >
                  {['Baixo', 'Médio', 'Alto', 'Crítico'].map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLinkedActionDraft(null)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={() => void createLinkedAction()} disabled={saving}>
              {saving ? 'Criando...' : 'Criar e vincular'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTask)}
        onOpenChange={(open) => {
          if (!open) setDeleteTask(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atividade do padrão?</AlertDialogTitle>
            <AlertDialogDescription>
              A atividade “{deleteTask?.title}” e suas subtarefas serão
              removidas do padrão. Projetos existentes não serão alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={saving}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteProject)}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setDeleteProject(null);
            setDeleteProjectConfirmation('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              O projeto “{deleteProject?.name}” e todo o seu cronograma serão
              excluídos permanentemente. O padrão Makro e os demais projetos não
              serão alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="grid gap-2 text-sm font-semibold text-slate-800">
            Digite {deleteProject?.name} para confirmar
            <Input
              value={deleteProjectConfirmation}
              onChange={(event) =>
                setDeleteProjectConfirmation(event.target.value)
              }
              autoComplete="off"
              autoFocus
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteProject();
              }}
              disabled={
                saving || deleteProjectConfirmation !== deleteProject?.name
              }
            >
              {saving ? 'Excluindo...' : 'Excluir projeto'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function PillarRow({
  pillar,
  colSpan,
  collapsed,
  onToggle,
  plannedRange,
}: {
  pillar: Pillar;
  colSpan: number;
  collapsed: boolean;
  onToggle: () => void;
  plannedRange?: { startDate: string; endDate: string };
}) {
  const meta = pillarMeta[pillar];
  const Icon = meta.icon;
  return (
    <tr>
      <td
        colSpan={plannedRange ? 4 : colSpan}
        className="px-4 py-3"
        style={{ background: meta.soft }}
      >
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#103f85]/40"
          style={{ color: meta.accent }}
        >
          <span className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.12em]">
            {collapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
            <Icon size={17} /> {pillar}
          </span>
          <span className="text-xs font-bold normal-case tracking-normal">
            {collapsed ? 'Expandir' : 'Recolher'}
          </span>
        </button>
      </td>
      {plannedRange && (
        <>
          <td
            className="px-3 py-3 text-xs font-extrabold"
            style={{ background: meta.soft, color: meta.accent }}
            title="Menor data prevista das atividades deste pilar"
          >
            {formatDate(plannedRange.startDate)}
          </td>
          <td
            className="px-3 py-3 text-xs font-extrabold"
            style={{ background: meta.soft, color: meta.accent }}
            title="Maior data prevista das atividades deste pilar"
          >
            {formatDate(plannedRange.endDate)}
          </td>
          <td
            colSpan={colSpan - 6}
            className="px-3 py-3"
            style={{ background: meta.soft }}
          />
        </>
      )}
    </tr>
  );
}

function TaskName({ task, map, collapsed, onToggle }: { task: Task; map: Map<string, Task>; collapsed?: boolean; onToggle?: () => void }) {
  const depth = taskDepth(task, map);
  return (
    <div
      className="flex items-center gap-2"
      style={{ paddingLeft: `${depth * 18}px` }}
    >
      {task.kind === 'group' && onToggle ? (
        <button type="button" onClick={onToggle} aria-expanded={!collapsed} aria-label={`${collapsed ? 'Expandir' : 'Recolher'} ${task.title}`} className="shrink-0 rounded p-0.5 text-[#103f85] hover:bg-slate-200 focus-visible:outline focus-visible:outline-2">
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      ) : depth > 0 && (
        <ChevronRight size={14} className="shrink-0 text-slate-300" />
      )}
      {task.kind === 'milestone' && (
        <Star size={15} className="shrink-0 fill-[#ed1c24] text-[#ed1c24]" />
      )}
      <span
        className={
          task.kind === 'group'
            ? 'font-extrabold uppercase tracking-wide text-slate-700'
            : 'font-medium text-slate-800'
        }
      >
        {task.title}
      </span>
    </div>
  );
}

function TemplateTable({
  tasks,
  editable,
  collapsedPillars,
  collapsedGroups,
  onTogglePillar,
  onToggleGroup,
  onAdd,
  onEdit,
  onDelete,
}: {
  tasks: Task[];
  editable: boolean;
  collapsedPillars: Set<Pillar>;
  collapsedGroups: Set<string>;
  onTogglePillar: (pillar: Pillar) => void;
  onToggleGroup: (id: string) => void;
  onAdd: (parent?: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const map = new Map(tasks.map((task) => [task.id, task]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1560px] table-fixed text-left">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="w-[54px] px-2 py-3">Item</th>
            <th className="w-[218px] px-2 py-3">Atividade</th>
            <th className="w-[104px] px-2 py-3">Responsável</th>
            <th className="w-[84px] px-2 py-3">Predecessora</th>
            <th className="w-[102px] px-2 py-3">Início previsto</th>
            <th className="w-[102px] px-2 py-3">Término previsto</th>
            <th className="w-[102px] px-2 py-3">Início real</th>
            <th className="w-[102px] px-2 py-3">Término real</th>
            <th className="w-[50px] px-2 py-3">Dias</th>
            <th className="w-[74px] px-2 py-3">Progresso</th>
            <th className="w-[94px] px-2 py-3">Status</th>
            <th className="w-[96px] px-2 py-3">Criticidade</th>
            <th className="w-[146px] px-2 py-3">Ação vinculada</th>
            <th className="w-[150px] px-2 py-3">Observação</th>
            {editable && <th className="w-[104px] px-2 py-3 text-right">Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(['Empresa', 'Pessoas', 'Equipamentos'] as Pillar[]).flatMap(
            (pillar) => {
              const pillarTasks = tasks
                .filter((task) => task.pillar === pillar)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              if (!pillarTasks.length) return [];
              return [
                <PillarRow
                  key={`${pillar}-header`}
                  pillar={pillar}
                  colSpan={editable ? 15 : 14}
                  collapsed={collapsedPillars.has(pillar)}
                  onToggle={() => onTogglePillar(pillar)}
                />,
                ...(collapsedPillars.has(pillar) ? [] : pillarTasks.filter((task) => !hiddenByCollapsedGroup(task, map, collapsedGroups))).map(
                  (task) => (
                    <tr
                      key={task.id}
                      className={
                        task.kind === 'group'
                          ? 'bg-slate-50/70'
                          : 'hover:bg-slate-50/60'
                      }
                    >
                      <td className="px-4 py-3 text-sm font-bold text-[#103f85]">
                        {task.item}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <TaskName task={task} map={map} collapsed={collapsedGroups.has(task.id)} onToggle={task.kind === 'group' ? () => onToggleGroup(task.id) : undefined} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {task.owner || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {task.predecessorId
                          ? map.get(task.predecessorId)?.item
                          : '—'}
                      </td>
                      {[0, 1, 2, 3].map((index) => <td key={index} className="px-2 py-3 text-xs text-slate-400">—</td>)}
                      <td className="px-4 py-3 text-center text-sm font-semibold text-slate-600">
                        {task.kind === 'group' ? '—' : task.durationDays}
                      </td>
                      <td className="px-2 py-3 text-xs text-slate-400">—</td>
                      <td className="px-2 py-3 text-xs text-slate-400">—</td>
                      <td className="px-2 py-3 text-xs text-slate-600">{task.kind === 'group' ? '—' : task.criticality}</td>
                      <td className="px-2 py-3 text-xs text-slate-400">—</td>
                      <td className="px-2 py-3 text-xs text-slate-400">—</td>
                      {editable && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Adicionar subtarefa em ${task.title}`}
                              onClick={() => onAdd(task)}
                            >
                              <Plus />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Editar ${task.title}`}
                              onClick={() => onEdit(task)}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="destructive"
                              aria-label={`Excluir ${task.title}`}
                              onClick={() => onDelete(task)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ),
                ),
              ] as React.ReactNode[];
            },
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProjectScheduleTable({
  tasks,
  actions,
  editable,
  collapsedPillars,
  collapsedGroups,
  onTogglePillar,
  onToggleGroup,
  onChange,
  onSave,
  onCreateAction,
  onDeleteEquipment,
}: {
  tasks: Task[];
  actions: BoardAction[];
  editable: boolean;
  collapsedPillars: Set<Pillar>;
  collapsedGroups: Set<string>;
  onTogglePillar: (pillar: Pillar) => void;
  onToggleGroup: (id: string) => void;
  onChange: (id: string, changes: Partial<Task>) => void;
  onSave: (task: Task) => void;
  onCreateAction: (task: Task) => void;
  onDeleteEquipment: (task: Task) => void;
}) {
  const [editingPredecessorId, setEditingPredecessorId] = useState<string | null>(null);
  const map = new Map(tasks.map((task) => [task.id, task]));
  const choices = tasks.filter((task) => task.kind !== 'group');
  const plannedRange = (pillar: Pillar) => {
    const scheduled = tasks
      .filter(
        (task) =>
          task.pillar === pillar &&
          task.kind !== 'group' &&
          task.status !== 'N/A' &&
          task.startDate &&
          task.endDate,
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (!scheduled.length) return { startDate: '', endDate: '' };
    return {
      startDate: scheduled[0].startDate,
      endDate: scheduled
        .map((task) => task.endDate)
        .sort()
        .at(-1) ?? '',
    };
  };
  const fieldClass =
    'h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[#103f85] disabled:border-transparent disabled:bg-transparent disabled:px-0';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1660px] table-fixed text-left">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="w-[54px] px-2 py-3">Item</th>
            <th className="w-[218px] px-2 py-3">Atividade</th>
            <th className="w-[104px] px-2 py-3">Responsável</th>
            <th className="w-[84px] px-2 py-3">Predecessora</th>
            <th className="w-[102px] px-2 py-3">Início previsto</th>
            <th className="w-[102px] px-2 py-3">Término previsto</th>
            <th className="w-[102px] px-2 py-3">Início real</th>
            <th className="w-[102px] px-2 py-3">Término real</th>
            <th className="w-[50px] px-2 py-3">Dias</th>
            <th className="w-[74px] px-2 py-3">Progresso</th>
            <th className="w-[94px] px-2 py-3">Status</th>
            <th className="w-[96px] px-2 py-3">Criticidade</th>
            <th className="w-[146px] px-2 py-3">Ação vinculada</th>
            <th className="w-[150px] px-2 py-3">Observação</th>
          </tr>
        </thead>
        <tbody
          className="divide-y divide-slate-100"
          onBlur={(event) => {
            if (!editable) return;
            if ((event.target as HTMLElement).hasAttribute('data-immediate')) return;
            const row = (event.target as HTMLElement).closest<HTMLTableRowElement>(
              'tr[data-task-id]',
            );
            const next = event.relatedTarget as Node | null;
            if (!row || (next && row.contains(next))) return;
            const task = tasks.find((item) => item.id === row.dataset.taskId);
            if (task && task.kind !== 'group') onSave(task);
          }}
        >
          {(['Empresa', 'Pessoas', 'Equipamentos'] as Pillar[]).flatMap(
            (pillar) => {
              const pillarTasks = tasks
                .filter((task) => task.pillar === pillar)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              if (!pillarTasks.length) return [];
              return [
                <PillarRow
                  key={`${pillar}-project-header`}
                  pillar={pillar}
                  colSpan={14}
                  collapsed={collapsedPillars.has(pillar)}
                  onToggle={() => onTogglePillar(pillar)}
                  plannedRange={plannedRange(pillar)}
                />,
                ...(collapsedPillars.has(pillar) ? [] : pillarTasks.filter((task) => !hiddenByCollapsedGroup(task, map, collapsedGroups))).map(
                  (task) => {
                    const summary = task.kind === 'group';
                    return (
                      <tr
                        key={task.id}
                        data-task-id={task.id}
                        className={
                          summary ? 'bg-slate-50/70' : 'hover:bg-slate-50/50'
                        }
                      >
                        <td className="px-3 py-2.5 text-xs font-bold text-[#103f85]">
                          {task.item}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <div className="flex items-start justify-between gap-2"><TaskName task={task} map={map} collapsed={collapsedGroups.has(task.id)} onToggle={task.kind === 'group' ? () => onToggleGroup(task.id) : undefined} />{editable && task.pillar === 'Equipamentos' && /^EQ\./.test(task.item) && <button type="button" onClick={() => onDeleteEquipment(task)} className="shrink-0 text-[11px] font-bold text-red-600 hover:underline">Excluir</button>}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          {summary ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <input
                              value={task.owner}
                              disabled={!editable}
                              onChange={(e) =>
                                onChange(task.id, { owner: e.target.value })
                              }
                              className={`${fieldClass} w-full`}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {summary ? (
                            '—'
                          ) : !editable ? (
                            <span className="text-xs">{map.get(task.predecessorId ?? '')?.item ?? 'Sem'}</span>
                          ) : editingPredecessorId !== task.id ? (
                            <button
                              type="button"
                              className="text-xs font-medium text-[#103f85] hover:underline"
                              onClick={() => setEditingPredecessorId(task.id)}
                              aria-label={`Alterar predecessora de ${task.title}`}
                            >
                              {map.get(task.predecessorId ?? '')?.item ?? 'Sem'}
                            </button>
                          ) : (
                            <select
                              value={task.predecessorId ?? ''}
                              disabled={!editable}
                              onChange={(e) =>
                                onChange(task.id, {
                                  predecessorId: e.target.value || null,
                                  startDate: e.target.value
                                    ? ''
                                    : task.startDate,
                                })
                              }
                              className={`${fieldClass} w-full`}
                            >
                              <option value="">Sem</option>
                              {choices
                                .filter((choice) => choice.id !== task.id)
                                .map((choice) => (
                                  <option key={choice.id} value={choice.id}>
                                    {choice.item}
                                  </option>
                                ))}
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {summary ? (
                            <span className="text-xs">
                              {formatDate(task.startDate)}
                            </span>
                          ) : (
                            <input
                              type="date"
                              value={task.startDate}
                              disabled={!editable}
                              onChange={(e) =>
                                onChange(task.id, { startDate: e.target.value })
                              }
                              className={`${fieldClass} w-full`}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {summary ? (
                            <span className="text-xs">
                              {formatDate(task.endDate)}
                            </span>
                          ) : (
                            <input
                              type="date"
                              value={task.endDate}
                              disabled={!editable}
                              onChange={(e) =>
                                onChange(task.id, { endDate: e.target.value })
                              }
                              className={`${fieldClass} w-full`}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {summary ? (
                            <span className="text-xs">{formatDate(task.actualStartDate)}</span>
                          ) : (
                            <input
                              type="date"
                              value={task.actualStartDate}
                              disabled={!editable}
                              onChange={(e) => onChange(task.id, { actualStartDate: e.target.value })}
                              className={`${fieldClass} w-full`}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {summary ? (
                            <span className="text-xs">{formatDate(task.actualEndDate)}</span>
                          ) : (
                            <input
                              type="date"
                              value={task.actualEndDate}
                              disabled={!editable}
                              onChange={(e) => onChange(task.id, { actualEndDate: e.target.value })}
                              className={`${fieldClass} w-full`}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {summary ? (
                            '—'
                          ) : (
                            <input
                              type="number"
                              min={task.kind === 'milestone' ? 0 : 1}
                              value={task.durationDays}
                              disabled={!editable}
                              onChange={(e) =>
                                onChange(task.id, {
                                  durationDays: Number(e.target.value),
                                })
                              }
                              className={`${fieldClass} w-full`}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {summary ? (
                            <span className="text-xs font-bold">
                              {task.status === 'N/A' ? '—' : `${task.progress}%`}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={task.progress}
                                disabled={!editable || task.status === 'N/A'}
                                onChange={(e) =>
                                  onChange(task.id, {
                                    progress: Number(e.target.value),
                                  })
                                }
                                className={`${fieldClass} w-16`}
                              />
                              <span className="text-xs text-slate-400">%</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {summary ? (
                            <span className="text-xs font-semibold">
                              {task.status}
                            </span>
                          ) : editable ? (
                            <select
                              data-immediate
                              value={task.status === 'N/A' ? 'N/A' : 'automatic'}
                              onChange={(event) => {
                                const status = event.target.value === 'N/A' ? 'N/A' : automaticTaskStatus(task);
                                onChange(task.id, { status });
                                onSave({ ...task, status });
                              }}
                              aria-label={`Status de ${task.title}`}
                              className={`${fieldClass} w-full`}
                            >
                              <option value="automatic">{automaticTaskStatus(task)}</option>
                              <option value="N/A">N/A</option>
                            </select>
                          ) : (
                            <span className="text-xs font-semibold text-slate-700">
                              {task.status === 'N/A' ? 'N/A' : automaticTaskStatus(task)}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5">
                          {summary ? '—' : editable ? (
                            <select
                              data-immediate
                              value={task.criticality}
                              onChange={(event) => {
                                const criticality = event.target.value as Criticality;
                                onChange(task.id, { criticality });
                                onSave({ ...task, criticality });
                              }}
                              aria-label={`Criticidade de ${task.title}`}
                              className={`${fieldClass} w-full`}
                            >
                              {criticalities.map((criticality) => <option key={criticality} value={criticality}>{criticality}</option>)}
                            </select>
                          ) : <span className="text-xs">{task.criticality}</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {summary ? (
                            '—'
                          ) : (
                            <div className="grid gap-1.5">
                              <select
                                value={task.linkedActionId ?? ''}
                                disabled={!editable}
                                onChange={(e) =>
                                  onChange(task.id, {
                                    linkedActionId: e.target.value || null,
                                  })
                                }
                                className={`${fieldClass} w-full`}
                              >
                                <option value="">Selecionar ação existente</option>
                                {actions.map((action) => (
                                  <option key={action.id} value={action.id}>
                                    {action.completed ? 'Concluída · ' : ''}
                                    {action.title} · {formatDate(action.actionDate)}
                                  </option>
                                ))}
                              </select>
                              {editable && (
                                <button
                                  type="button"
                                  onClick={() => onCreateAction(task)}
                                  className="text-left text-[11px] font-bold text-[#103f85] hover:underline"
                                >
                                  + Criar ação vinculada
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {summary ? (
                            '—'
                          ) : (
                            <input
                              value={task.observation}
                              disabled={!editable}
                              onChange={(e) =>
                                onChange(task.id, {
                                  observation: e.target.value,
                                })
                              }
                              placeholder="Registro do acompanhamento"
                              className={`${fieldClass} w-full`}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  },
                ),
              ] as React.ReactNode[];
            },
          )}
        </tbody>
      </table>
    </div>
  );
}

function GanttView({
  tasks,
  collapsedPillars,
  collapsedGroups,
  onTogglePillar,
  onToggleGroup,
}: {
  tasks: Task[];
  collapsedPillars: Set<Pillar>;
  collapsedGroups: Set<string>;
  onTogglePillar: (pillar: Pillar) => void;
  onToggleGroup: (id: string) => void;
}) {
  const dated = tasks.filter((task) => task.startDate && task.endDate);
  if (!dated.length)
    return (
      <div className="px-6 py-16 text-center text-sm text-slate-500">
        Preencha as datas do cronograma para visualizar o Gantt.
      </div>
    );
  const min = Math.min(
    ...dated.map((task) => Date.parse(`${task.startDate}T12:00:00Z`)),
  );
  const max = Math.max(
    ...dated.map((task) => Date.parse(`${task.endDate}T12:00:00Z`)),
  );
  const span = Math.max(1, (max - min) / 86_400_000 + 1);
  const map = new Map(tasks.map((task) => [task.id, task]));
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[980px] p-5">
        <div className="mb-3 grid grid-cols-[360px_1fr] gap-4 text-xs font-bold text-slate-500">
          <span>Atividade</span>
          <div className="flex justify-between">
            <span>{formatDate(new Date(min).toISOString().slice(0, 10))}</span>
            <span>{formatDate(new Date(max).toISOString().slice(0, 10))}</span>
          </div>
        </div>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {(['Empresa', 'Pessoas', 'Equipamentos'] as Pillar[]).flatMap(
            (pillar) => {
              const pillarTasks = dated.filter(
                (task) => task.pillar === pillar,
              );
              if (!pillarTasks.length) return [];
              const meta = pillarMeta[pillar];
              const Icon = meta.icon;
              return [
                <button
                  key={`${pillar}-gantt-header`}
                  type="button"
                  aria-expanded={!collapsedPillars.has(pillar)}
                  onClick={() => onTogglePillar(pillar)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#103f85]/40"
                  style={{ color: meta.accent, background: meta.soft }}
                >
                  <span className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.12em]">
                    {collapsedPillars.has(pillar) ? (
                      <ChevronRight size={17} />
                    ) : (
                      <ChevronDown size={17} />
                    )}
                    <Icon size={17} /> {pillar}
                  </span>
                  <span className="text-xs font-bold normal-case tracking-normal">
                    {collapsedPillars.has(pillar) ? 'Expandir' : 'Recolher'}
                  </span>
                </button>,
                ...(collapsedPillars.has(pillar) ? [] : pillarTasks.filter((task) => !hiddenByCollapsedGroup(task, map, collapsedGroups))).map(
                  (task) => {
                    const start =
                      (Date.parse(`${task.startDate}T12:00:00Z`) - min) /
                      86_400_000;
                    const length =
                      (Date.parse(`${task.endDate}T12:00:00Z`) -
                        Date.parse(`${task.startDate}T12:00:00Z`)) /
                        86_400_000 +
                      1;
                    return (
                      <div
                        key={task.id}
                        className="grid min-h-12 grid-cols-[360px_1fr] items-center gap-4 px-3"
                      >
                        <div className="truncate pr-4 text-xs">
                          <strong className="mr-2 text-[#103f85]">
                            {task.item}
                          </strong>
                          {task.kind === 'group' ? <button type="button" onClick={() => onToggleGroup(task.id)} aria-expanded={!collapsedGroups.has(task.id)} className="inline-flex items-center gap-1 font-bold text-[#103f85] hover:underline">
                            {collapsedGroups.has(task.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}{task.title}
                          </button> : task.title}
                        </div>
                        <div className="relative h-6 rounded bg-slate-100">
                          <div
                            className="absolute top-1 h-4 min-w-2 rounded"
                            style={{
                              left: `${(start / span) * 100}%`,
                              width: `${Math.max((length / span) * 100, 0.8)}%`,
                              background: meta.accent,
                              opacity: task.kind === 'group' ? 0.45 : 0.9,
                            }}
                          >
                            <span
                              className="absolute inset-y-0 left-0 rounded bg-black/20"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  },
                ),
              ] as React.ReactNode[];
            },
          )}
        </div>
      </div>
    </div>
  );
}
