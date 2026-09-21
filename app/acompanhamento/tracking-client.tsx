'use client';
import '@/lib/github-pages-api';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  HardHat,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings2,
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
type Task = {
  id: string;
  parentId: string | null;
  pillar: Pillar;
  item: string;
  title: string;
  owner: string;
  durationDays: number;
  predecessorId: string | null;
  startDate: string;
  endDate: string;
  progress: number;
  status: string;
  observation: string;
  kind: TaskKind;
  sortOrder: number;
};
type Project = {
  id: string;
  name: string;
  templateRevision: number;
  startDate: string;
  updatedAt: string;
  createdAt: string;
};
type TaskDraft = Pick<
  Task,
  'id' | 'pillar' | 'item' | 'title' | 'owner' | 'durationDays' | 'kind'
> & { parentId: string; predecessorId: string };

const statuses = ['Não iniciado', 'Em andamento', 'Concluído', 'Bloqueado'];
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
  durationDays: 1,
  kind: 'task',
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
    const leaves = descendants(task.id);
    const starts = leaves
      .map((child) => child.startDate)
      .filter(Boolean)
      .sort();
    const ends = leaves
      .map((child) => child.endDate)
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
      progress,
      status:
        progress === 100
          ? 'Concluído'
          : progress > 0
            ? 'Em andamento'
            : 'Não iniciado',
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
  const [templateTasks, setTemplateTasks] = useState<Task[]>([]);
  const [revision, setRevision] = useState(1);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [isEditor, setIsEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState('');
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
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(emptyDraft);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [deleteProjectConfirmation, setDeleteProjectConfirmation] =
    useState('');

  const loadProject = useCallback(async (id: string) => {
    if (!id) {
      setSelectedProject(null);
      setProjectTasks([]);
      return;
    }
    const data = await json<{
      project: Project;
      projects: Project[];
      tasks: Task[];
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
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [template, projectData, session] = await Promise.all([
        json<{ revision: number; tasks: Task[] }>(
          await fetch('/api/project-tracking/template', { cache: 'no-store' }),
        ),
        json<{ projects: Project[] }>(
          await fetch('/api/project-tracking/projects', { cache: 'no-store' }),
        ),
        json<{ authenticated: boolean }>(
          await fetch('/api/editor-session', { cache: 'no-store' }),
        ),
      ]);
      setTemplateTasks(template.tasks);
      setRevision(template.revision);
      setProjects(projectData.projects);
      setIsEditor(session.authenticated);
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
            (task) => task.pillar === pillar && task.kind !== 'group',
          ).length,
        ]),
      ) as Record<Pillar, number>,
    [visibleTasks],
  );

  function openNewTask(parent?: Task) {
    setTaskDraft({
      ...emptyDraft,
      pillar: parent?.pillar ?? 'Empresa',
      parentId: parent?.id ?? '',
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

  function openDeleteProject(project: Project) {
    setDeleteProjectConfirmation('');
    setDeleteProject(project);
  }

  function requireAccess(
    action: 'project' | 'task' | 'schedule' | 'deleteProject',
  ) {
    if (isEditor) {
      if (action === 'project') setProjectDialogOpen(true);
      if (action === 'task') openNewTask();
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
      if (pendingAction === 'task') openNewTask();
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
      setNotice(
        'Data inicial do projeto atualizada. As datas das atividades permanecem preservadas.',
      );
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

  function patchProjectTask(id: string, changes: Partial<Task>) {
    setProjectTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, ...changes } : task)),
    );
  }

  async function saveProjectTask(task: Task) {
    if (!selectedProject) return;
    setSavingTaskId(task.id);
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
      setNotice(`${task.item} salva no cronograma do projeto.`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível salvar a atividade.',
      );
    } finally {
      setSavingTaskId('');
    }
  }

  function openEditTask(task: Task) {
    setTaskDraft({
      id: task.id,
      parentId: task.parentId ?? '',
      predecessorId: task.predecessorId ?? '',
      pillar: task.pillar,
      item: task.item,
      title: task.title,
      owner: task.owner,
      durationDays: task.durationDays,
      kind: task.kind,
    });
    setTaskDialogOpen(true);
  }

  async function saveTask() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
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

  const parentChoices = templateTasks.filter(
    (task) => task.pillar === taskDraft.pillar && task.id !== taskDraft.id,
  );
  const predecessorChoices = templateTasks.filter(
    (task) => task.kind !== 'group' && task.id !== taskDraft.id,
  );

  return (
    <main className="min-h-screen bg-[#f4f6f7] text-slate-900">
      <PmoToolHeader title="Cronograma padrão de projetos" subtitle="Acompanhamento geral de projetos" backHref="/">
        <Button size="lg" onClick={() => requireAccess('project')}>
          <Plus /> Novo projeto
        </Button>
      </PmoToolHeader>

      <div className="mx-auto max-w-[1560px] px-5 py-7 sm:px-8">
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
                <h2 className="mt-4 text-xl font-bold">{pillar}</h2>
              </article>
            );
          })}
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-end justify-start gap-4 border-b border-slate-200 px-5 py-4">
            {view === 'projects' ? (
              <div className="flex min-w-0 flex-wrap items-end justify-start gap-3">
                <div>
                  <h2 className="text-lg font-bold">Cronograma do projeto</h2>
                </div>
                {projects.length > 0 && (
                  <select
                    value={selectedProjectId}
                    onChange={(event) => void selectProject(event.target.value)}
                    className="h-10 min-w-56 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#103f85] focus:ring-2 focus:ring-[#103f85]/20"
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                )}
                {selectedProject && (
                  <div className="flex items-end gap-2">
                    <label className="grid gap-1 text-xs font-bold text-slate-500">
                      Início do projeto
                      <input
                        type="date"
                        value={projectStartDate}
                        disabled={!isEditor}
                        onChange={(event) =>
                          setProjectStartDate(event.target.value)
                        }
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 disabled:bg-slate-50"
                      />
                    </label>
                    {isEditor && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void saveProjectStart()}
                        disabled={saving}
                      >
                        <Save /> Salvar
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center md:col-start-2 md:justify-self-center">
                <h2 className="text-lg font-bold">Padrão Makro editável</h2>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2 md:col-start-3 md:justify-self-end">
              {view === 'projects' && selectedProject && (
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
              onTogglePillar={togglePillar}
              onAdd={openNewTask}
              onEdit={openEditTask}
              onDelete={setDeleteTask}
            />
          ) : projectMode === 'gantt' ? (
            <GanttView
              tasks={displayProjectTasks}
              collapsedPillars={collapsedPillars}
              onTogglePillar={togglePillar}
            />
          ) : (
            <ProjectScheduleTable
              tasks={displayProjectTasks}
              editable={isEditor}
              collapsedPillars={collapsedPillars}
              onTogglePillar={togglePillar}
              savingTaskId={savingTaskId}
              onChange={patchProjectTask}
              onSave={saveProjectTask}
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
                : taskDraft.parentId
                  ? 'Nova subtarefa'
                  : 'Nova atividade'}
            </DialogTitle>
            <DialogDescription>
              Esta mudança atualiza o padrão usado por projetos criados daqui em
              diante.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              Pilar
              <select
                value={taskDraft.pillar}
                disabled={Boolean(taskDraft.id || taskDraft.parentId)}
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
              Duração padrão (dias)
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
              Atividade
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
              Responsável padrão
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
            {!taskDraft.id && (
              <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                Tarefa principal (opcional)
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
                Predecessora padrão (opcional)
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
}: {
  pillar: Pillar;
  colSpan: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const meta = pillarMeta[pillar];
  const Icon = meta.icon;
  return (
    <tr>
      <td
        colSpan={colSpan}
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
    </tr>
  );
}

function TaskName({ task, map }: { task: Task; map: Map<string, Task> }) {
  const depth = taskDepth(task, map);
  return (
    <div
      className="flex items-center gap-2"
      style={{ paddingLeft: `${depth * 18}px` }}
    >
      {depth > 0 && (
        <ChevronRight size={14} className="shrink-0 text-slate-300" />
      )}
      {task.kind === 'milestone' && (
        <CircleDot size={15} className="shrink-0 text-[#ed1c24]" />
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
  onTogglePillar,
  onAdd,
  onEdit,
  onDelete,
}: {
  tasks: Task[];
  editable: boolean;
  collapsedPillars: Set<Pillar>;
  onTogglePillar: (pillar: Pillar) => void;
  onAdd: (parent?: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const map = new Map(tasks.map((task) => [task.id, task]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[940px] text-left">
        <thead className="bg-slate-50 text-sm text-slate-500">
          <tr>
            <th className="w-28 px-4 py-3">Item</th>
            <th className="px-4 py-3">Atividade</th>
            <th className="w-52 px-4 py-3">Responsável</th>
            <th className="w-32 px-4 py-3">Predecessora</th>
            <th className="w-20 px-4 py-3 text-center">Dias</th>
            {editable && <th className="w-32 px-4 py-3 text-right">Ações</th>}
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
                  colSpan={editable ? 6 : 5}
                  collapsed={collapsedPillars.has(pillar)}
                  onToggle={() => onTogglePillar(pillar)}
                />,
                ...(collapsedPillars.has(pillar) ? [] : pillarTasks).map(
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
                        <TaskName task={task} map={map} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {task.owner || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {task.predecessorId
                          ? map.get(task.predecessorId)?.item
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-slate-600">
                        {task.kind === 'group' ? '—' : task.durationDays}
                      </td>
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
  editable,
  collapsedPillars,
  onTogglePillar,
  savingTaskId,
  onChange,
  onSave,
}: {
  tasks: Task[];
  editable: boolean;
  collapsedPillars: Set<Pillar>;
  onTogglePillar: (pillar: Pillar) => void;
  savingTaskId: string;
  onChange: (id: string, changes: Partial<Task>) => void;
  onSave: (task: Task) => void;
}) {
  const map = new Map(tasks.map((task) => [task.id, task]));
  const choices = tasks.filter((task) => task.kind !== 'group');
  const fieldClass =
    'h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[#103f85] disabled:border-transparent disabled:bg-transparent disabled:px-0';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1424px] table-fixed text-left">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="w-[72px] px-3 py-3">Item</th>
            <th className="w-[280px] px-3 py-3">Atividade</th>
            <th className="w-[136px] px-3 py-3">Responsável</th>
            <th className="w-[104px] px-3 py-3">Predecessora</th>
            <th className="w-32 px-3 py-3">Início</th>
            <th className="w-32 px-3 py-3">Término</th>
            <th className="w-16 px-3 py-3">Dias</th>
            <th className="w-24 px-3 py-3">Progresso</th>
            <th className="w-[136px] px-3 py-3">Status</th>
            <th className="w-[216px] px-3 py-3">Observação</th>
            {editable && <th className="w-16 px-3 py-3"></th>}
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
                  key={`${pillar}-project-header`}
                  pillar={pillar}
                  colSpan={editable ? 11 : 10}
                  collapsed={collapsedPillars.has(pillar)}
                  onToggle={() => onTogglePillar(pillar)}
                />,
                ...(collapsedPillars.has(pillar) ? [] : pillarTasks).map(
                  (task) => {
                    const summary = task.kind === 'group';
                    return (
                      <tr
                        key={task.id}
                        className={
                          summary ? 'bg-slate-50/70' : 'hover:bg-slate-50/50'
                        }
                      >
                        <td className="px-3 py-2.5 text-xs font-bold text-[#103f85]">
                          {task.item}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <TaskName task={task} map={map} />
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
                              {task.progress}%
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={task.progress}
                                disabled={!editable}
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
                          ) : (
                            <select
                              value={task.status}
                              disabled={!editable}
                              onChange={(e) =>
                                onChange(task.id, { status: e.target.value })
                              }
                              className={`${fieldClass} w-full`}
                            >
                              {statuses.map((status) => (
                                <option key={status}>{status}</option>
                              ))}
                            </select>
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
                        {editable && (
                          <td className="px-3 py-2.5">
                            {!summary && (
                              <Button
                                size="icon-sm"
                                variant="outline"
                                aria-label={`Salvar ${task.item}`}
                                disabled={savingTaskId === task.id}
                                onClick={() => onSave(task)}
                              >
                                {savingTaskId === task.id ? (
                                  <RefreshCw className="animate-spin" />
                                ) : (
                                  <Save />
                                )}
                              </Button>
                            )}
                          </td>
                        )}
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
  onTogglePillar,
}: {
  tasks: Task[];
  collapsedPillars: Set<Pillar>;
  onTogglePillar: (pillar: Pillar) => void;
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
                ...(collapsedPillars.has(pillar) ? [] : pillarTasks).map(
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
                          {task.title}
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
