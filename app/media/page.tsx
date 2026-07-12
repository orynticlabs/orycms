"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { OryCMSMediaLibrary } from "@/components/media/OryCMSMediaLibrary";

export default function MediaPage() {
  return (
    <AppShell section="Media">
      <OryCMSMediaLibrary />
    </AppShell>
  );
}
