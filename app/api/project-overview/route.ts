import { readProjectOverview, updateContractStartDate } from '@/lib/project-hub';
import { requireEditor } from '@/lib/editor-auth';

export async function GET() {
  try {
    return Response.json({ projects: await readProjectOverview() });
  } catch {
    return Response.json({ error: 'Não foi possível carregar a visão geral.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const body = await request.json() as { code?: string; contractStartDate?: string };
    const code = String(body.code || '').trim();
    if (!code) return Response.json({ error: 'Projeto não informado.' }, { status: 400 });
    await updateContractStartDate(code, String(body.contractStartDate || '').trim());
    return Response.json({ updated: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar o contrato.' }, { status: 400 });
  }
}
