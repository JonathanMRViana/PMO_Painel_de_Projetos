'use client';
import { useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
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
export default function PostitBoardPage() {
  const [actions, setActions] = useState<Action[]>([]),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null),
    [dragged, setDragged] = useState<string | null>(null),
    [dropTarget, setDropTarget] = useState<string | null>(null),
    [editing, setEditing] = useState<Action | null>(null),
    [creating, setCreating] = useState(false),
    [showCompleted, setShowCompleted] = useState(false),
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
    [dateHistory, setDateHistory] = useState<DateHistory[]>([]),
    [form, setForm] = useState<Omit<Action, 'id'>>(empty());
  useEffect(() => {
    void load();
  }, []);
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
      const saved = await Promise.all(
        seed.map((a) => api('POST', a).then((x) => x.action as Action)),
      );
      setActions(saved);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Não foi possível carregar o quadro.',
      );
    } finally {
      setLoading(false);
    }
  }
  // O modo de concluídos complementa o quadro: as ações abertas continuam visíveis.
  const visible = actions.filter(
    (a) =>
      (showCompleted || !a.completed) &&
      (!selectedProject || a.project === selectedProject),
  );
  const counters = useMemo(
    () =>
      statuses.map((status) => ({
        status,
        total: actions.filter((a) => state(a) === status).length,
      })),
    [actions],
  );
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
    setForm({ ...draft, date: dateForDay(draft.day) });
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
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.backLink} href="/">
          ← Cockpit PMO
        </a>
        <div className={styles.headContent}>
          <div>
            <h1>Quadro semanal de ações</h1>
            <p>
              Organize as ações na janela móvel de acompanhamento.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Button
              variant="outline"
              onClick={() => setShowCompleted((v) => !v)}
            >
              {showCompleted ? 'Ocultar concluídos' : 'Visualizar concluídos'}
            </Button>
            <div className={styles.weekBadge}>
              <CalendarDays size={17} /> Janela móvel D+7
            </div>
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
              <button className={styles.sectorLabel} onClick={() => { setCatalogType('sector'); setEditingSector(sector); setCatalogName(sector); }}> {sector} </button>
              {days.map((d) => (
                <div
                  key={d.id}
                  className={[
                    styles.cell,
                    dragged ? styles.dropReady : '',
                    dropTarget === `${sector}-${d.id}` ? styles.dropActive : '',
                  ].join(' ')}
                  onDragEnter={() => setDropTarget(`${sector}-${d.id}`)}
                  onDragOver={(e) => { e.preventDefault(); setDropTarget(`${sector}-${d.id}`); }}
                  onDrop={(e) => drop(e, d.id, sector)}
                >
                  {visible
                    .filter((a) => a.sector === sector && boardDay(a.date) === d.id)
                    .map((a) => (
                      <article
                        key={a.id}
                        className={cn(a)}
                        style={{ backgroundColor: projectColors[a.project], color: projectTextColor(projectColors[a.project]) }}
                        draggable
                        onDragStart={(e) => drag(e, a.id)}
                        onDragEnd={() => { setDragged(null); setDropTarget(null); }}
                      >
                        <button
                          className={styles.postitBody}
                          onClick={() => edit(a)}
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
                        <button
                          className={styles.completeButton}
                          disabled={saving}
                          onClick={() => void complete(a)}
                        >
                          {a.completed ? 'Reabrir' : 'Concluir'}
                        </button>
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
                <i style={{ backgroundColor: projectColors[p] }} /> {p}
              </button>
            ))}
          </div>
          <p>{selectedProject ? `Exibindo ${selectedProject}. Clique novamente para ver todos.` : 'Clique em um projeto para filtrar o quadro.'}</p>
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
            <CheckCircle2 size={16} /> Buffer da semana
          </div>
          <div className={styles.buffer}>
            <span>Capacidade comprometida</span>
            <strong>72%</strong>
            <div>
              <i />
            </div>
          </div>
          <p>
            {actions.filter((a) => !a.completed).length} ações ativas · margem
            operacional de 28%.
          </p>
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
      <Dialog
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
      </Dialog>
      <Dialog open={catalogType !== null} onOpenChange={(open) => { if (!open) { setCatalogType(null); setCatalogName(''); setCatalogColor('#d9c7f3'); setEditingSector(null); setEditingProject(null); } }}>
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
      </Dialog>
      <Dialog open={managingProjects} onOpenChange={setManagingProjects}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Gerenciar projetos</DialogTitle>
            <DialogDescription>Edite o nome e a cor, ou exclua projetos sem ações vinculadas.</DialogDescription>
          </DialogHeader>
          <div className={styles.projectManager}>
            {projects.map((project) => (
              <div key={project} className={styles.projectManagerItem}>
                <span><i style={{ backgroundColor: projectColors[project] }} /> {project}</span>
                <div>
                  <Button variant="outline" size="sm" onClick={() => openProjectEdit(project)}><Pencil /> Editar</Button>
                  <Button variant="outline" size="sm" className={styles.deleteProjectButton} onClick={() => setDeleteProjectPending(project)}><Trash2 /> Excluir</Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteProjectPending !== null} onOpenChange={(open) => !open && setDeleteProjectPending(null)}>
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
      </AlertDialog>
    </main>
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
