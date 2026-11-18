import type { DefaultSession } from "next-auth";

/**
 * Lo que la app agrega al usuario, al JWT y a la sesión de NextAuth (ver
 * los callbacks en src/auth.ts)
 */
type Role = "USER" | "ADMIN";

declare module "next-auth" {
  // Lo que devuelve `authorize` en el login con credenciales
  interface User {
    role?: Role;
    mustChangePassword?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      mustChangePassword: boolean;
      /** Cuándo se inició la sesión (ms); las de antes no lo traen */
      authAt?: number;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    mustChangePassword?: boolean;
    authAt?: number;
  }
}
