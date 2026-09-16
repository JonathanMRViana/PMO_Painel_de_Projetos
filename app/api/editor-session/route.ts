import {
  createEditorSession,
  isEditor,
  editorCookieName,
} from '@/lib/editor-auth';

export async function GET(request: Request) {
  try {
    return Response.json({ authenticated: await isEditor(request) });
  } catch {
    return Response.json({ authenticated: false });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string };
    const cookie = await createEditorSession(body.password ?? '');
    if (!cookie)
      return Response.json({ error: 'Senha inválida.' }, { status: 401 });
    return Response.json(
      { authenticated: true },
      { headers: { 'Set-Cookie': cookie } },
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
