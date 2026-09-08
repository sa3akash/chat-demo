import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("accessToken")?.value;
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname.startsWith("/auth");
  const isChatRoute = pathname.startsWith("/chat");

  // Protect /chat routes: redirect unauthenticated users to /auth/signin
  if (!token && isChatRoute) {
    const url = new URL("/auth/signin", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages to /chat
  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  // Redirect root path / to /chat if authenticated, otherwise to /auth/signin
  if (pathname === "/") {
    if (token) {
      return NextResponse.redirect(new URL("/chat", request.url));
    } else {
      return NextResponse.redirect(new URL("/auth/signin", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/chat/:path*", "/auth/:path*"],
};
