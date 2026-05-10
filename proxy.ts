import { NextResponse, type NextRequest } from 'next/server';

const APP_HOST = 'app.hudsonkit.com';

function hostnameFromRequest(request: NextRequest): string {
  return (request.headers.get('host') ?? '').split(':')[0]?.toLowerCase() ?? '';
}

export function proxy(request: NextRequest) {
  if (hostnameFromRequest(request) !== APP_HOST) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/app';
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: '/',
};
