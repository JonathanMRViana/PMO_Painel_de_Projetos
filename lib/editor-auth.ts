const cookieName = 'pmo_editor_session';

function secret() {
  const value = process.env.EDITOR_PASSWORD;
  if (!value) throw new Error('A senha de edição não está configurada.');
  return value;
}

async function sessionToken() {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${secret()}:pmo-editor-session-v1`),
  );
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

function readCookie(request: Request, name: string) {
  return request.headers.get('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';
}

export async function isEditor(request: Request) {
  return readCookie(request, cookieName) === await sessionToken();
}

export async function requireEditor(request: Request) {
  if (!await isEditor(request)) return Response.json({ error: 'Acesso de edição não autorizado.' }, { status: 401 });
  return null;
}

export async function createEditorSession(password: string) {
  if (password !== secret()) return null;
  return `${cookieName}=${await sessionToken()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
}

export const editorCookieName = cookieName;
