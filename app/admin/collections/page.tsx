"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { OryCMSCollectionsAdminPage } from "@/components/collections/OryCMSCollectionsAdminPage";

export default function AdminCollectionsPage() {
  return (
    <AppShell section="Collections">
      <OryCMSCollectionsAdminPage />
    </AppShell>
  );
}
