import { readProjectOverview } from '@/lib/project-hub';

export async function GET() {
  try {
    return Response.json({ projects: await readProjectOverview() });
  } catch {
    return Response.json({ error: 'Não foi possível carregar a visão geral.' }, { status: 500 });
  }
}
