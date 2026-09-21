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

async function apiToken(expiresAt: number) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`pmo-editor-api-v1:${expiresAt}`));
  const encoded = Array.from(new Uint8Array(signature), (value) => value.toString(16).padStart(2, '0')).join('');
  return `${expiresAt}.${encoded}`;
}

function readCookie(request: Request, name: string) {
  return request.headers.get('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';
}

export async function isEditor(request: Request) {
  if (readCookie(request, cookieName) === await sessionToken()) return true;
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const [expiresAtText] = bearer.split('.');
  const expiresAt = Number(expiresAtText);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() || expiresAt > Date.now() + 28_800_000) return false;
  return bearer === await apiToken(expiresAt);
}

export async function requireEditor(request: Request) {
  if (!await isEditor(request)) return Response.json({ error: 'Acesso de edição não autorizado.' }, { status: 401 });
  return null;
}

export async function createEditorSession(password: string) {
  if (password !== secret()) return null;
  const expiresAt = Date.now() + 28_800_000;
  return {
    cookie: `${cookieName}=${await sessionToken()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`,
    token: await apiToken(expiresAt),
  };
}

export const editorCookieName = cookieName;
