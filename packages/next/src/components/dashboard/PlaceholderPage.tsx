import { Construction } from "lucide-react";
import { PageHeader } from "./PageHeader";

interface PlaceholderPageProps {
  eyebrow?: string;
  title: string;
  description?: string;
  milestone?: string;
}

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  milestone = "Phase 2",
}: PlaceholderPageProps) {
  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      <div className="rounded-xl border border-dashed border-border bg-surface/30 px-8 py-16 text-center">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-border bg-surface">
          <Construction className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="mt-4 text-[13.5px] font-medium text-foreground">
          Architecture placeholder
        </div>
        <p className="mx-auto mt-1.5 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
          This page is part of the OryCMS foundational architecture. Full implementation ships in{" "}
          <span className="font-medium text-foreground">{milestone}</span>.
        </p>
      </div>
    </div>
  );
}
