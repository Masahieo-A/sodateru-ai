import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/auth" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }
  if (request.cookies.get("sodateru_session")?.value) return NextResponse.next();
  const login = new URL("/auth", request.url);
  login.searchParams.set("redirect", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
