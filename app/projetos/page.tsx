import { ProjectOverviewClient } from '@/app/project-overview-client';
import { PmoToolHeader } from '@/components/pmo-tool-header';

export const dynamic = 'force-static';

export default function ProjectsPage() {
  return (
    <main className="min-h-screen bg-[#f4f6f7] text-slate-900">
      <PmoToolHeader
        title="Projetos"
        subtitle="Pastas, status, cronogramas e ações"
        backHref="/"
      />
      <div className="mx-auto max-w-[1680px] px-5 py-7 sm:px-8">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#ed1c24]">Cockpit PMO</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Projetos</h1>
          <p className="mt-2 text-sm text-slate-600">Acesse a pasta de cada projeto, seu status, cronograma e ações.</p>
        </div>
        <ProjectOverviewClient />
      </div>
    </main>
  );
}
