import { getDb } from '@/db';

const allowedDays = ['seg', 'ter', 'qua', 'qui', 'sex', 'd7'];
const allowedSectors = ['Manutenção', 'Operação / MKT', 'Suprimentos', 'Financeiro', 'DP / Gente & Gestão', 'CDI', 'Engenharia', 'SMS'];
const allowedProjects = ['AMP', '5S8', 'ALPPEX', 'RINVEST', 'ECOPÓS', 'Geral'];
const allowedStatuses = ['No prazo', 'Atenção', 'Crítico', 'Concluído'];
type ActionPayload = { id?: string; title?: string; observation?: string; owner?: string; date?: string; day?: string; sector?: string; project?: string; status?: string };

function clean(payload: ActionPayload) {
  const action = { id: payload.id?.trim() ?? crypto.randomUUID(), title: payload.title?.trim() ?? '', observation: payload.observation?.trim() ?? '', owner: payload.owner?.trim() ?? '', date: payload.date?.trim() ?? '', day: payload.day?.trim() ?? '', sector: payload.sector?.trim() ?? '', project: payload.project?.trim() ?? '', status: payload.status?.trim() ?? '' };
  if (!action.id || !action.title || !action.owner || !/^\d{4}-\d{2}-\d{2}$/.test(action.date) || !allowedDays.includes(action.day) || !allowedSectors.includes(action.sector) || !allowedProjects.includes(action.project) || !allowedStatuses.includes(action.status)) throw new Error('Dados da ação incompletos ou inválidos.');
  return action;
}
function rowToAction(row: Record<string, unknown>) { return { id: String(row.id), title: String(row.title), observation: String(row.observation ?? ''), owner: String(row.owner), date: String(row.action_date), day: String(row.board_day), sector: String(row.sector), project: String(row.project), status: String(row.status) }; }
function errorResponse(error: unknown) { return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível salvar a ação.' }, { status: 500 }); }

export async function GET() { try { const result = await getDb().prepare('SELECT id, title, observation, owner, action_date, board_day, sector, project, status FROM postit_actions ORDER BY sector, board_day, action_date, created_at').all(); return Response.json({ actions: result.results.map((row) => rowToAction(row as Record<string, unknown>)) }); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { const action = clean(await request.json() as ActionPayload); await getDb().prepare('INSERT INTO postit_actions (id, title, observation, owner, action_date, board_day, sector, project, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(action.id, action.title, action.observation, action.owner, action.date, action.day, action.sector, action.project, action.status).run(); return Response.json({ action }, { status: 201 }); } catch (error) { return errorResponse(error); } }
export async function PUT(request: Request) { try { const action = clean(await request.json() as ActionPayload); const result = await getDb().prepare('UPDATE postit_actions SET title = ?, observation = ?, owner = ?, action_date = ?, board_day = ?, sector = ?, project = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(action.title, action.observation, action.owner, action.date, action.day, action.sector, action.project, action.status, action.id).run(); if (!result.meta.changes) return Response.json({ error: 'Ação não encontrada.' }, { status: 404 }); return Response.json({ action }); } catch (error) { return errorResponse(error); } }
export async function DELETE(request: Request) { try { const { id } = await request.json() as { id?: string }; if (!id) return Response.json({ error: 'Ação não informada.' }, { status: 400 }); await getDb().prepare('DELETE FROM postit_actions WHERE id = ?').bind(id).run(); return Response.json({ ok: true }); } catch (error) { return errorResponse(error); } }
