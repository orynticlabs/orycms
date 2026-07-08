"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Tags,
  Boxes,
  Receipt,
  Users,
  Megaphone,
  FileText,
  LineChart,
  Settings,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Item = {
  label: string;
  to?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children?: { label: string; to: string; icon: React.ComponentType<{ className?: string }> }[];
};

const NAV: { section: string; items: Item[] }[] = [
  {
    section: "Workspace",
    items: [
      { label: "Overview", to: "/", icon: LayoutDashboard },
      {
        label: "Commerce",
        icon: ShoppingBag,
        children: [
          { label: "Products", to: "/products", icon: Package },
          { label: "Categories", to: "/categories", icon: Tags },
          { label: "Inventory", to: "/inventory", icon: Boxes },
        ],
      },
      { label: "Orders", to: "/orders", icon: Receipt, badge: "12" },
      { label: "Customers", to: "/customers", icon: Users },
    ],
  },
  {
    section: "Growth",
    items: [
      { label: "Marketing", to: "/marketing", icon: Megaphone },
      { label: "Content", to: "/content", icon: FileText },
      { label: "Analytics", to: "/analytics", icon: LineChart },
    ],
  },
  {
    section: "System",
    items: [{ label: "Settings", to: "/settings", icon: Settings }],
  },
];

export function AppSidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>({ Commerce: true });

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-r border-border bg-sidebar transition-[width] duration-300 ease-out",
        collapsed ? "w-[68px]" : "w-[248px]",
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border/70 bg-sidebar px-4">
        <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface">
          <Image
            src="/favicon.png"
            alt="OryCMS logo"
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
          />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[13px] font-semibold tracking-tight truncate">OryCMS</div>
            <div className="truncate text-[11px] text-muted-foreground">
              By OrynticLabs Private Limited
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5">
        {NAV.map((group) => (
          <div key={group.section}>
            {!collapsed && (
              <div className="px-2 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
                {group.section}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.to && (item.to === "/" ? pathname === "/" : pathname.startsWith(item.to));
                const hasKids = !!item.children?.length;
                const isOpen = open[item.label];
                const Icon = item.icon;

                if (hasKids) {
                  return (
                    <li key={item.label}>
                      <button
                        onClick={() => setOpen((o) => ({ ...o, [item.label]: !o[item.label] }))}
                        className={cn(
                          "group w-full flex items-center gap-2.5 px-2 h-8 rounded-md text-[13px] text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                        {!collapsed && (
                          <>
                            <span className="truncate">{item.label}</span>
                            <ChevronDown
                              className={cn(
                                "ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform",
                                isOpen && "rotate-180",
                              )}
                            />
                          </>
                        )}
                      </button>
                      {!collapsed && isOpen && (
                        <ul className="mt-0.5 ml-6 pl-3 border-l border-border/70 space-y-0.5">
                          {item.children!.map((c) => {
                            const cActive = pathname.startsWith(c.to);
                            return (
                              <li key={c.label}>
                                <Link
                                  href={c.to}
                                  className={cn(
                                    "flex items-center gap-2 h-7 px-2 rounded-md text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors",
                                    cActive && "text-foreground bg-sidebar-accent",
                                  )}
                                >
                                  <span className="truncate">{c.label}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                }

                return (
                  <li key={item.label}>
                    <Link
                      href={item.to!}
                      className={cn(
                        "group flex items-center gap-2.5 px-2 h-8 rounded-md text-[13px] text-sidebar-foreground hover:bg-sidebar-accent transition-colors relative",
                        active && "bg-sidebar-accent text-foreground font-medium",
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-foreground" />
                      )}
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active
                            ? "text-foreground"
                            : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      {!collapsed && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {item.badge && (
                            <span className="ml-auto text-[10.5px] font-medium px-1.5 h-[18px] grid place-items-center rounded-full bg-foreground text-background num">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Upsell */}
      {!collapsed && (
        <div className="m-2.5 p-3 rounded-lg border border-border bg-surface">
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            AI Copilot
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
            Ask questions across orders, inventory, and customers.
          </p>
          <button className="mt-2 w-full h-7 rounded-md bg-foreground text-background text-[11.5px] font-medium hover:opacity-90 transition-opacity">
            Try Copilot
          </button>
        </div>
      )}
    </aside>
  );
}
