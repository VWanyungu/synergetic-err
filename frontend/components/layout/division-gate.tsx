"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "@/hooks/queries/use-me";
import { isDivisionLead } from "@/lib/roles";

/** A Division Lead can open their division's register, the risks in it, their profile and notifications; anything else goes back to their register. */
export function DivisionGate({ children }: { children: React.ReactNode }) {
  const me = useMe().data;
  const pathname = usePathname();
  const router = useRouter();
  const lead = !!me && isDivisionLead(me.roles.map((r) => r.role));
  const home = me?.divisionId ? `/risks/division/${me.divisionId}` : "/profile";
  const allowed = pathname === home || /^\/risks\/[0-9a-f-]{36}$/i.test(pathname) || pathname.startsWith("/profile") || pathname.startsWith("/notifications");

  useEffect(() => {
    if (lead && !allowed) router.replace(home);
  }, [lead, allowed, home, router]);

  return lead && !allowed ? null : <>{children}</>;
}
