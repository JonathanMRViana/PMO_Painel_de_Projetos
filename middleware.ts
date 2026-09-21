import { NextResponse } from 'next/server';

const githubPagesOrigin = 'https://jonathanmrviana.github.io';

export function middleware(request: Request) {
  const origin = request.headers.get('origin');
  if (origin !== githubPagesOrigin) return NextResponse.next();

  const headers = {
    'Access-Control-Allow-Origin': githubPagesOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    Vary: 'Origin',
  };

  if (request.method === 'OPTIONS') return new NextResponse(null, { status: 204, headers });
  const response = NextResponse.next();
  Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
  return response;
}

export const config = { matcher: '/api/:path*' };
