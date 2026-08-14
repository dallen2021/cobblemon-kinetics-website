import type { ReactNode } from "react";
import { enforcePageAccess } from "@/lib/auth";

export default async function WikiLayout({ children }: { children: ReactNode }) {
  await enforcePageAccess("wiki", "/wiki");
  return <>{children}</>;
}
