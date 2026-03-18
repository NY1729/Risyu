// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // /update ページへのアクセスのみ制限
  if (request.nextUrl.pathname.startsWith('/update')) {
    const auth = request.headers.get('authorization');

    if (!auth) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Secure Area"',
        },
      });
    }

    const authValue = auth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    // 環境変数などで管理するのが安全です
    if (user === 'admin' && pwd === process.env.UPDATE_PASSWORD) {
      return NextResponse.next();
    }

    return new NextResponse('Invalid credentials', { status: 401 });
  }
}