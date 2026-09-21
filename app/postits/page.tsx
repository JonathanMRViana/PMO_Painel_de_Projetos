'use client';
import '@/lib/github-pages-api';
import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  CircleAlert,
  Copy,
  FileText,
  GripVertical,
  Plus,
  Pencil,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { PmoToolHeader } from '@/components/pmo-tool-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import styles from './postit-board.module.css';
export const dynamic = 'force-static';
type Day = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'd7';
type Sector = string;
type Project = string;
type Criticality = 'Baixo' | 'Médio' | 'Alto' | 'Crítico';
type Status = 'No prazo' | 'Atenção' | 'Crítico' | 'Concluído';
type Action = {
  id: string;
  title: string;
  observation: string;
  owner: string;
  date: string;
  day: Day;
  sector: Sector;
  project: Project;
  criticality: Criticality;
  completed: boolean;
  createdAt?: string;
};
type DateHistory = { id: string; previousDate: string; newDate: string; changedAt: string };
type HoveredAction = { action: Action; x: number; y: number };
const days: { id: Day; label: string }[] = [
  { id: 'seg', label: 'Segunda' },
  { id: 'ter', label: 'Terça' },
  { id: 'qua', label: 'Quarta' },
  { id: 'qui', label: 'Quinta' },
  { id: 'sex', label: 'Sexta' },
  { id: 'd7', label: 'D+7' },
];
const defaultSectors: Sector[] = [
  'Manutenção',
  'Operação / MKT',
  'Suprimentos',
  'Financeiro',
  'DP / Gente & Gestão',
  'CDI',
  'Engenharia',
  'SMS',
];
const defaultProjects: Project[] = [
  'AMP',
  '5S8',
  'ALPPEX',
  'RINVEST',
  'ECOPÓS',
  'Geral',
];
const criticalities: Criticality[] = ['Baixo', 'Médio', 'Alto', 'Crítico'];
const statuses: Status[] = ['No prazo', 'Atenção', 'Crítico', 'Concluído'];
const projectTextColor = (color?: string) => {
  const hex = color?.replace('#', '');
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return '#263036';
  const [r, g, b] = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((value) => Number.parseInt(value, 16));
  return (r * 299 + g * 587 + b * 114) / 1000 < 145 ? '#ffffff' : '#263036';
};
const projectIdentity = (project: string) => {
  const normalized = project.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  return ['alpek', 'alppex', 'alpex'].includes(normalized) ? 'alpek' : normalized;
};
const projectColor = (project: string, colors: Record<string, string>) => {
  const normalized = projectIdentity(project);
  // Paleta oficial: não deixa cores antigas gravadas no catálogo alterarem a leitura do quadro.
  if (normalized === 'alpek') return '#f3a3b3';
  if (normalized === 'rnest') return '#9bcf9e';
  const exactOrEquivalent = colors[project] || Object.entries(colors).find(([name]) =>
    projectIdentity(name) === normalized,
  )?.[1];
  if (exactOrEquivalent) return exactOrEquivalent;
  return '#d8e5e5';
};
const seed: Action[] = [
  {
    id: '1',
    title: 'Validar plano de manutenção',
    observation: 'Consolidar prioridade das intervenções da semana.',
    owner: 'Marcos Silva',
    date: '2026-09-14',
    day: 'seg',
    sector: 'Manutenção',
    project: 'ECOPÓS',
    criticality: 'Alto',
    completed: false,
  },
  {
    id: '2',
    title: 'Aprovar janela de parada',
    observation: 'Confirmar impacto com operação e segurança.',
    owner: 'Camila Rocha',
    date: '2026-09-17',
    day: 'qui',
    sector: 'Manutenção',
    project: 'ALPPEX',
    criticality: 'Crítico',
    completed: false,
  },
  {
    id: '3',
    title: 'Publicar campanha de captação',
    observation: 'Revisar peças e liberar cronograma de mídia.',
    owner: 'Bruno Costa',
    date: '2026-09-15',
    day: 'ter',
    sector: 'Operação / MKT',
    project: 'AMP',
    criticality: 'Médio',
    completed: false,
  },
  {
    id: '4',
    title: 'Fechar cotação de transportadora',
    observation: 'Comparar prazo, custo e disponibilidade.',
    owner: 'Larissa Melo',
    date: '2026-09-17',
    day: 'qui',
    sector: 'Suprimentos',
    project: '5S8',
    criticality: 'Alto',
    completed: false,
  },
  {
    id: '5',
    title: 'Atualizar previsão de caixa',
    observation: 'Incluir os recebimentos previstos para setembro.',
    owner: 'Fernanda Alves',
    date: '2026-09-18',
    day: 'sex',
    sector: 'Financeiro',
    project: 'RINVEST',
    criticality: 'Médio',
    completed: false,
  },
  {
    id: '6',
    title: 'Alinhar plano de mobilização',
    observation: 'Confirmar vagas, admissões e integração.',
    owner: 'Renata Dias',
    date: '2026-09-18',
    day: 'sex',
    sector: 'DP / Gente & Gestão',
    project: 'ALPPEX',
    criticality: 'Alto',
    completed: false,
  },
  {
    id: '7',
    title: 'Checar documentação de acesso',
    observation: 'Pendência de crachá e liberação de equipe.',
    owner: 'João Vitor',
    date: '2026-09-17',
    day: 'qui',
    sector: 'CDI',
    project: '5S8',
    criticality: 'Crítico',
    completed: false,
  },
  {
    id: '8',
    title: 'Emitir revisão de projeto',
    observation: 'Subir revisão para validação do cliente.',
    owner: 'Paula Nunes',
    date: '2026-09-25',
    day: 'd7',
    sector: 'Engenharia',
    project: 'AMP',
    criticality: 'Baixo',
    completed: false,
  },
  {
    id: '9',
    title: 'Liberar APR de atividade crítica',
    observation: 'Aguardar evidência de treinamento da frente.',
    owner: 'Diego Souza',
    date: '2026-09-17',
    day: 'qui',
    sector: 'SMS',
    project: 'RINVEST',
    criticality: 'Alto',
    completed: false,
  },
];
const empty = (): Omit<Action, 'id'> => ({
  title: '',
  observation: '',
  owner: '',
  date: '',
  day: 'seg',
  sector: 'Manutenção',
  project: 'Geral',
  criticality: 'Médio',
  completed: false,
});
const dayIndexes: Record<Exclude<Day, 'd7'>, number> = { seg: 1, ter: 2, qua: 3, qui: 4, sex: 5 };
const isoDate = (value: Date) => value.toISOString().slice(0, 10);
function dateForDay(day: Day, deferredDay: Day = 'sex') {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const requested = day === 'd7' ? (deferredDay === 'd7' ? 'sex' : deferredDay) : day;
  let distance = (dayIndexes[requested] - today.getDay() + 7) % 7;
  if (day === 'd7' && distance <= 6) distance += 7;
  const result = new Date(today);
  result.setDate(today.getDate() + distance);
  return isoDate(result);
}
function boardDay(dateValue: string): Day {
  const due = new Date(dateValue + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const distance = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (distance < 0 || distance > 6) return 'd7';
  return ({ 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex' }[due.getDay()] as Day | undefined) || 'd7';
}
const formatDate = (value?: string) => {
  if (!value) return 'Não registrada';
  const normalized = value.includes('T')
    ? value
    : value.includes(' ')
      ? value.replace(' ', 'T')
      : `${value}T00:00:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? 'Não registrada' : new Intl.DateTimeFormat('pt-BR').format(date);
};
const openDuration = (createdAt?: string, completed?: boolean) => {
  if (!createdAt) return 'Não disponível';
  const normalized = createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T');
  const timestamp = new Date(normalized).getTime();
  if (Number.isNaN(timestamp)) return 'Não disponível';
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86400000));
  return completed ? `${days} dia(s) até a conclusão` : `${days} dia(s) em aberto`;
};
const dayDiff = (v: string) =>
  Math.ceil(
    (new Date(v + 'T00:00:00').getTime() -
      new Date(new Date().toDateString()).getTime()) /
      86400000,
  );
const state = (a: Action): Status =>
  a.completed
    ? 'Concluído'
    : dayDiff(a.date) <= 0
      ? 'Crítico'
      : dayDiff(a.date) <= 2
        ? 'Atenção'
        : 'No prazo';
const cn = (a: Action) =>
  [
    styles.postit,
    styles['project' + a.project],
    styles['status' + state(a).replace(' ', '')],
    a.completed ? styles.completed : '',
  ].join(' ');
async function api(method: 'POST' | 'PUT' | 'DELETE', body: unknown) {
  const r = await fetch('/api/postit-actions', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await r.json()) as { action?: Action; error?: string };
  if (!r.ok)
    throw new Error(data.error || 'Não foi possível salvar a alteração.');
  return data;
}
export default function PostitBoardPage({ viewOnly = false }: { viewOnly?: boolean }) {
  const searchParams = useSearchParams();
  const [actions, setActions] = useState<Action[]>([]),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null),
    [dragged, setDragged] = useState<string | null>(null),
    [dropTarget, setDropTarget] = useState<string | null>(null),
    [editing, setEditing] = useState<Action | null>(null),
    [creating, setCreating] = useState(false),
    [showCompleted, setShowCompleted] = useState(false),
    [query, setQuery] = useState(''),
    [viewing, setViewing] = useState<Action | null>(null),
    [hovered, setHovered] = useState<HoveredAction | null>(null),
    [projects, setProjects] = useState<Project[]>(defaultProjects),
    [sectors, setSectors] = useState<Sector[]>(defaultSectors),
    [projectColors, setProjectColors] = useState<Record<string, string>>({}),
    [selectedProject, setSelectedProject] = useState<string | null>(null),
    [catalogType, setCatalogType] = useState<'project' | 'sector' | null>(null),
    [catalogName, setCatalogName] = useState(''),
    [catalogColor, setCatalogColor] = useState('#d9c7f3'),
    [editingSector, setEditingSector] = useState<string | null>(null),
    [editingProject, setEditingProject] = useState<string | null>(null),
    [managingProjects, setManagingProjects] = useState(false),
    [deleteProjectPending, setDeleteProjectPending] = useState<string | null>(null),
    [editorMode, setEditorMode] = useState(false),
    [authChecked, setAuthChecked] = useState(viewOnly),
    [loginOpen, setLoginOpen] = useState(false),
    [password, setPassword] = useState(''),
    [loginError, setLoginError] = useState<string | null>(null),
    [dateHistory, setDateHistory] = useState<DateHistory[]>([]),
    [reportOpen, setReportOpen] = useState(false),
    [reportProject, setReportProject] = useState('__all'),
    [reportSector, setReportSector] = useState('__all'),
    [reportCopied, setReportCopied] = useState(false),
    [form, setForm] = useState<Omit<Action, 'id'>>(empty());
  useEffect(() => {
    if (viewOnly) return;
    void fetch('/api/editor-session', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: { authenticated?: boolean }) => setEditorMode(Boolean(data.authenticated)))
      .catch(() => setEditorMode(false))
      .finally(() => setAuthChecked(true));
  }, [viewOnly]);
  useEffect(() => {
    if (authChecked) void load();
  }, [authChecked]);
  useEffect(() => {
    const project = searchParams.get('projeto')?.trim();
    if (project) setSelectedProject(project);
  }, [searchParams]);
  const canEdit = !viewOnly && editorMode;
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [r, catalogResponse] = await Promise.all([
        fetch('/api/postit-actions', { cache: 'no-store' }),
        fetch('/api/postit-catalog', { cache: 'no-store' }),
      ]);
      const data = (await r.json()) as { actions?: Action[]; error?: string };
      const catalog = (await catalogResponse.json()) as { projects?: { name: string; color?: string }[]; sectors?: { name: string }[] };
      if (!r.ok)
        throw new Error(data.error || 'Não foi possível carregar o quadro.');
      if (catalogResponse.ok) {
        setProjects(catalog.projects?.map((item) => item.name) || defaultProjects);
        setSectors(catalog.sectors?.map((item) => item.name) || defaultSectors);
        setProjectColors(Object.fromEntries((catalog.projects || []).map((item) => [item.name, item.color || '#d8e5e5'])));
      }
      if (data.actions?.length) {
        const normalized = data.actions.map((action) =>
          dayDiff(action.date) < 0
            ? { ...action, date: dateForDay(action.day) }
            : action,
        );
        setActions(normalized);
        void Promise.all(
          normalized
            .filter((action, index) => action.date !== data.actions![index].date)
            .map((action) => api('PUT', action)),
        );
        return;
      }
      setActions([]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Não foi possível carregar o quadro.',
      );
    } finally {
      setLoading(false);
    }
  }
  async function signIn() {
    setSaving(true);
    setLoginError(null);
    try {
      const response = await fetch('/api/editor-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await response.json() as { authenticated?: boolean; error?: string };
      if (!response.ok || !data.authenticated) throw new Error(data.error || 'Não foi possível acessar a edição.');
      setEditorMode(true);
      setLoginOpen(false);
      setPassword('');
      void load();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Não foi possível acessar a edição.');
    } finally { setSaving(false); }
  }
  // O modo de concluídos complementa o quadro: as ações abertas continuam visíveis.
  const visible = actions.filter(
    (a) =>
      (showCompleted || !a.completed) &&
      (!selectedProject || projectIdentity(a.project) === projectIdentity(selectedProject)) &&
      (!query.trim() || [a.title, a.observation, a.owner, a.sector, a.project, a.criticality]
        .some((value) => value.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')))),
  );
  const counters = useMemo(
    () =>
      statuses.map((status) => ({
        status,
        total: actions.filter((a) => state(a) === status).length,
      })),
    [actions],
  );
  const projectActionCounts = useMemo(
    () => Object.fromEntries(projects.map((project) => [
      project,
      actions.filter((action) => !action.completed && projectIdentity(action.project) === projectIdentity(project)).length,
    ])),
    [actions, projects],
  );
  const reportActions = useMemo(
    () => actions
      .filter((action) =>
        !action.completed &&
        (reportProject === '__all' || projectIdentity(action.project) === projectIdentity(reportProject)) &&
        (reportSector === '__all' || action.sector === reportSector),
      )
      .sort((a, b) => {
        const criticalityOrder = criticalities.indexOf(b.criticality) - criticalities.indexOf(a.criticality);
        return criticalityOrder || a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
      }),
    [actions, reportProject, reportSector],
  );
  const reportGroups = useMemo(() => {
    const grouped = new Map<string, Map<string, Action[]>>();
    reportActions.forEach((action) => {
      const sectorGroups = grouped.get(action.project) || new Map<string, Action[]>();
      sectorGroups.set(action.sector, [...(sectorGroups.get(action.sector) || []), action]);
      grouped.set(action.project, sectorGroups);
    });
    return [...grouped.entries()];
  }, [reportActions]);
  const reportSummary = useMemo(() => ({
    critical: reportActions.filter((action) => action.criticality === 'Crítico').length,
    attention: reportActions.filter((action) => state(action) === 'Crítico' || state(action) === 'Atenção').length,
    sectors: new Set(reportActions.map((action) => action.sector)).size,
  }), [reportActions]);
  const reportText = useMemo(() => {
    const header = [
      'RELATÓRIO DE PENDÊNCIAS | PMO MAKRO',
      `Gerado em: ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}`,
      `Filtros: Projeto ${reportProject === '__all' ? 'Todos' : reportProject} | Setor ${reportSector === '__all' ? 'Todos' : reportSector}`,
      `Resumo: ${reportActions.length} pendência(s) aberta(s) | ${reportSummary.critical} crítica(s) | ${reportSummary.attention} com atenção por prazo`,
    ];
    const groups = reportGroups.flatMap(([project, sectorGroups]) => [
      `\nPROJETO: ${project}`,
      ...[...sectorGroups.entries()].flatMap(([sector, items]) => [
        `  SETOR: ${sector}`,
        ...items.map((action) => [
          `  • ${action.title}`,
          `    Prazo: ${formatDate(action.date)} | Criticidade: ${action.criticality} | Status: ${state(action)}`,
          `    Responsável: ${action.owner} | Tempo em aberto: ${openDuration(action.createdAt, action.completed)}`,
          `    Observação: ${action.observation || 'Sem observação registrada.'}`,
        ].join('\n')),
      ]),
    ]);
    return [...header, ...groups].join('\n');
  }, [reportActions, reportGroups, reportProject, reportSector, reportSummary]);
  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText);
      setReportCopied(true);
      window.setTimeout(() => setReportCopied(false), 2200);
    } catch {
      setError('Não foi possível copiar o relatório. Tente novamente.');
    }
  }
  const attention = actions
    .filter(
      (a) => !a.completed && (state(a) === 'Crítico' || state(a) === 'Atenção'),
    )
    .slice(0, 3);
  const edit = (a: Action) => {
    const { id, ...rest } = a;
    setForm(rest);
    setEditing(a);
    setDateHistory([]);
    void fetch(`/api/postit-actions?history=${encodeURIComponent(a.id)}`)
      .then((response) => response.json())
      .then((data: { history?: DateHistory[] }) => setDateHistory(data.history || []))
      .catch(() => undefined);
  };
  const create = () => {
    const draft = empty();
    setForm({
      ...draft,
      project: selectedProject || draft.project,
      date: dateForDay(draft.day),
    });
    setCreating(true);
  };
  async function save() {
    if (!form.title.trim() || !form.owner.trim() || !form.date) return;
    setSaving(true);
    setError(null);
    try {
      const action = editing
        ? { ...form, id: editing.id, day: boardDay(form.date) }
        : { ...form, id: crypto.randomUUID(), day: boardDay(form.date), createdAt: new Date().toISOString() };
      const out = await api(editing ? 'PUT' : 'POST', action);
      setActions((all) =>
        editing
          ? all.map((a) => (a.id === action.id ? (out.action as Action) : a))
          : [out.action as Action, ...all],
      );
      setEditing(null);
      setCreating(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Não foi possível salvar a ação.',
      );
    } finally {
      setSaving(false);
    }
  }
  async function move(id: string, day: Day, sector: Sector) {
    const before = actions.find((a) => a.id === id);
    if (!before || (before.day === day && before.sector === sector)) return;
    const changed = { ...before, day, sector, date: dateForDay(day, before.day) };
    setActions((all) => all.map((a) => (a.id === id ? changed : a)));
    setError(null);
    try {
      const out = await api('PUT', changed);
      setActions((all) =>
        all.map((a) => (a.id === id ? (out.action as Action) : a)),
      );
    } catch (e) {
      setActions((all) => all.map((a) => (a.id === id ? before : a)));
      setError(
        e instanceof Error ? e.message : 'Não foi possível mover a ação.',
      );
    }
  }
  async function complete(a: Action) {
    setSaving(true);
    setError(null);
    try {
      const out = await api('PUT', { ...a, completed: !a.completed });
      setActions((all) =>
        all.map((x) => (x.id === a.id ? (out.action as Action) : x)),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Não foi possível concluir a ação.',
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!editing) return;
    setSaving(true);
    try {
      await api('DELETE', { id: editing.id });
      setActions((all) => all.filter((a) => a.id !== editing.id));
      setEditing(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Não foi possível excluir a ação.',
      );
    } finally {
      setSaving(false);
    }
  }
  const drag = (e: DragEvent<HTMLElement>, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDragged(id);
  };
  const drop = (e: DragEvent<HTMLDivElement>, d: Day, s: Sector) => {
    e.preventDefault();
    void move(e.dataTransfer.getData('text/plain') || dragged || '', d, s);
    setDragged(null);
    setDropTarget(null);
  };
  async function saveCatalog() {
    if (!catalogType || !catalogName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/postit-catalog', {
        method: editingSector || editingProject ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSector ? { type: 'sector', oldName: editingSector, name: catalogName } : editingProject ? { type: 'project', oldName: editingProject, name: catalogName, color: catalogColor } : { type: catalogType, name: catalogName, color: catalogColor }),
      });
      const data = await response.json() as { item?: { name: string; color?: string }; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || 'Não foi possível salvar o cadastro.');
      if (editingSector) {
        setSectors((all) => all.map((sector) => sector === editingSector ? data.item!.name : sector));
        setActions((all) => all.map((action) => action.sector === editingSector ? { ...action, sector: data.item!.name } : action));
      } else if (editingProject) {
        setProjects((all) => all.map((project) => project === editingProject ? data.item!.name : project));
        setProjectColors((all) => {
          const { [editingProject]: _oldColor, ...rest } = all;
          return { ...rest, [data.item!.name]: data.item!.color || '#d8e5e5' };
        });
        setActions((all) => all.map((action) => action.project === editingProject ? { ...action, project: data.item!.name } : action));
        setSelectedProject((current) => current === editingProject ? data.item!.name : current);
      } else if (catalogType === 'project') {
        setProjects((all) => [...all, data.item!.name]);
        setProjectColors((all) => ({ ...all, [data.item!.name]: data.item!.color || '#d8e5e5' }));
      } else setSectors((all) => [...all, data.item!.name]);
      setCatalogName('');
      setCatalogColor('#d9c7f3');
      setEditingSector(null);
      setEditingProject(null);
      setCatalogType(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar o cadastro.');
    } finally {
      setSaving(false);
    }
  }
  const openProjectEdit = (project: string) => {
    setCatalogType('project');
    setEditingProject(project);
    setEditingSector(null);
    setCatalogName(project);
    setCatalogColor(projectColors[project] || '#d8e5e5');
    setManagingProjects(false);
  };
  async function deleteProject(project: string) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/postit-catalog', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'project', name: project }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível excluir o projeto.');
      setProjects((all) => all.filter((item) => item !== project));
      setProjectColors((all) => { const { [project]: _removed, ...rest } = all; return rest; });
      setSelectedProject((current) => current === project ? null : current);
      setDeleteProjectPending(null);
      setManagingProjects(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível excluir o projeto.');
      setDeleteProjectPending(null);
    } finally { setSaving(false); }
  }
  return (
    <>
      <PmoToolHeader title="Quadro de ações" subtitle="Acompanhamento semanal" backHref="/" />
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headContent}>
          <div>
            <h1>Quadro semanal de ações</h1>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.searchBox}>
              <Search size={15} />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar ação ou responsável" aria-label="Pesquisar post-its" />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowCompleted((v) => !v)}
            >
              {showCompleted ? 'Ocultar concluídos' : 'Visualizar concluídos'}
            </Button>
            {canEdit && <Button variant="outline" onClick={() => setReportOpen(true)}>
              <FileText /> Relatório de pendências
            </Button>}
            {canEdit && <>
              <Button variant="outline" onClick={() => setCatalogType('project')}>
                <Plus /> Projeto
              </Button>
              <Button variant="outline" onClick={() => setManagingProjects(true)}>
                <Pencil /> Projetos
              </Button>
              <Button variant="outline" onClick={() => setCatalogType('sector')}>
                <Plus /> Setor
              </Button>
              <Button className={styles.newButton} onClick={create}>
                <Plus /> Nova ação
              </Button>
            </>}
            {viewOnly ? <a href={`/postits?projeto=${encodeURIComponent(selectedProject || '')}`} className={styles.newButton}>Acessar edição</a> : !editorMode && <Button className={styles.newButton} onClick={() => setLoginOpen(true)}>Acessar edição</Button>}
          </div>
        </div>
        {error && (
          <div className={styles.errorNotice}>
            {error}{' '}
            <button onClick={() => void load()}>Tentar novamente</button>
          </div>
        )}
      </header>
      <section className={styles.boardShell}>
        <div className={styles.board}>
          <div className={[styles.corner, styles.gridHead].join(' ')}>
            SETOR / ÁREA
          </div>
          {days.map((d) => (
            <div
              className={[styles.dayHead, styles.gridHead].join(' ')}
              key={d.id}
            >
              <strong>{d.label}</strong>
            </div>
          ))}
          {sectors.map((sector) => (
            <div className={styles.row} key={sector}>
              <button className={styles.sectorLabel} disabled={!canEdit} onClick={() => { if (canEdit) { setCatalogType('sector'); setEditingSector(sector); setCatalogName(sector); } }}> {sector} </button>
              {days.map((d) => (
                <div
                  key={d.id}
                  className={[
                    styles.cell,
                    canEdit && dragged ? styles.dropReady : '',
                    canEdit && dropTarget === `${sector}-${d.id}` ? styles.dropActive : '',
                  ].join(' ')}
                  onDragEnter={() => canEdit && setDropTarget(`${sector}-${d.id}`)}
                  onDragOver={(e) => { if (canEdit) { e.preventDefault(); setDropTarget(`${sector}-${d.id}`); } }}
                  onDrop={(e) => { if (canEdit) drop(e, d.id, sector); }}
                >
                  {visible
                    .filter((a) => a.sector === sector && boardDay(a.date) === d.id)
                    .map((a) => (
                      <article
                        key={a.id}
                        className={cn(a)}
                        style={{ backgroundColor: projectColor(a.project, projectColors), color: projectTextColor(projectColor(a.project, projectColors)) }}
                        draggable={canEdit}
                        onDragStart={(e) => canEdit && drag(e, a.id)}
                        onDragEnd={() => { if (canEdit) { setDragged(null); setDropTarget(null); } }}
                        onMouseEnter={(event) => setHovered({ action: a, x: event.clientX, y: event.clientY })}
                        onMouseMove={(event) => setHovered({ action: a, x: event.clientX, y: event.clientY })}
                        onMouseLeave={() => setHovered(null)}
                      >
                        <button
                          className={styles.postitBody}
                          onClick={() => { if (viewOnly) setViewing(a); else if (canEdit) edit(a); }}
                        >
                          <span className={styles.postitTop}>
                            <GripVertical size={14} />
                            <em>{a.project}</em>
                          </span>
                          <strong>{a.title}</strong>
                          <span className={styles.observation}>
                            {a.observation}
                          </span>
                          <span className={styles.owner}>
                            <UserRound size={12} /> {a.owner}
                          </span>
                          <span
                            className={styles.criticality}
                            data-level={a.criticality}
                          >
                            {a.criticality}
                          </span>
                        </button>
                        {canEdit && <button
                          className={styles.completeButton}
                          disabled={saving}
                          onClick={() => void complete(a)}
                        >
                          {a.completed ? 'Reabrir' : 'Concluir'}
                        </button>}
                      </article>
                    ))}
                </div>
              ))}
            </div>
          ))}
        </div>
        {loading && (
          <div className={styles.loadingBoard}>Carregando ações…</div>
        )}
      </section>
      {hovered && <aside
        className={styles.postitPreview}
        aria-hidden="true"
        style={{
          left: Math.min(hovered.x + 16, Math.max(12, window.innerWidth - 292)),
          top: Math.min(hovered.y + 16, Math.max(12, window.innerHeight - 210)),
        }}
      >
        <b>{hovered.action.title}</b>
        <span>{hovered.action.project} · {hovered.action.sector}</span>
        <span>Conclusão: {formatDate(hovered.action.date)}</span>
        <span><UserRound size={12} /> {hovered.action.owner}</span>
        <p>{hovered.action.observation || 'Sem observação registrada.'}</p>
      </aside>}
      <section className={styles.footerGrid}>
        <div className={styles.controlCard}>
          <div className={styles.cardTitle}>
            <span className={styles.marker} /> Projetos
          </div>
          <div className={styles.legend}>
            {projects.map((p) => (
              <button
                key={p}
                type="button"
                className={selectedProject === p ? styles.legendActive : styles.legendButton}
                onClick={() => setSelectedProject((current) => current === p ? null : p)}
                aria-pressed={selectedProject === p}
              >
                <i style={{ backgroundColor: projectColor(p, projectColors) }} /> {p} ({projectActionCounts[p] || 0})
              </button>
            ))}
          </div>
          <p>{selectedProject ? `Exibindo ${selectedProject}. Clique novamente para ver todos.` : 'Clique em um projeto para filtrar o quadro. O número indica ações abertas.'}</p>
        </div>
        <div className={styles.controlCard}>
          <div className={styles.cardTitle}>
            <CircleAlert size={16} /> Status por prazo
          </div>
          <div className={styles.statusCounts}>
            {counters.map((x) => (
              <span
                key={x.status}
                className={styles['status' + x.status.replace(' ', '')]}
              >
                <i /> {x.total} {x.status}
              </span>
            ))}
          </div>
          <p>O status é atualizado pela data prevista.</p>
        </div>
        <div className={styles.controlCard}>
          <div className={styles.cardTitle}>
            <CheckCircle2 size={16} /> Buffer por projeto
          </div>
          <p>—</p>
        </div>
        <div className={[styles.controlCard, styles.attentionCard].join(' ')}>
          <div className={styles.cardTitle}>
            <CircleAlert size={16} /> Atenções para a reunião
          </div>
          <ul>
            {attention.map((a) => (
              <li key={a.id}>
                <span
                  className={styles['status' + state(a).replace(' ', '')]}
                />
                <b>{a.title}</b>
                <small>{a.owner} · {a.criticality}</small>
              </li>
            ))}
          </ul>
        </div>
      </section>
      {canEdit && <Dialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar ação' : 'Nova ação'}</DialogTitle>
            <DialogDescription>
              A posição no quadro é calculada automaticamente pela data de conclusão.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.form}>
            <div className={styles.formWide}>
              <Label htmlFor="title">Título da ação</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className={styles.formWide}>
              <Label htmlFor="observation">Observação</Label>
              <Textarea
                id="observation"
                value={form.observation}
                onChange={(e) =>
                  setForm({ ...form, observation: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="owner">Responsável</Label>
              <Input
                id="owner"
                value={form.owner}
                onChange={(e) => setForm({ ...form, owner: e.target.value })}
              />
            </div>
            <Field
              label="Setor"
              value={form.sector}
              options={sectors}
              set={(v) => setForm({ ...form, sector: v as Sector })}
            />
            <div>
              <Label htmlFor="completion-date">Data de conclusão</Label>
              <Input id="completion-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value, day: boardDay(e.target.value) })} />
            </div>
            <Field
              label="Projeto"
              value={form.project}
              options={projects}
              set={(v) => setForm({ ...form, project: v as Project })}
            />
            <Field
              label="Criticidade"
              value={form.criticality}
              options={criticalities}
              set={(v) => setForm({ ...form, criticality: v as Criticality })}
            />
          </div>
          <div className={styles.dialogFooter}>
            <Button
              variant="outline"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              className={styles.newButton}
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? 'Salvando…' : 'Salvar ação'}
            </Button>
          </div>
          {editing && <div className={styles.dateAudit}>
            <p><strong>Data de inclusão:</strong> {formatDate(editing.createdAt)}</p>
            <p><strong>Tempo em aberto:</strong> {openDuration(editing.createdAt, editing.completed)}</p>
            <strong>Histórico de reprogramações</strong>
            {dateHistory.length ? <ul>{dateHistory.map((entry) => <li key={entry.id}>{formatDate(entry.previousDate)} → {formatDate(entry.newDate)} <span>{formatDate(entry.changedAt)}</span></li>)}</ul> : <p>Nenhuma reprogramação registrada.</p>}
          </div>}
          {editing && (
            <button
              className={styles.deleteAction}
              disabled={saving}
              onClick={() => void remove()}
            >
              <X size={14} /> Excluir ação
            </button>
          )}
        </DialogContent>
      </Dialog>}
      {canEdit && <Dialog open={catalogType !== null} onOpenChange={(open) => { if (!open) { setCatalogType(null); setCatalogName(''); setCatalogColor('#d9c7f3'); setEditingSector(null); setEditingProject(null); } }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Editar projeto' : catalogType === 'project' ? 'Novo projeto' : editingSector ? 'Editar setor' : 'Novo setor'}</DialogTitle>
            <DialogDescription>{editingProject ? 'A nomenclatura e a cor serão aplicadas imediatamente a todos os post-its deste projeto.' : catalogType === 'project' ? 'O projeto ficará disponível no quadro e identificado por uma nova cor.' : editingSector ? 'A nova nomenclatura será aplicada aos post-its deste setor.' : 'O setor será adicionado como uma nova linha no quadro semanal.'}</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="catalog-name">Nome</Label>
            <Input id="catalog-name" value={catalogName} onChange={(e) => setCatalogName(e.target.value)} placeholder={catalogType === 'project' ? 'Ex.: Projeto Alfa' : 'Ex.: Qualidade'} />
          </div>
          {catalogType === 'project' && <div className={styles.colorChoice}>
            <Label htmlFor="catalog-color">Cor do projeto</Label>
            <label className={styles.colorInput}>
              <input id="catalog-color" type="color" value={catalogColor} onChange={(e) => setCatalogColor(e.target.value)} aria-label="Escolher cor do projeto" />
              <span style={{ backgroundColor: catalogColor }} />
              {catalogColor.toUpperCase()}
            </label>
          </div>}
          <div className={styles.dialogFooter}>
            <Button variant="outline" onClick={() => setCatalogType(null)}>Cancelar</Button>
            <Button className={styles.newButton} disabled={saving} onClick={() => void saveCatalog()}>{editingSector ? 'Salvar setor' : editingProject ? 'Salvar projeto' : 'Adicionar'}</Button>
          </div>
        </DialogContent>
      </Dialog>}
      {canEdit && <Dialog open={managingProjects} onOpenChange={setManagingProjects}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Gerenciar projetos</DialogTitle>
            <DialogDescription>Edite o nome e a cor, ou exclua projetos sem ações vinculadas.</DialogDescription>
          </DialogHeader>
          <div className={styles.projectManager}>
            {projects.map((project) => (
              <div key={project} className={styles.projectManagerItem}>
                <span><i style={{ backgroundColor: projectColor(project, projectColors) }} /> {project}</span>
                <div>
                  <Button variant="outline" size="sm" onClick={() => openProjectEdit(project)}><Pencil /> Editar</Button>
                  <Button variant="outline" size="sm" className={styles.deleteProjectButton} onClick={() => setDeleteProjectPending(project)}><Trash2 /> Excluir</Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>}
      {canEdit && <AlertDialog open={deleteProjectPending !== null} onOpenChange={(open) => !open && setDeleteProjectPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>O projeto será removido da legenda. A exclusão só é permitida quando não houver post-its vinculados a ele.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className={styles.deleteProjectConfirm} disabled={saving} onClick={() => deleteProjectPending && void deleteProject(deleteProjectPending)}>Excluir projeto</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>}
      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-[500px]">
          {viewing && <>
            <DialogHeader>
              <DialogTitle>{viewing.title}</DialogTitle>
              <DialogDescription>{viewing.project} · {viewing.sector}</DialogDescription>
            </DialogHeader>
            <div className={styles.viewerDetails}>
              <p>{viewing.observation || 'Sem observação registrada.'}</p>
              <span><UserRound size={14} /> Responsável: <b>{viewing.owner}</b></span>
              <span>Data de conclusão: <b>{formatDate(viewing.date)}</b></span>
              <span>Criticidade: <b>{viewing.criticality}</b></span>
              <span>Status: <b>{state(viewing)}</b></span>
            </div>
          </>}
        </DialogContent>
      </Dialog>
      {canEdit && <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-[820px]">
          <DialogHeader>
            <DialogTitle>Relatório de pendências</DialogTitle>
            <DialogDescription>Resumo das ações abertas, organizado por projeto e setor, pronto para compartilhar.</DialogDescription>
          </DialogHeader>
          <div className={styles.reportFilters}>
            <div>
              <Label htmlFor="report-project">Projeto</Label>
              <select id="report-project" className={styles.select} value={reportProject} onChange={(event) => setReportProject(event.target.value)}>
                <option value="__all">Todos os projetos</option>
                {projects.map((project) => <option key={project} value={project}>{project}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="report-sector">Setor</Label>
              <select id="report-sector" className={styles.select} value={reportSector} onChange={(event) => setReportSector(event.target.value)}>
                <option value="__all">Todos os setores</option>
                {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.reportSummary}>
            <span><b>{reportActions.length}</b> pendências abertas</span>
            <span><b>{reportSummary.critical}</b> críticas</span>
            <span><b>{reportSummary.attention}</b> com atenção por prazo</span>
            <span><b>{reportSummary.sectors}</b> setores envolvidos</span>
          </div>
          <div className={styles.reportBody}>
            {reportGroups.length === 0 ? <p className={styles.reportEmpty}>Não há pendências abertas para os filtros selecionados.</p> : reportGroups.map(([project, sectorGroups]) => (
              <section key={project} className={styles.reportProject}>
                <h3><i style={{ backgroundColor: projectColor(project, projectColors) }} /> {project}</h3>
                {[...sectorGroups.entries()].map(([sector, items]) => (
                  <div key={sector} className={styles.reportSector}>
                    <h4>{sector}</h4>
                    {items.map((action) => (
                      <article key={action.id} className={styles.reportAction}>
                        <div className={styles.reportActionHead}>
                          <strong>{action.title}</strong>
                          <span className={styles['criticality' + action.criticality.replace('é', 'e').replace('í', 'i')]}> {action.criticality} </span>
                        </div>
                        <p>{action.observation || 'Sem observação registrada.'}</p>
                        <div className={styles.reportMeta}>
                          <span>Responsável: <b>{action.owner}</b></span>
                          <span>Conclusão: <b>{formatDate(action.date)}</b></span>
                          <span>Status: <b>{state(action)}</b></span>
                          <span>{openDuration(action.createdAt, action.completed)}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>
          <div className={styles.dialogFooter}>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Fechar</Button>
            <Button className={styles.newButton} disabled={reportActions.length === 0} onClick={() => void copyReport()}>
              <Copy size={15} /> {reportCopied ? 'Relatório copiado' : 'Copiar relatório'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Acessar edição</DialogTitle>
            <DialogDescription>Informe a senha para editar o quadro semanal.</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="editor-password">Senha</Label>
            <Input id="editor-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void signIn(); }} autoFocus />
            {loginError && <p className={styles.loginError}>{loginError}</p>}
          </div>
          <div className={styles.dialogFooter}>
            <Button variant="outline" onClick={() => setLoginOpen(false)}>Cancelar</Button>
            <Button className={styles.newButton} disabled={saving || !password} onClick={() => void signIn()}>{saving ? 'Validando…' : 'Entrar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
    </>
  );
}
function Field({
  label,
  value,
  options,
  set,
}: {
  label: string;
  value: string;
  options: (string | { value: string; label: string })[];
  set: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        className={styles.select}
        value={value}
        onChange={(e) => set(e.target.value)}
      >
        {options.map((o) => {
          const x = typeof o === 'string' ? { value: o, label: o } : o;
          return (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}
