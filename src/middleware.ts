import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register"];
const CHANGE_PASSWORD_PATH = "/change-password";

// APIs que el usuario puede llamar incluso si debe cambiar contraseña
// (porque son justamente para eso: cambiar contraseña, actualizar perfil)
const ALLOWED_DURING_PASSWORD_CHANGE = [
  "/api/profile/password",
  "/api/profile",
];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const path = nextUrl.pathname;

  const isPublicPath = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );
  const isChangePasswordPath =
    path === CHANGE_PASSWORD_PATH ||
    path.startsWith(`${CHANGE_PASSWORD_PATH}/`);
  const isApiAuthPath = path.startsWith("/api/auth");
  const isApiRegisterPath = path === "/api/register";
  const isAllowedDuringChange = ALLOWED_DURING_PASSWORD_CHANGE.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );
  const isStaticAsset =
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path === "/robots.txt";

  if (
    isApiAuthPath ||
    isApiRegisterPath ||
    isAllowedDuringChange ||
    isStaticAsset
  ) {
    return NextResponse.next();
  }

  // 1. No logueado: solo login/register
  if (!isLoggedIn && !isPublicPath) {
    const url = nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  // 2. Logueado en login/register: redirigir al home (o a change-password si aplica)
  if (isLoggedIn && isPublicPath) {
    const mustChange = (req.auth?.user as any)?.mustChangePassword ?? false;
    const url = nextUrl.clone();
    url.pathname = mustChange ? CHANGE_PASSWORD_PATH : "/";
    return NextResponse.redirect(url);
  }

  // 3. Logueado con mustChangePassword: forzar /change-password
  const mustChange = (req.auth?.user as any)?.mustChangePassword ?? false;
  if (isLoggedIn && mustChange && !isChangePasswordPath) {
    const url = nextUrl.clone();
    url.pathname = CHANGE_PASSWORD_PATH;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};