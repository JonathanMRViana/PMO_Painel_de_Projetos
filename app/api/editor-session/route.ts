import {
  createEditorSession,
  isEditor,
  editorCookieName,
} from '@/lib/editor-auth';

const attempts = new Map<string, { count: number; firstAttemptAt: number }>();
const attemptWindowMs = 15 * 60 * 1000;
const maxAttempts = 5;

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

function clientAddress(request: Request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '';
}

function isBlocked(address: string) {
  if (!address) return false;
  const attempt = attempts.get(address);
  if (!attempt) return false;
  if (Date.now() - attempt.firstAttemptAt >= attemptWindowMs) {
    attempts.delete(address);
    return false;
  }
  return attempt.count >= maxAttempts;
}

function registerFailedAttempt(address: string) {
  if (!address) return;
  const current = attempts.get(address);
  if (!current || Date.now() - current.firstAttemptAt >= attemptWindowMs) {
    attempts.set(address, { count: 1, firstAttemptAt: Date.now() });
    return;
  }
  attempts.set(address, { ...current, count: current.count + 1 });
}

export async function GET(request: Request) {
  try {
    return Response.json({ authenticated: await isEditor(request) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ authenticated: false }, { headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request))
      return Response.json({ error: 'A edição está disponível somente pelo painel oficial.' }, { status: 403 });
    const address = clientAddress(request);
    if (isBlocked(address))
      return Response.json({ error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.' }, { status: 429 });
    const body = (await request.json()) as { password?: string };
    const cookie = await createEditorSession(body.password ?? '');
    if (!cookie) {
      registerFailedAttempt(address);
      return Response.json({ error: 'Senha inválida.' }, { status: 401 });
    }
    if (address) attempts.delete(address);
    return Response.json(
      { authenticated: true },
      { headers: { 'Set-Cookie': cookie.cookie, 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { error: 'A senha de edição ainda não está configurada.' },
      { status: 503 },
    );
  }
}

export function DELETE() {
  return Response.json(
    { authenticated: false },
    {
      headers: {
        'Set-Cookie': `${editorCookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
      },
    },
  );
}
