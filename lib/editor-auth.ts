const cookieName = 'pmo_editor_session';
const sessionLifetimeMs = 7_200_000;
const sessionVersion = 'v2';

function secret() {
  const value = process.env.EDITOR_PASSWORD;
  if (!value) throw new Error('A senha de edição não está configurada.');
  return value;
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (value) => value.toString(16).padStart(2, '0')).join('');
}

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function safeEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(left)),
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

function readCookie(request: Request, name: string) {
  return request.headers.get('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';
}

export async function isEditor(request: Request) {
  const [version, expiresAtText, nonce, signature] = readCookie(request, cookieName).split('.');
  const expiresAt = Number(expiresAtText);
  if (version !== sessionVersion || !nonce || !signature || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  return safeEqual(signature, await sign(`pmo-editor-session:${version}:${expiresAt}:${nonce}`));
}

export async function requireEditor(request: Request) {
  if (!await isEditor(request)) return Response.json({ error: 'Acesso de edição não autorizado.' }, { status: 401 });
  return null;
}

export async function createEditorSession(password: string) {
  if (!await safeEqual(password, secret())) return null;
  const expiresAt = Date.now() + sessionLifetimeMs;
  const nonce = randomNonce();
  const signature = await sign(`pmo-editor-session:${sessionVersion}:${expiresAt}:${nonce}`);
  return {
    cookie: `${cookieName}=${sessionVersion}.${expiresAt}.${nonce}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${sessionLifetimeMs / 1000}`,
  };
}

export const editorCookieName = cookieName;
