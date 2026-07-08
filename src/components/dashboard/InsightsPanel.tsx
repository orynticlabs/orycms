import { Sparkles, TrendingUp, AlertTriangle, PackageX, ShoppingCart, UserPlus, RefreshCcw } from "lucide-react";

const activity = [
  { icon: ShoppingCart, iconClass: "text-foreground", text: "New order #4021 from Amelia W.", meta: "$248.00 · 2m ago" },
  { icon: PackageX, iconClass: "text-warning", text: "Ceramic Mug — Sand is low stock (4 left)", meta: "8m ago" },
  { icon: UserPlus, iconClass: "text-info", text: "12 new customers today", meta: "14m ago" },
  { icon: RefreshCcw, iconClass: "text-muted-foreground", text: "Refund approved for order #3987", meta: "26m ago" },
  { icon: ShoppingCart, iconClass: "text-foreground", text: "Order #4018 shipped via DHL", meta: "42m ago" },
];

const insights = [
  {
    tone: "opportunity",
    title: "Bundle opportunity",
    body: "Customers who buy Linen Tee also buy Canvas Tote 63% of the time. Try a bundle.",
    cta: "Create bundle",
  },
  {
    tone: "risk",
    title: "Cart abandonment up 8%",
    body: "Checkout drop-off increased on mobile Safari. Review the shipping step.",
    cta: "Inspect funnel",
  },
];

export function InsightsPanel() {
  return (
    <aside className="hidden xl:flex flex-col w-[320px] shrink-0 border-l border-border bg-surface-muted/40">
      <div className="p-4 border-b border-border/70">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          AI Insights
        </div>
        <div className="mt-3 space-y-2.5">
          {insights.map((i) => (
            <div key={i.title} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center gap-1.5">
                {i.tone === "opportunity" ? (
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                )}
                <span className="text-[12.5px] font-semibold">{i.title}</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{i.body}</p>
              <button className="mt-2 text-[11.5px] font-medium text-foreground hover:underline underline-offset-4">
                {i.cta} →
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-b border-border/70">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Inventory warnings</div>
          <span className="text-[11px] text-muted-foreground">3</span>
        </div>
        <div className="mt-2.5 space-y-1.5">
          {[
            { name: "Ceramic Mug — Sand", stock: 4 },
            { name: "Linen Tee — M", stock: 2 },
            { name: "Canvas Tote — Natural", stock: 6 },
          ].map((p) => (
            <div key={p.name} className="flex items-center justify-between text-[12.5px] py-1">
              <span className="truncate pr-2">{p.name}</span>
              <span className="num shrink-0 tabular-nums text-warning font-medium">{p.stock} left</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Live activity</div>
        <ol className="mt-3 space-y-3.5 relative">
          <span className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
          {activity.map((a, i) => {
            const Icon = a.icon;
            return (
              <li key={i} className="relative pl-6">
                <span className="absolute left-0 top-0.5 h-[15px] w-[15px] rounded-full bg-surface border border-border grid place-items-center">
                  <Icon className={`h-2.5 w-2.5 ${a.iconClass}`} />
                </span>
                <div className="text-[12.5px] leading-snug">{a.text}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{a.meta}</div>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}
