'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  CircleDot,
  HardHat,
  KeyRound,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  Truck,
} from 'lucide-react';
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
type Task = {
  id: string;
  parentId: string | null;
  pillar: Pillar;
  item: string;
  title: string;
  owner: string;
  durationDays: number;
  kind: 'group' | 'task' | 'milestone';
  sortOrder: number;
};
type Project = {
  id: string;
  name: string;
  templateRevision: number;
  createdAt: string;
};
type TaskDraft = {
  id: string;
  parentId: string;
  pillar: Pillar;
  item: string;
  title: string;
  owner: string;
  durationDays: number;
  kind: Task['kind'];
};

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
  while (parent && depth < 3) {
    depth += 1;
    parent = parent.parentId ? map.get(parent.parentId) : undefined;
  }
  return depth;
}

export function TrackingClient() {
  const [view, setView] = useState<'projects' | 'template'>('projects');
  const [templateTasks, setTemplateTasks] = useState<Task[]>([]);
  const [revision, setRevision] = useState(1);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [isEditor, setIsEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<'project' | 'task' | null>(
    null,
  );
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(emptyDraft);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);

  const loadProject = useCallback(async (id: string) => {
    if (!id) {
      setProjectTasks([]);
      return;
    }
    const data = await json<{ tasks: Task[] }>(
      await fetch(
        `/api/project-tracking/projects?id=${encodeURIComponent(id)}`,
        { cache: 'no-store' },
      ),
    );
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
      const nextProject =
        selectedProjectId || projectData.projects[0]?.id || '';
      setSelectedProjectId(nextProject);
      if (nextProject) await loadProject(nextProject);
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

  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );
  const visibleTasks = view === 'template' ? templateTasks : projectTasks;
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

  function requireAccess(action: 'project' | 'task') {
    if (isEditor) {
      action === 'project' ? setProjectDialogOpen(true) : openNewTask();
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
          body: JSON.stringify({ name: projectName }),
        }),
      );
      setProjectDialogOpen(false);
      setProjectName('');
      setProjects((current) => [data.project, ...current]);
      setSelectedProjectId(data.project.id);
      await loadProject(data.project.id);
      setView('projects');
      setNotice(
        `Projeto ${data.project.name} criado com a revisão ${data.project.templateRevision} do modelo.`,
      );
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

  function openEditTask(task: Task) {
    setTaskDraft({
      id: task.id,
      parentId: task.parentId ?? '',
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
          }),
        }),
      );
      setTemplateTasks(data.tasks);
      setRevision(data.revision);
      setTaskDialogOpen(false);
      setNotice(
        taskDraft.id
          ? 'Atividade atualizada no modelo padrão.'
          : 'Atividade adicionada ao modelo padrão.',
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
    setNotice('');
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
        'Atividade removida do modelo padrão. Projetos já criados permanecem inalterados.',
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

  return (
    <main className="min-h-screen bg-[#f4f6f7] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <a
              href="/"
              aria-label="Voltar às ferramentas"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#103f85]"
            >
              <ArrowLeft size={21} />
            </a>
            <img
              src="/makro-logo.png"
              alt="Makro Engenharia"
              className="h-9 w-auto object-contain"
            />
            <div className="hidden border-l border-slate-200 pl-4 sm:block">
              <p className="text-sm font-bold text-slate-800">
                Acompanhamento de projetos
              </p>
              <p className="text-xs text-slate-500">Padrão Makro</p>
            </div>
          </div>
          <Button size="lg" onClick={() => requireAccess('project')}>
            <Plus /> Novo projeto
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8">
        <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#ed1c24]">
              Estrutura corporativa
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Modelo padrão de mobilização
            </h1>
            <p className="mt-2 max-w-2xl text-base leading-6 text-slate-600">
              Novos projetos recebem uma cópia congelada do modelo vigente.
              Alterações futuras ficam restritas ao modelo padrão.
            </p>
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
              <Settings2 size={16} /> Modelo padrão
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
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center">
            {view === 'projects' ? (
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-bold">Projeto</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Estrutura somente para consulta.
                  </p>
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
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-bold">Modelo padrão editável</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Revisão {revision}. As alterações valem apenas para novos
                  projetos.
                </p>
              </div>
            )}
            <div className="flex items-center gap-2">
              {view === 'projects' && selectedProject && (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
                  <LockKeyhole size={15} /> Revisão{' '}
                  {selectedProject.templateRevision}
                </span>
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
                    <KeyRound /> Editar modelo
                  </Button>
                ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-16 text-slate-500">
              <RefreshCw className="animate-spin" size={18} /> Carregando
              acompanhamento...
            </div>
          ) : view === 'projects' && projects.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf2fb] text-[#103f85]">
                <Building2 />
              </div>
              <h3 className="mt-4 text-lg font-bold">Nenhum projeto criado</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Crie o primeiro projeto para gerar uma cópia bloqueada do modelo
                padrão.
              </p>
              <Button className="mt-5" onClick={() => requireAccess('project')}>
                <Plus /> Criar projeto
              </Button>
            </div>
          ) : (
            <TaskTable
              tasks={visibleTasks}
              editable={view === 'template' && isEditor}
              onAdd={openNewTask}
              onEdit={openEditTask}
              onDelete={setDeleteTask}
            />
          )}
        </section>
      </div>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acesso de edição</DialogTitle>
            <DialogDescription>
              Informe a senha do PMO para editar o modelo ou criar projetos.
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
              O projeto receberá a revisão {revision} do modelo e não poderá
              alterar essa estrutura.
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2 text-sm font-semibold">
            Nome do projeto
            <Input
              placeholder="Ex.: S11D"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void createProject();
              }}
              autoFocus
            />
          </label>
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
              Esta alteração atualiza o modelo usado somente por projetos
              criados daqui em diante.
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
                    kind: event.target.value as Task['kind'],
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
                placeholder="Ex.: 2.9"
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
            <AlertDialogTitle>Excluir atividade do modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              A atividade “{deleteTask?.title}” e suas subtarefas serão
              removidas do modelo padrão. Projetos já criados não serão
              alterados.
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
    </main>
  );
}

function TaskTable({
  tasks,
  editable,
  onAdd,
  onEdit,
  onDelete,
}: {
  tasks: Task[];
  editable: boolean;
  onAdd: (parent?: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const map = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  if (!tasks.length)
    return (
      <div className="px-5 py-14 text-center text-sm text-slate-500">
        Nenhuma atividade disponível.
      </div>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-left">
        <thead className="bg-slate-50 text-sm text-slate-500">
          <tr>
            <th className="w-24 px-5 py-3 font-semibold">Item</th>
            <th className="px-5 py-3 font-semibold">Atividade</th>
            <th className="w-52 px-5 py-3 font-semibold">Responsável</th>
            <th className="w-24 px-5 py-3 text-center font-semibold">Dias</th>
            {editable && (
              <th className="w-32 px-5 py-3 text-right font-semibold">Ações</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(['Empresa', 'Pessoas', 'Equipamentos'] as Pillar[]).flatMap(
            (pillar) => {
              const meta = pillarMeta[pillar];
              const Icon = meta.icon;
              const pillarTasks = tasks
                .filter((task) => task.pillar === pillar)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              if (!pillarTasks.length) return [];
              return [
                <tr key={`${pillar}-header`}>
                  <td
                    colSpan={editable ? 5 : 4}
                    className="px-5 py-3"
                    style={{ background: meta.soft }}
                  >
                    <span
                      className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.12em]"
                      style={{ color: meta.accent }}
                    >
                      <Icon size={17} /> {pillar}
                    </span>
                  </td>
                </tr>,
                ...pillarTasks.map((task) => {
                  const depth = taskDepth(task, map);
                  const group = task.kind === 'group';
                  return (
                    <tr
                      key={task.id}
                      className={
                        group ? 'bg-slate-50/70' : 'hover:bg-slate-50/60'
                      }
                    >
                      <td className="px-5 py-3.5 text-sm font-bold text-[#103f85]">
                        {task.item}
                      </td>
                      <td className="px-5 py-3.5">
                        <div
                          className="flex items-center gap-2"
                          style={{ paddingLeft: `${depth * 22}px` }}
                        >
                          {depth > 0 && (
                            <ChevronRight
                              size={15}
                              className="text-slate-300"
                            />
                          )}
                          {task.kind === 'milestone' && (
                            <CircleDot size={16} className="text-[#ed1c24]" />
                          )}
                          <span
                            className={`text-sm ${group ? 'font-extrabold uppercase tracking-wide text-slate-700' : 'font-medium text-slate-800'}`}
                          >
                            {task.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        {task.owner || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-center text-sm font-semibold text-slate-600">
                        {group ? '—' : task.durationDays}
                      </td>
                      {editable && (
                        <td className="px-5 py-3.5">
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
                  );
                }),
              ];
            },
          )}
        </tbody>
      </table>
    </div>
  );
}
