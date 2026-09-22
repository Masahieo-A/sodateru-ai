import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/auth" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }
  const hasSessionCookie = Boolean(request.cookies.get("sodateru_session")?.value);
  if (hasSessionCookie) return NextResponse.next();

  // API callers expect a JSON response. Redirecting an unauthenticated API
  // request to the HTML login page makes fetch(...).json() fail with the
  // misleading `Unexpected token '<'` error.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const login = new URL("/auth", request.url);
  login.searchParams.set("redirect", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
