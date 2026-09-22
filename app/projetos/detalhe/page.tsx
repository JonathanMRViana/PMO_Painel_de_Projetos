import { PmoToolHeader } from '@/components/pmo-tool-header';
import { ProjectFolderClient } from './project-folder-client';

export const dynamic = 'force-static';

export default function ProjectFolderPage() {
  return <main className="min-h-screen bg-[#f4f6f7] text-slate-900">
    <PmoToolHeader title="Pasta do projeto" subtitle="Premissas e informações do projeto" backHref="/projetos" />
    <ProjectFolderClient />
  </main>;
}
