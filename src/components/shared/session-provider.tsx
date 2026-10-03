"use client";

import { SessionProvider } from "next-auth/react";
import { ConfirmProvider } from "./confirm-dialog";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </SessionProvider>
  );
}
