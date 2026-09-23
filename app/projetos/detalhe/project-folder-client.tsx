'use client';
import '@/lib/github-pages-api';
import { redirectToOfficialEditor } from '@/lib/github-pages-api';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, ClipboardList, Plus, Save, Trash2, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { emptyProjectScope, normalizeProjectScope, scopeColumns, type ProjectScope, type ScopeRow, type ScopeSection } from '@/lib/project-scope';

type Project = { code: string; name: string; color: string; status: string; contractStartDate: string };
type Fleet = { id: string; sourceTaskId: string | null; fleet: string; description: string; plannedDate: string; matrixArrivalDate: string };
const sections: { id: ScopeSection | 'fleet'; label: string }[] = [
  { id: 'contract', label: 'Contrato' }, { id: 'fleet', label: 'Frota' },
  { id: 'workforce', label: 'Mão de Obra' }, { id: 'legal', label: 'Inf. Legais' }, { id: 'cfi', label: 'CFI' },
];

export function ProjectFolderClient() {
  const code = useSearchParams().get('codigo')?.trim() || '';
  const [project, setProject] = useState<Project | null>(null);
  const [scope, setScope] = useState<ProjectScope>(emptyProjectScope());
  const [contractStartDate, setContractStartDate] = useState('');
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [editor, setEditor] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [newFleet, setNewFleet] = useState({ fleet: '', description: '', plannedDate: '' });
  const [editingFleet, setEditingFleet] = useState<Fleet | null>(null);

  async function load() {
    if (!code) { setError('Projeto não informado.'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [scopeResponse, sessionResponse, fleetResponse] = await Promise.all([
        fetch(`/api/project-scope?codigo=${encodeURIComponent(code)}`, { cache: 'no-store' }),
        fetch('/api/editor-session', { cache: 'no-store' }),
        fetch(`/api/executive-opr?projeto=${encodeURIComponent(code)}`, { cache: 'no-store' }),
      ]);
      const [scopeData, sessionData, fleetData] = await Promise.all([scopeResponse.json(), sessionResponse.json(), fleetResponse.json()]) as [
        { project?: Project; scope?: ProjectScope; error?: string }, { authenticated?: boolean }, { records?: Fleet[]; error?: string },
      ];
      if (!scopeResponse.ok) throw new Error(scopeData.error || 'Não foi possível abrir a pasta.');
      if (!fleetResponse.ok) throw new Error(fleetData.error || 'Não foi possível carregar a frota.');
      setProject(scopeData.project || null);
      setScope(normalizeProjectScope(scopeData.scope));
      setContractStartDate(scopeData.project?.contractStartDate || '');
      setFleets(fleetData.records || []);
      setEditor(Boolean(sessionData.authenticated));
      setDirty(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível abrir a pasta.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [code]);

  function updateRow(section: ScopeSection, id: string, key: string, value: string) {
    setScope((current) => ({ ...current, [section]: current[section].map((row) => row.id === id ? { ...row, [key]: value } : row) }));
    setDirty(true); setMessage('');
  }
  function addRow(section: ScopeSection) {
    const row: ScopeRow = { id: crypto.randomUUID() };
    scopeColumns[section].forEach(({ key }) => { row[key] = ''; });
    setScope((current) => ({ ...current, [section]: [...current[section], row] }));
    setDirty(true); setMessage('');
  }
  function removeRow(section: ScopeSection, id: string) {
    setScope((current) => ({ ...current, [section]: current[section].filter((row) => row.id !== id) }));
    setDirty(true); setMessage('');
  }

  async function save() {
    if (!editor || !project) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/project-scope', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: project.code, scope, contractStartDate }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar as premissas.');
      setDirty(false); setMessage('Premissas salvas.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar as premissas.'); }
    finally { setSaving(false); }
  }

  async function authenticate() {
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/editor-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await response.json() as { authenticated?: boolean; error?: string };
      if (!response.ok || !data.authenticated) throw new Error(data.error || 'Não foi possível acessar a edição.');
      setPassword(''); setAuthOpen(false); setEditor(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível acessar a edição.'); }
    finally { setSaving(false); }
  }

  async function addFleet() {
    if (!editor || !project || !newFleet.fleet.trim()) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/executive-opr', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectCode: project.code, client: project.name, ...newFleet }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível adicionar a frota.');
      const fleetResponse = await fetch(`/api/executive-opr?projeto=${encodeURIComponent(project.code)}`, { cache: 'no-store' });
      const fleetData = await fleetResponse.json() as { records?: Fleet[]; error?: string };
      if (!fleetResponse.ok) throw new Error(fleetData.error || 'Frota criada, mas não foi possível atualizar a lista.');
      setFleets(fleetData.records || []);
      setNewFleet({ fleet: '', description: '', plannedDate: '' });
      setMessage('Frota adicionada ao cronograma e à OPR.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível adicionar a frota.'); }
    finally { setSaving(false); }
  }

  async function saveFleet() {
    if (!editor || !project || !editingFleet?.sourceTaskId) return;
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/project-scope/equipment', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: project.code, taskId: editingFleet.sourceTaskId, fleet: editingFleet.fleet, description: editingFleet.description, plannedDate: editingFleet.plannedDate }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível editar a frota.');
      const fleetResponse = await fetch(`/api/executive-opr?projeto=${encodeURIComponent(project.code)}`, { cache: 'no-store' });
      const fleetData = await fleetResponse.json() as { records?: Fleet[] };
      if (fleetResponse.ok) setFleets(fleetData.records || []);
      setEditingFleet(null); setMessage('Frota atualizada no cronograma e na OPR.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível editar a frota.'); }
    finally { setSaving(false); }
  }

  async function removeFleet(fleet: Fleet) {
    if (!editor || !project || !fleet.sourceTaskId || !window.confirm(`Excluir a frota “${fleet.fleet}” do projeto, cronograma e OPR?`)) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/project-scope/equipment', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: project.code, taskId: fleet.sourceTaskId }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível excluir a frota.');
      setFleets((current) => current.filter((item) => item.id !== fleet.id));
      setMessage('Frota excluída do projeto, cronograma e OPR.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível excluir a frota.'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="px-5 py-12 text-sm text-slate-500">Abrindo pasta do projeto...</div>;
  if (!project) return <div className="px-5 py-12 text-sm text-red-700">{error || 'Projeto não encontrado.'}</div>;

  return <div className="mx-auto w-full max-w-none px-3 py-6 sm:px-5">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3"><span className="h-9 w-2 rounded" style={{ background: project.color }} /><div><h1 className="text-2xl font-bold">{project.name}</h1><p className="text-sm text-slate-500">{project.code} · {project.status}</p></div></div>
      <div className="flex flex-wrap gap-2">
        <a className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[#103f85]" href={`/acompanhamento?projeto=${encodeURIComponent(project.name)}`}><CalendarDays size={16} /> Cronograma</a>
        <a className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[#103f85]" href={`/postits/visualizar?projeto=${encodeURIComponent(project.name)}`}><ClipboardList size={16} /> Ações</a>
        {editor && <Button onClick={() => void save()} disabled={!dirty || saving}><Save size={16} /> {saving ? 'Salvando...' : 'Salvar premissas'}</Button>}
        {!editor && <Button variant="outline" onClick={() => { if (!redirectToOfficialEditor(`/projetos/detalhe?codigo=${encodeURIComponent(project.code)}`)) setAuthOpen(true); }}>Acessar edição</Button>}
      </div>
    </div>
    {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
    {!editor && <p className="mb-4 text-sm text-slate-500">Visualização das premissas do projeto.</p>}
    <Tabs defaultValue="contract" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <TabsList variant="line" className="mb-5 h-auto max-w-full flex-wrap justify-start gap-3 border-b border-slate-200 pb-2">
        {sections.map((section) => <TabsTrigger key={section.id} value={section.id} className="px-3 py-2">{section.label}</TabsTrigger>)}
      </TabsList>
      <TabsContent value="contract" className="space-y-4">
        <label className="grid max-w-xs gap-1 text-sm font-semibold text-slate-700">Início do contrato
          <Input type="date" value={contractStartDate} disabled={!editor} onChange={(event) => { setContractStartDate(event.target.value); setDirty(true); setMessage(''); }} />
        </label>
        <ScopeGrid section="contract" rows={scope.contract} editor={editor} onChange={updateRow} onAdd={addRow} onRemove={removeRow} />
      </TabsContent>
      <TabsContent value="fleet" className="space-y-4">
        <p className="text-sm text-slate-600">A frota desta pasta é a mesma do cronograma e da OPR.</p>
        {fleets.length ? <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Frota</th><th className="p-3">Descrição</th><th className="p-3">Mobilização prevista</th><th className="p-3">Chegada matriz</th><th className="p-3">Detalhes</th></tr></thead><tbody>{fleets.map((fleet) => <tr key={fleet.id} className="border-t border-slate-200"><td className="p-3 font-semibold">{fleet.fleet}</td><td className="p-3">{fleet.description || '—'}</td><td className="p-3">{fleet.plannedDate || '—'}</td><td className="p-3">{fleet.matrixArrivalDate || '—'}</td><td className="p-3">{editor && fleet.sourceTaskId && <button className="mr-3 font-semibold text-[#103f85] hover:underline" onClick={() => setEditingFleet({ ...fleet })}>Editar</button>}{editor && fleet.sourceTaskId && <button className="mr-3 font-semibold text-red-700 hover:underline" disabled={saving} onClick={() => void removeFleet(fleet)}>Excluir</button>}<a className="font-semibold text-[#103f85] hover:underline" href={`/acompanhamento?projeto=${encodeURIComponent(project.name)}`}>Cronograma</a> · <a className="font-semibold text-[#103f85] hover:underline" href={`/visao-executiva?projeto=${encodeURIComponent(project.code)}`}>OPR</a></td></tr>)}</tbody></table></div> : <p className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500">Nenhuma frota cadastrada.</p>}
        {editor && <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1.4fr_180px_auto]"><label className="grid gap-1 text-sm font-semibold">Frota<Input value={newFleet.fleet} onChange={(event) => setNewFleet((current) => ({ ...current, fleet: event.target.value }))} placeholder="Ex.: Empilhadeira" /></label><label className="grid gap-1 text-sm font-semibold">Descrição<Input value={newFleet.description} onChange={(event) => setNewFleet((current) => ({ ...current, description: event.target.value }))} /></label><label className="grid gap-1 text-sm font-semibold">MOB planejado<Input type="date" value={newFleet.plannedDate} onChange={(event) => setNewFleet((current) => ({ ...current, plannedDate: event.target.value }))} /></label><Button className="self-end" disabled={saving || !newFleet.fleet.trim()} onClick={() => void addFleet()}><Truck size={16} /> Adicionar</Button></div>}
      </TabsContent>
      {(['workforce', 'legal', 'cfi'] as ScopeSection[]).map((section) => <TabsContent key={section} value={section}><ScopeGrid section={section} rows={scope[section]} editor={editor} onChange={updateRow} onAdd={addRow} onRemove={removeRow} /></TabsContent>)}
    </Tabs>
    <Dialog open={editingFleet !== null} onOpenChange={(open) => { if (!open) setEditingFleet(null); }}><DialogContent><DialogHeader><DialogTitle>Editar frota</DialogTitle><DialogDescription>A alteração será refletida no cronograma e na OPR.</DialogDescription></DialogHeader><div className="grid gap-3"><label className="grid gap-1 text-sm font-semibold">Frota<Input value={editingFleet?.fleet || ''} onChange={(event) => setEditingFleet((current) => current ? { ...current, fleet: event.target.value } : null)} /></label><label className="grid gap-1 text-sm font-semibold">Descrição<Input value={editingFleet?.description || ''} onChange={(event) => setEditingFleet((current) => current ? { ...current, description: event.target.value } : null)} /></label><label className="grid gap-1 text-sm font-semibold">Mobilização prevista<Input type="date" value={editingFleet?.plannedDate || ''} onChange={(event) => setEditingFleet((current) => current ? { ...current, plannedDate: event.target.value } : null)} /></label></div><DialogFooter><Button variant="outline" onClick={() => setEditingFleet(null)}>Cancelar</Button><Button disabled={saving || !editingFleet?.fleet.trim()} onClick={() => void saveFleet()}>{saving ? 'Salvando...' : 'Salvar frota'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={authOpen} onOpenChange={setAuthOpen}><DialogContent><DialogHeader><DialogTitle>Acessar edição</DialogTitle><DialogDescription>Informe a senha do PMO para editar as premissas.</DialogDescription></DialogHeader><label className="grid gap-1 text-sm font-semibold">Senha<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void authenticate(); }} /></label><DialogFooter><Button variant="outline" onClick={() => setAuthOpen(false)}>Cancelar</Button><Button disabled={saving || !password} onClick={() => void authenticate()}>Entrar</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function ScopeGrid({ section, rows, editor, onChange, onAdd, onRemove }: {
  section: ScopeSection; rows: ScopeRow[]; editor: boolean;
  onChange: (section: ScopeSection, id: string, key: string, value: string) => void;
  onAdd: (section: ScopeSection) => void; onRemove: (section: ScopeSection, id: string) => void;
}) {
  return <div className="space-y-3">
    {rows.length ? <div className="grid gap-3">{rows.map((row) => <div key={row.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[repeat(auto-fit,minmax(145px,1fr))_auto]">
      {scopeColumns[section].map(({ key, label }) => <label key={key} className="grid min-w-0 gap-1 text-xs font-semibold text-slate-600">{label}<Input value={row[key] || ''} disabled={!editor} onChange={(event) => onChange(section, row.id, key, event.target.value)} className="text-sm font-normal" /></label>)}
      {editor && <button type="button" className="self-end rounded-lg p-2 text-red-600 hover:bg-red-50" title="Remover linha" aria-label="Remover linha" onClick={() => onRemove(section, row.id)}><Trash2 size={17} /></button>}
    </div>)}</div> : <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">Nenhuma informação cadastrada nesta área.</p>}
    {editor && <Button type="button" variant="outline" onClick={() => onAdd(section)}><Plus size={16} /> Adicionar linha</Button>}
  </div>;
}
