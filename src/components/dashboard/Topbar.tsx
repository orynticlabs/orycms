import { Search, Bell, Plus, PanelLeft, ChevronDown, Command } from "lucide-react";
import { cn } from "@/lib/utils";

export function Topbar({ onToggle }: { onToggle: () => void }) {
  return (
    <header className="h-14 shrink-0 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
      <div className="h-full px-4 flex items-center gap-3">
        <button
          onClick={onToggle}
          className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>

        {/* Breadcrumb */}
        <div className="hidden md:flex items-center gap-1.5 text-[13px]">
          <span className="text-muted-foreground">Northwind</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium">Overview</span>
        </div>

        {/* Search / Command */}
        <div className="flex-1 flex justify-center">
          <button
            className={cn(
              "group flex items-center gap-2 h-9 w-full max-w-[520px] px-3 rounded-lg border border-border bg-surface hover:border-border-strong text-[13px] text-muted-foreground transition-colors",
            )}
          >
            <Search className="h-3.5 w-3.5" />
            <span className="truncate">Search products, orders, customers…</span>
            <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 text-[10.5px] font-mono text-muted-foreground/80 px-1.5 h-5 rounded border border-border bg-background">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button className="hidden sm:inline-flex h-8 items-center gap-1.5 pl-2 pr-2.5 rounded-md text-[12.5px] font-medium hover:bg-accent text-foreground/80 transition-colors">
            <span className="h-4 w-4 rounded-sm bg-gradient-to-br from-chart-2 to-chart-1" />
            Live store
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          <button className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors relative">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
          </button>

          <button className="ml-1 hidden sm:inline-flex h-8 items-center gap-1.5 pl-2 pr-3 rounded-md bg-foreground text-background text-[12.5px] font-medium hover:opacity-90 transition-opacity">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Quick action
          </button>

          <div className="ml-1 h-8 w-8 rounded-full bg-gradient-to-br from-chart-3 to-chart-4 grid place-items-center text-[11px] font-semibold text-white">
            TS
          </div>
        </div>
      </div>
    </header>
  );
}
