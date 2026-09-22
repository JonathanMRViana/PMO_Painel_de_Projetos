import { getDb } from '@/db';
import { requireEditor } from '@/lib/editor-auth';
import { emptyProjectScope, normalizeProjectScope } from '@/lib/project-scope';

export async function GET(request: Request) {
  try {
    const code = new URL(request.url).searchParams.get('codigo')?.trim() || '';
    if (!code) return Response.json({ error: 'Projeto não informado.' }, { status: 400 });
    const db = getDb();
    const project = await db.prepare('SELECT code, name, color, status, contract_start_date FROM pmo_projects WHERE code = ?')
      .bind(code).first<Record<string, unknown>>();
    if (!project) return Response.json({ error: 'Projeto não encontrado.' }, { status: 404 });
    const saved = await db.prepare('SELECT data_json FROM pmo_project_scopes WHERE project_code = ?')
      .bind(code).first<{ data_json: string }>();
    return Response.json({
      project: { code: String(project.code), name: String(project.name), color: String(project.color), status: String(project.status), contractStartDate: String(project.contract_start_date || '') },
      scope: saved ? normalizeProjectScope(JSON.parse(saved.data_json)) : emptyProjectScope(),
    });
  } catch {
    return Response.json({ error: 'Não foi possível carregar a pasta do projeto.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const denied = await requireEditor(request);
    if (denied) return denied;
    const body = await request.json() as { code?: string; scope?: unknown; contractStartDate?: unknown };
    const code = String(body.code || '').trim();
    const contractStartDate = String(body.contractStartDate ?? '').trim();
    if (!code) return Response.json({ error: 'Projeto não informado.' }, { status: 400 });
    if (contractStartDate && !/^\d{4}-\d{2}-\d{2}$/.test(contractStartDate))
      return Response.json({ error: 'Data de início do contrato inválida.' }, { status: 400 });
    const scope = normalizeProjectScope(body.scope);
    const db = getDb();
    const project = await db.prepare('SELECT code FROM pmo_projects WHERE code = ?').bind(code).first();
    if (!project) return Response.json({ error: 'Projeto não encontrado.' }, { status: 404 });
    const now = new Date().toISOString();
    await db.batch([
      db.prepare('INSERT INTO pmo_project_scopes (project_code, data_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(project_code) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at').bind(code, JSON.stringify(scope), now),
      db.prepare('UPDATE pmo_projects SET contract_start_date = ?, updated_at = ? WHERE code = ?').bind(contractStartDate, now, code),
    ]);
    return Response.json({ saved: true, scope });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível salvar as premissas.' }, { status: 400 });
  }
}
