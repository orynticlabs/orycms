import { cn } from "@/lib/utils";

interface PageAction {
  label: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  icon?: React.ComponentType<{ className?: string }>;
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: PageAction[];
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && <div className="text-[12px] text-muted-foreground">{eyebrow}</div>}
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight leading-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-[13.5px] text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && actions.length > 0 && (
        <div className="flex items-center gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={action.onClick}
                className={cn(
                  "h-9 px-3 rounded-lg text-[12.5px] font-medium transition-all inline-flex items-center gap-1.5",
                  action.variant === "primary"
                    ? "bg-foreground text-background hover:opacity-90"
                    : "border border-border bg-surface hover:border-border-strong",
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
