'use client';
import '@/lib/github-pages-api';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, Folder, FolderKanban, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type Project = {
  code: string;
  name: string;
  color: string;
  status: string;
  scheduleId: string | null;
  startDate: string;
  actionCount: number;
  openActionCount: number;
};

export function ProjectOverviewClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [editor, setEditor] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#d8e5e5');
  const [status, setStatus] = useState('Planejamento');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const [overview, session] = await Promise.all([
      fetch('/api/project-overview', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/editor-session', { cache: 'no-store' }).then((r) => r.json()),
    ]);
    setProjects(overview.projects || []);
    setEditor(Boolean(session.authenticated));
  }
  useEffect(() => { void load(); }, []);

  async function createProject() {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/postit-catalog', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'project', name, color, status }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível criar o projeto.');
      setOpen(false); setName(''); setColor('#d8e5e5'); setStatus('Planejamento'); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível criar o projeto.'); }
    finally { setSaving(false); }
  }

  async function changeStatus(project: Project, nextStatus: string) {
    setError('');
    try {
      const response = await fetch('/api/postit-catalog', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'project', oldName: project.name, name: project.name, color: project.color, status: nextStatus }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar o status.');
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o status.'); }
  }

  const visibleProjects = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return projects;
    return projects.filter((project) => `${project.name} ${project.code} ${project.status}`.toLocaleLowerCase('pt-BR').includes(term));
  }, [projects, search]);

  return (
    <section className="mt-9">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        {editor && <Button onClick={() => setOpen(true)}><Plus /> Novo projeto</Button>}
      </div>
      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center"><FolderKanban className="mx-auto text-[#103f85]" size={30} /><p className="mt-3 font-semibold">Nenhum projeto cadastrado.</p><p className="mt-1 text-sm text-slate-600">Crie o primeiro projeto para organizar cronograma e ações.</p></div>
      ) : <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5"><p className="text-sm font-semibold text-slate-600">{visibleProjects.length} {visibleProjects.length === 1 ? 'projeto' : 'projetos'}</p><label className="relative block w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Pesquisar projeto, código ou status" /></label></div>
        <div className="divide-y divide-slate-200">
        {visibleProjects.map((project) => <article key={project.code} className="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-slate-50 sm:px-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3"><span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#edf2fb] text-[#103f85]"><Folder size={21} fill={project.color} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-base font-bold text-slate-800">{project.name}</h3><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} /></div><p className="mt-1 text-xs font-semibold text-slate-500">{project.code} · {project.scheduleId ? 'Cronograma criado' : 'Cronograma pendente'}</p></div></div>
          <div className="flex shrink-0 gap-4 text-sm"><span><b className="text-slate-800">{project.openActionCount}</b> abertas</span><span><b className="text-slate-800">{project.actionCount}</b> ações</span></div>
          <div className="flex min-w-[170px] shrink-0 items-center gap-2">{editor ? <select value={project.status} onChange={(event) => void changeStatus(project, event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"><option>Planejamento</option><option>Em mobilização</option><option>Em andamento</option><option>Concluído</option><option>Bloqueado</option></select> : <span className="rounded-full bg-[#edf2fb] px-3 py-1.5 text-xs font-bold text-[#103f85]">{project.status}</span>}</div>
          <div className="grid shrink-0 grid-cols-2 gap-2 lg:w-[272px]">
            {editor ? (
              <a href={project.scheduleId ? `/acompanhamento?projeto=${encodeURIComponent(project.scheduleId)}` : `/acompanhamento?novo=${encodeURIComponent(project.name)}`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2 text-center text-xs font-semibold leading-4 text-[#103f85] transition-colors hover:bg-slate-50"><CalendarDays className="shrink-0" size={15} /><span>{project.scheduleId ? 'Editar cronograma' : 'Criar cronograma'}</span></a>
            ) : project.scheduleId ? (
              <a href={`/acompanhamento?projeto=${encodeURIComponent(project.scheduleId)}`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2 text-center text-xs font-semibold leading-4 text-[#103f85] transition-colors hover:bg-slate-50"><CalendarDays className="shrink-0" size={15} /><span>Visualizar cronograma</span></a>
            ) : (
              <span className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-200 px-2 py-2 text-center text-xs font-semibold leading-4 text-slate-400"><CalendarDays className="shrink-0" size={15} /><span>Cronograma pendente</span></span>
            )}
            <a href={`${editor ? '/postits' : '/postits/visualizar'}?projeto=${encodeURIComponent(project.name)}`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#103f85] px-2 py-2 text-center text-xs font-semibold leading-4 text-white transition-colors hover:bg-[#0c326d]"><ClipboardList className="shrink-0" size={15} /><span>{editor ? 'Gerenciar ações' : 'Visualizar ações'}</span></a>
          </div>
        </article>)}
        {visibleProjects.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">Nenhum projeto encontrado.</p>}</div>
      </div>}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Novo projeto</DialogTitle><DialogDescription>A pasta ficará disponível na visão geral, no cronograma e no quadro de ações.</DialogDescription></DialogHeader><label className="grid gap-2 text-sm font-semibold">Nome do projeto<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: VALE S11D" autoFocus /></label><label className="grid gap-2 text-sm font-semibold">Status inicial<select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal"><option>Planejamento</option><option>Em mobilização</option><option>Em andamento</option><option>Concluído</option><option>Bloqueado</option></select></label><label className="grid gap-2 text-sm font-semibold">Cor do projeto<input className="h-10 w-full rounded-lg border border-slate-200 bg-white p-1" type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>{error && <p className="text-sm text-red-600">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={saving || name.trim().length < 2} onClick={() => void createProject()}>{saving ? 'Criando...' : 'Criar projeto'}</Button></DialogFooter></DialogContent></Dialog>
    </section>
  );
}
