'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, ClipboardList, FolderKanban, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type Project = {
  name: string;
  color: string;
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
        body: JSON.stringify({ type: 'project', name, color }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível criar o projeto.');
      setOpen(false); setName(''); setColor('#d8e5e5'); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível criar o projeto.'); }
    finally { setSaving(false); }
  }

  return (
    <section className="mt-9">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold text-slate-800">Projetos</h2><p className="mt-1 text-sm text-slate-600">Cada pasta reúne o cronograma e as ações do projeto.</p></div>
        {editor && <Button onClick={() => setOpen(true)}><Plus /> Novo projeto</Button>}
      </div>
      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center"><FolderKanban className="mx-auto text-[#103f85]" size={30} /><p className="mt-3 font-semibold">Nenhum projeto cadastrado.</p><p className="mt-1 text-sm text-slate-600">Crie o primeiro projeto para organizar cronograma e ações.</p></div>
      ) : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => <article key={project.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3"><span className="mt-1 h-4 w-4 shrink-0 rounded" style={{ backgroundColor: project.color }} /><div className="min-w-0"><h3 className="truncate text-base font-bold text-slate-800">{project.name}</h3><p className="mt-1 text-xs text-slate-500">{project.scheduleId ? 'Cronograma criado' : 'Cronograma pendente'}</p></div></div>
          <div className="mt-5 flex gap-5 text-sm"><span><b className="text-slate-800">{project.openActionCount}</b> abertas</span><span><b className="text-slate-800">{project.actionCount}</b> ações</span></div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <a href={project.scheduleId ? `/acompanhamento?projeto=${encodeURIComponent(project.scheduleId)}` : `/acompanhamento?novo=${encodeURIComponent(project.name)}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-[#103f85] hover:bg-slate-50"><CalendarDays size={16} /> {project.scheduleId ? 'Cronograma' : 'Criar cronograma'}</a>
            <a href={`/postits?projeto=${encodeURIComponent(project.name)}`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#103f85] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0c326d]"><ClipboardList size={16} /> Ações</a>
          </div>
        </article>)}
      </div>}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Novo projeto</DialogTitle><DialogDescription>A pasta ficará disponível na visão geral e no quadro de ações.</DialogDescription></DialogHeader><label className="grid gap-2 text-sm font-semibold">Nome do projeto<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: VALE S11D" autoFocus /></label><label className="grid gap-2 text-sm font-semibold">Cor do projeto<input className="h-10 w-full rounded-lg border border-slate-200 bg-white p-1" type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>{error && <p className="text-sm text-red-600">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={saving || name.trim().length < 2} onClick={() => void createProject()}>{saving ? 'Criando...' : 'Criar projeto'}</Button></DialogFooter></DialogContent></Dialog>
    </section>
  );
}
