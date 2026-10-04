"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function CategoriesPage() {
  return (
    <AppShell section="Categories">
      <PlaceholderPage
        eyebrow="Commerce"
        title="Categories"
        description="Organize your catalog with a flexible category hierarchy for storefront navigation and filtering."
      />
    </AppShell>
  );
}
