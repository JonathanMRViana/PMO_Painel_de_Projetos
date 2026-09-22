'use client';
import '@/lib/github-pages-api';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart3, ChevronDown, Pencil, Plus, Truck, X } from 'lucide-react';
import { PmoToolHeader } from '@/components/pmo-tool-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type Project = { code: string; name: string; color: string };
type OprRecord = {
  id: string; projectCode: string; client: string; fleet: string; description: string;
  sourceTaskId: string | null;
  plannedDate: string; matrixArrivalDate: string; fleetDefinition: string; basicKit: string;
  maintenanceRelease: string; configuration: string; acquisition: string; adaptations: string;
  fleetDocumentation: string; teamDefinition: string; badge: string; teamDocumentation: string;
  pgrPcmso: string; legalDocuments: string; clientInspection: string; billing: string;
};

type FormState = Omit<OprRecord, 'id' | 'sourceTaskId'>;
const emptyForm = (): FormState => ({
  projectCode: '', client: '', fleet: '', description: '', plannedDate: '', matrixArrivalDate: '',
  fleetDefinition: '', basicKit: '', maintenanceRelease: '', configuration: '', acquisition: '',
  adaptations: '', fleetDocumentation: '', teamDefinition: '', badge: '', teamDocumentation: '',
  pgrPcmso: '', legalDocuments: '', clientInspection: '', billing: '',
});

const milestones: Array<{ group: string; items: Array<[keyof FormState, string]> }> = [
  { group: 'Frota', items: [['fleetDefinition', 'Definição'], ['basicKit', 'Kit básico'], ['maintenanceRelease', 'Lib. manutenção'], ['configuration', 'Configuração'], ['acquisition', 'Aquisição'], ['adaptations', 'Adequações'], ['fleetDocumentation', 'Documentação']] },
  { group: 'Equipe', items: [['teamDefinition', 'Definir equipe'], ['badge', 'Crachá'], ['teamDocumentation', 'Documentação']] },
  { group: 'Empresa', items: [['pgrPcmso', 'PGR / PCMSO'], ['legalDocuments', 'Documentos legais'], ['clientInspection', 'Vistoria cliente']] },
  { group: 'Faturamento', items: [['billing', 'Faturamento']] },
];

function done(value: string) {
  return value.trim().toUpperCase() === 'OK';
}

function display(value: string) {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
  return value;
}

function statusClass(value: string) {
  if (!value) return 'border-slate-200 bg-slate-50 text-slate-400';
  if (done(value)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export function ExecutiveOprClient() {
  const requestedProject = useSearchParams().get('projeto')?.trim() || '';
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<OprRecord[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [editor, setEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSourceLinked, setEditingSourceLinked] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  async function load(projectCode = selectedProject) {
    setLoading(true); setError('');
    try {
      const [overviewResponse, sessionResponse, oprResponse] = await Promise.all([
        fetch('/api/project-overview', { cache: 'no-store' }),
        fetch('/api/editor-session', { cache: 'no-store' }),
        fetch(`/api/executive-opr${projectCode ? `?projeto=${encodeURIComponent(projectCode)}` : ''}`, { cache: 'no-store' }),
      ]);
      const [overview, session, opr] = await Promise.all([overviewResponse.json(), sessionResponse.json(), oprResponse.json()]);
      if (!overviewResponse.ok) throw new Error(overview.error || 'Não foi possível carregar os projetos.');
      if (!oprResponse.ok) throw new Error(opr.error || 'Não foi possível carregar a OPR.');
      const loadedProjects = overview.projects || [];
      setProjects(loadedProjects); setEditor(Boolean(session.authenticated)); setRecords(opr.records || []);
      if (!projectCode && loadedProjects.length === 1) setSelectedProject(loadedProjects[0].code);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a OPR.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (requestedProject) setSelectedProject(requestedProject); else void load(''); }, [requestedProject]);

  useEffect(() => {
    if (selectedProject) void load(selectedProject);
  // This is intentionally driven only by filter changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  const summary = useMemo(() => {
    const milestoneValues = records.flatMap((record) => milestones.flatMap((group) => group.items.map(([key]) => record[key])));
    const totalSteps = milestoneValues.filter(Boolean).length;
    const completeSteps = milestoneValues.filter(done).length;
    return { fleets: records.length, completeSteps, pendingSteps: Math.max(0, totalSteps - completeSteps), ready: records.filter((record) => milestones.every((group) => group.items.every(([key]) => done(record[key])))).length };
  }, [records]);

  function openNew() {
    const project = projects.find((item) => item.code === selectedProject);
    setEditingId(null);
    setEditingSourceLinked(false);
    setForm({ ...emptyForm(), projectCode: selectedProject, client: project?.name || '' });
    setDialogOpen(true);
  }

  function openEdit(record: OprRecord) {
    const { id, sourceTaskId, ...nextForm } = record;
    setEditingId(id); setEditingSourceLinked(Boolean(sourceTaskId)); setForm(nextForm); setDialogOpen(true);
  }

  async function save() {
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/executive-opr', {
        method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar a frota.');
      setDialogOpen(false); await load(form.projectCode);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a frota.'); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!editingId || !window.confirm('Excluir esta frota da OPR?')) return;
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/executive-opr', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingId }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível excluir a frota.');
      setDialogOpen(false); await load(selectedProject);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível excluir a frota.'); }
    finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-[#f4f6f7] text-slate-900">
    <PmoToolHeader title="Visão Executiva" subtitle="OPR de mobilização por projeto" backHref="/">
      {editor && <Button onClick={openNew} disabled={!selectedProject}><Plus /> Adicionar frota</Button>}
    </PmoToolHeader>
    <div className="mx-auto w-full max-w-none px-3 py-7 sm:px-5">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#ed1c24]">Acompanhamento executivo</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">OPR</h1>
          <p className="mt-2 text-sm text-slate-600">Mobilização de frota, equipe, empresa e faturamento.</p>
        </div>
        <label className="grid gap-1 text-xs font-bold text-slate-600">Projeto
          <span className="relative"><select value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)} className="h-10 min-w-[260px] appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm font-semibold text-slate-800 outline-none focus:border-[#103f85]">
            <option value="">Todos os projetos</option>
            {projects.map((project) => <option key={project.code} value={project.code}>{project.name} · {project.code}</option>)}
          </select><ChevronDown className="pointer-events-none absolute right-3 top-2.5 text-slate-500" size={16} /></span>
        </label>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["Frotas", summary.fleets, Truck], ["Etapas concluídas", summary.completeSteps, BarChart3], ["Pendências", summary.pendingSteps, X], ["Prontas para faturar", summary.ready, Truck]].map(([label, value, Icon]) => <article key={String(label)} className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"><div className="flex items-center justify-between text-sm font-semibold text-slate-600"><span>{label}</span><Icon size={17} className="text-[#103f85]" /></div><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></article>)}
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold">OPR por frota</h2><p className="mt-0.5 text-xs text-slate-500">A frota é vinculada ao pilar Equipamentos: inclua por aqui ou pelo cronograma.</p></div>
        {error ? <div className="px-5 py-10 text-center text-sm text-red-600">{error}</div> : loading ? <div className="px-5 py-10 text-center text-sm text-slate-500">Carregando OPR...</div> : records.length === 0 ? <div className="px-5 py-12 text-center"><Truck className="mx-auto text-[#103f85]" size={28} /><p className="mt-3 font-semibold">Nenhuma frota registrada nesta OPR.</p><p className="mt-1 text-sm text-slate-600">Cadastre pela OPR ou no pilar Equipamentos do cronograma. O registro será o mesmo nas duas visões.</p></div> : <div className="overflow-x-auto"><table className="min-w-[1480px] w-full border-collapse text-left text-xs"><thead className="bg-[#103f85] text-white"><tr><th className="sticky left-0 z-10 bg-[#103f85] px-3 py-3 font-bold">Frota</th><th className="px-3 py-3">Descrição</th><th className="px-3 py-3">MOB planejado</th><th className="px-3 py-3">Chegada matriz</th>{milestones.flatMap((group) => group.items.map(([key, label]) => <th key={String(key)} className="px-3 py-3 whitespace-nowrap">{label}</th>))}{editor && <th className="px-3 py-3">Editar</th>}</tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-t border-slate-200 hover:bg-slate-50"><td className="sticky left-0 bg-white px-3 py-3 font-bold text-slate-800 group-hover:bg-slate-50">{record.fleet}<span className="mt-1 block font-normal text-slate-500">{record.client}</span>{record.sourceTaskId && <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-[#103f85]">Cronograma</span>}</td><td className="max-w-48 px-3 py-3 text-slate-600">{record.description || '—'}</td><td className="px-3 py-3 whitespace-nowrap">{display(record.plannedDate)}</td><td className="px-3 py-3 whitespace-nowrap">{display(record.matrixArrivalDate)}</td>{milestones.flatMap((group) => group.items.map(([key]) => <td key={String(key)} className="px-3 py-3"><span className={`inline-flex min-w-12 justify-center rounded-md border px-2 py-1 font-semibold ${statusClass(record[key])}`}>{display(record[key])}</span></td>))}{editor && <td className="px-3 py-3"><button aria-label={`Editar frota ${record.fleet}`} onClick={() => openEdit(record)} className="rounded-md p-1.5 text-[#103f85] hover:bg-[#edf2fb]"><Pencil size={16} /></button></td>}</tr>)}</tbody></table></div>}
      </section>
    </div>

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{editingId ? 'Atualizar marcos da OPR' : 'Adicionar frota à OPR'}</DialogTitle><DialogDescription>{editingSourceLinked ? 'Projeto, frota e datas são atualizados pelo cronograma. Preencha apenas os marcos de mobilização abaixo.' : 'A frota será criada no pilar Equipamentos do cronograma padrão e ficará vinculada a esta OPR.'}</DialogDescription></DialogHeader><div className="grid gap-4 py-2 md:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Projeto<select value={form.projectCode} disabled={editingSourceLinked} onChange={(event) => setForm((current) => ({ ...current, projectCode: event.target.value, client: current.client || projects.find((project) => project.code === event.target.value)?.name || '' }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal disabled:bg-slate-50"><option value="">Selecione</option>{projects.map((project) => <option key={project.code} value={project.code}>{project.name} · {project.code}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Cliente<Input disabled={editingSourceLinked} value={form.client} onChange={(event) => setForm((current) => ({ ...current, client: event.target.value }))} /></label><label className="grid gap-1 text-sm font-semibold">Frota<Input disabled={editingSourceLinked} value={form.fleet} onChange={(event) => setForm((current) => ({ ...current, fleet: event.target.value }))} placeholder="Ex.: 470" /></label><label className="grid gap-1 text-sm font-semibold">Descrição<Input disabled={editingSourceLinked} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Ex.: Guindaste de 25T" /></label><label className="grid gap-1 text-sm font-semibold">MOB planejado<Input disabled={editingSourceLinked} type="date" value={form.plannedDate} onChange={(event) => setForm((current) => ({ ...current, plannedDate: event.target.value }))} /></label><label className="grid gap-1 text-sm font-semibold">Data de chegada matriz<Input disabled={editingSourceLinked} type="date" value={form.matrixArrivalDate} onChange={(event) => setForm((current) => ({ ...current, matrixArrivalDate: event.target.value }))} /></label></div><div className="grid gap-5 md:grid-cols-2">{milestones.map((group) => <fieldset key={group.group} className="rounded-lg border border-slate-200 p-3"><legend className="px-1 text-sm font-bold text-[#103f85]">{group.group}</legend><div className="grid gap-3">{group.items.map(([key, label]) => <label key={String(key)} className="grid grid-cols-[minmax(0,1fr)_150px] items-center gap-3 text-sm font-medium text-slate-700"><span>{label}</span><Input value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} placeholder="OK ou data" /></label>)}</div></fieldset>)}</div>{error && <p className="text-sm text-red-600">{error}</p>}<DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>{editingId && !editingSourceLinked && <Button variant="destructive" onClick={() => void remove()} disabled={saving}>Excluir</Button>}<Button onClick={() => void save()} disabled={saving || !form.projectCode || !form.fleet}>{saving ? 'Salvando...' : editingId ? 'Salvar OPR' : 'Adicionar e vincular'}</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}
