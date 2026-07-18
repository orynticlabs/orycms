"use client";

import { CheckCircle2 } from "lucide-react";
import { useOryCMSSession } from "../../hooks/use-orycms-session";

export function Dashboard() {
  const { user, roleName } = useOryCMSSession();
  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-10">
      <p className="text-sm text-muted-foreground">OryCMS dashboard</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">You’re ready to build.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        Setup is complete and your authenticated admin dashboard is working.
      </p>
      <div className="mt-8 flex items-start gap-3 rounded-xl border border-border bg-surface p-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
        <div>
          <div className="font-medium">Signed in successfully</div>
          <div className="mt-1 text-sm text-muted-foreground">{user?.email}{roleName ? ` · ${roleName}` : ""}</div>
        </div>
      </div>
    </div>
  );
}
