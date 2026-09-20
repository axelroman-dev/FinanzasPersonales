import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const path = nextUrl.pathname;

  const isPublicPath = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );
  const isApiAuthPath = path.startsWith("/api/auth");
  const isApiRegisterPath = path === "/api/register";
  const isStaticAsset =
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path === "/robots.txt";

  if (isApiAuthPath || isApiRegisterPath || isStaticAsset) {
    return NextResponse.next();
  }

  if (!isLoggedIn && !isPublicPath) {
    const url = nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isPublicPath) {
    const url = nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};