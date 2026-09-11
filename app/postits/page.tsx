'use client';

import { useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  GripVertical,
  Plus,
  RotateCcw,
  UserRound,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import styles from './postit-board.module.css';

type Day = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'd7';
type Sector = 'Manutenção' | 'Operação / MKT' | 'Suprimentos' | 'Financeiro' | 'DP / Gente & Gestão' | 'CDI' | 'Engenharia' | 'SMS';
type Project = 'AMP' | '5S8' | 'ALPPEX' | 'RINVEST' | 'ECOPÓS' | 'Geral';
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
  status: Status;
};

const days: { id: Day; label: string; date: string }[] = [
  { id: 'seg', label: 'Segunda', date: '14 set' },
  { id: 'ter', label: 'Terça', date: '15 set' },
  { id: 'qua', label: 'Quarta', date: '16 set' },
  { id: 'qui', label: 'Quinta', date: '17 set' },
  { id: 'sex', label: 'Sexta', date: '18 set' },
  { id: 'd7', label: 'D+7', date: 'até 25 set' },
];

const sectors: Sector[] = ['Manutenção', 'Operação / MKT', 'Suprimentos', 'Financeiro', 'DP / Gente & Gestão', 'CDI', 'Engenharia', 'SMS'];
const projects: Project[] = ['AMP', '5S8', 'ALPPEX', 'RINVEST', 'ECOPÓS', 'Geral'];
const statuses: Status[] = ['No prazo', 'Atenção', 'Crítico', 'Concluído'];

const seedActions: Action[] = [
  { id: '1', title: 'Validar plano de manutenção', observation: 'Consolidar prioridade das intervenções da semana.', owner: 'Marcos Silva', date: '2026-09-14', day: 'seg', sector: 'Manutenção', project: 'ECOPÓS', status: 'Atenção' },
  { id: '2', title: 'Aprovar janela de parada', observation: 'Confirmar impacto com operação e segurança.', owner: 'Camila Rocha', date: '2026-09-17', day: 'qui', sector: 'Manutenção', project: 'ALPPEX', status: 'Crítico' },
  { id: '3', title: 'Publicar campanha de captação', observation: 'Revisar peças e liberar cronograma de mídia.', owner: 'Bruno Costa', date: '2026-09-15', day: 'ter', sector: 'Operação / MKT', project: 'AMP', status: 'No prazo' },
  { id: '4', title: 'Fechar cotação de transportadora', observation: 'Comparar prazo, custo e disponibilidade.', owner: 'Larissa Melo', date: '2026-09-17', day: 'qui', sector: 'Suprimentos', project: '5S8', status: 'Atenção' },
  { id: '5', title: 'Atualizar previsão de caixa', observation: 'Incluir os recebimentos previstos para setembro.', owner: 'Fernanda Alves', date: '2026-09-18', day: 'sex', sector: 'Financeiro', project: 'RINVEST', status: 'No prazo' },
  { id: '6', title: 'Alinhar plano de mobilização', observation: 'Confirmar vagas, admissões e integração.', owner: 'Renata Dias', date: '2026-09-18', day: 'sex', sector: 'DP / Gente & Gestão', project: 'ALPPEX', status: 'Atenção' },
  { id: '7', title: 'Checar documentação de acesso', observation: 'Pendência de crachá e liberação de equipe.', owner: 'João Vitor', date: '2026-09-17', day: 'qui', sector: 'CDI', project: '5S8', status: 'Crítico' },
  { id: '8', title: 'Emitir revisão de projeto', observation: 'Subir revisão para validação do cliente.', owner: 'Paula Nunes', date: '2026-09-25', day: 'd7', sector: 'Engenharia', project: 'AMP', status: 'No prazo' },
  { id: '9', title: 'Liberar APR de atividade crítica', observation: 'Aguardar evidência de treinamento da frente.', owner: 'Diego Souza', date: '2026-09-17', day: 'qui', sector: 'SMS', project: 'RINVEST', status: 'Atenção' },
];

const blankAction = (): Omit<Action, 'id'> => ({ title: '', observation: '', owner: '', date: '2026-09-14', day: 'seg', sector: 'Manutenção', project: 'Geral', status: 'No prazo' });

function formatDate(value: string) {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}` : 'Sem data';
}

export default function PostitBoardPage() {
  const [actions, setActions] = useState<Action[]>(seedActions);
  const [hydrated, setHydrated] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Action | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Omit<Action, 'id'>>(blankAction());

  useEffect(() => {
    const saved = window.localStorage.getItem('makro-postit-actions');
    if (saved) {
      try { setActions(JSON.parse(saved)); } catch { /* mantém a prévia caso o dado local esteja inválido */ }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem('makro-postit-actions', JSON.stringify(actions));
  }, [actions, hydrated]);

  const counters = useMemo(() => statuses.map((status) => ({ status, total: actions.filter((item) => item.status === status).length })), [actions]);
  const critical = actions.filter((item) => item.status === 'Crítico' || item.status === 'Atenção').slice(0, 3);

  const openCreate = () => { setForm(blankAction()); setCreating(true); };
  const openEdit = (action: Action) => { const { id: _id, ...rest } = action; setForm(rest); setEditing(action); };
  const save = () => {
    if (!form.title.trim() || !form.owner.trim()) return;
    if (editing) setActions((current) => current.map((item) => item.id === editing.id ? { ...form, id: editing.id } : item));
    else setActions((current) => [{ ...form, id: crypto.randomUUID() }, ...current]);
    setEditing(null); setCreating(false);
  };
  const moveAction = (day: Day) => {
    if (draggedId) setActions((current) => current.map((item) => item.id === draggedId ? { ...item, day } : item));
    setDraggedId(null);
  };
  const onDragStart = (event: DragEvent<HTMLButtonElement>, id: string) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); setDraggedId(id); };
  const onDrop = (event: DragEvent<HTMLDivElement>, day: Day) => { event.preventDefault(); setDraggedId(event.dataTransfer.getData('text/plain') || draggedId); moveAction(day); };
  const resetDemo = () => { window.localStorage.removeItem('makro-postit-actions'); setActions(seedActions); };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.backLink} href="/">← Cockpit PMO</a>
        <div className={styles.headContent}>
          <div>
            <div className={styles.eyebrow}><span /> DADOS DEMONSTRATIVOS</div>
            <h1>Quadro semanal de ações</h1>
            <p>Organize os compromissos por setor e arraste os post-its entre os dias.</p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.weekBadge}><CalendarDays size={17} /> 14–18 set 2026</div>
            <Button className={styles.newButton} onClick={openCreate}><Plus /> Nova ação</Button>
          </div>
        </div>
      </header>

      <section className={styles.boardShell} aria-label="Quadro semanal por setor">
        <div className={styles.board}>
          <div className={`${styles.corner} ${styles.gridHead}`}>SETOR / ÁREA</div>
          {days.map((day) => <div className={`${styles.dayHead} ${styles.gridHead}`} key={day.id}><strong>{day.label}</strong><span>{day.date}</span></div>)}
          {sectors.map((sector) => (
            <div className={styles.row} key={sector}>
              <div className={styles.sectorLabel}>{sector}</div>
              {days.map((day) => {
                const items = actions.filter((item) => item.sector === sector && item.day === day.id);
                return <div key={day.id} className={`${styles.cell} ${draggedId ? styles.dropReady : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, day.id)}>
                  {items.map((action) => <button key={action.id} className={`${styles.postit} ${styles[`project${action.project}`]} ${styles[`status${action.status.replace(' ', '')}`]}`} draggable onDragStart={(event) => onDragStart(event, action.id)} onDragEnd={() => setDraggedId(null)} onClick={() => openEdit(action)} aria-label={`Editar ação: ${action.title}`}>
                    <span className={styles.postitTop}><GripVertical size={14} /><em>{action.project}</em><b>{formatDate(action.date)}</b></span>
                    <strong>{action.title}</strong>
                    <span className={styles.observation}>{action.observation}</span>
                    <span className={styles.owner}><UserRound size={12} /> {action.owner}</span>
                  </button>)}
                </div>;
              })}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.footerGrid}>
        <div className={styles.controlCard}>
          <div className={styles.cardTitle}><span className={styles.marker} /> Projetos</div>
          <div className={styles.legend}>{projects.map((project) => <span key={project}><i className={styles[`project${project}`]} /> {project}</span>)}</div>
          <p>As cores identificam o projeto de cada ação.</p>
        </div>
        <div className={styles.controlCard}>
          <div className={styles.cardTitle}><CircleAlert size={16} /> Status</div>
          <div className={styles.statusCounts}>{counters.map(({ status, total }) => <span key={status} className={styles[`status${status.replace(' ', '')}`]}><i /> {total} {status}</span>)}</div>
          <p>O contorno mostra a situação da ação.</p>
        </div>
        <div className={styles.controlCard}>
          <div className={styles.cardTitle}><CheckCircle2 size={16} /> Buffer da semana</div>
          <div className={styles.buffer}><span>Capacidade comprometida</span><strong>72%</strong><div><i /></div></div>
          <p>17 ações cadastradas · margem operacional de 28%.</p>
        </div>
        <div className={`${styles.controlCard} ${styles.attentionCard}`}>
          <div className={styles.cardTitle}><CircleAlert size={16} /> Atenções para a reunião</div>
          <ul>{critical.map((action) => <li key={action.id}><span className={styles[`status${action.status.replace(' ', '')}`]} /> <b>{action.title}</b><small>{action.owner} · {formatDate(action.date)}</small></li>)}</ul>
        </div>
      </section>

      <div className={styles.resetLine}><button onClick={resetDemo}><RotateCcw size={14} /> Restaurar dados demonstrativos</button><span>As alterações deste protótipo ficam salvas neste navegador.</span></div>

      <Dialog open={creating || editing !== null} onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null); } }}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader><DialogTitle>{editing ? 'Editar ação' : 'Nova ação'}</DialogTitle><DialogDescription>Preencha os dados do post-it. Depois, ele pode ser arrastado para outro dia.</DialogDescription></DialogHeader>
          <div className={styles.form}>
            <div className={styles.formWide}><Label htmlFor="title">Título da ação</Label><Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Confirmar mobilização da equipe" /></div>
            <div className={styles.formWide}><Label htmlFor="observation">Observação</Label><Textarea id="observation" value={form.observation} onChange={(e) => setForm({ ...form, observation: e.target.value })} placeholder="Contexto, dependência ou próximo passo" /></div>
            <div><Label htmlFor="owner">Responsável</Label><Input id="owner" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Nome do responsável" /></div>
            <div><Label htmlFor="date">Data</Label><Input id="date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <SelectField label="Setor" value={form.sector} onChange={(value) => setForm({ ...form, sector: value as Sector })} options={sectors} />
            <SelectField label="Dia no quadro" value={form.day} onChange={(value) => setForm({ ...form, day: value as Day })} options={days.map((day) => ({ value: day.id, label: day.label }))} />
            <SelectField label="Projeto" value={form.project} onChange={(value) => setForm({ ...form, project: value as Project })} options={projects} />
            <SelectField label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value as Status })} options={statuses} />
          </div>
          <div className={styles.dialogFooter}><Button variant="outline" onClick={() => { setCreating(false); setEditing(null); }}>Cancelar</Button><Button className={styles.newButton} onClick={save}>Salvar ação</Button></div>
          {editing && <button className={styles.deleteAction} onClick={() => { setActions((current) => current.filter((item) => item.id !== editing.id)); setEditing(null); }}><X size={14} /> Excluir ação</button>}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: (string | { value: string; label: string })[] }) {
  return <div><Label>{label}</Label><select className={styles.select} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => { const item = typeof option === 'string' ? { value: option, label: option } : option; return <option key={item.value} value={item.value}>{item.label}</option>; })}</select></div>;
}
