"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  MoreHorizontal,
  PackageCheck,
  Receipt,
  RotateCcw,
  Search,
  ShieldAlert,
  Truck,
} from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { cn, formatCurrency } from "@/lib/utils";

const stages = [
  {
    label: "Needs review",
    count: 14,
    tint: "text-warning bg-warning/10",
    items: [
      { id: "#4108", customer: "Aditi Rao", issue: "High-risk payment flag", age: "4m" },
      { id: "#4105", customer: "Marco Stein", issue: "Address verification pending", age: "11m" },
      { id: "#4103", customer: "Harper Hall", issue: "Gift note mismatch", age: "19m" },
    ],
  },
  {
    label: "Packing",
    count: 28,
    tint: "text-info bg-info/10",
    items: [
      { id: "#4101", customer: "Noah Bennett", issue: "3 items · split pick", age: "7m" },
      { id: "#4098", customer: "Sara Khan", issue: "Fragile wrap required", age: "15m" },
      { id: "#4096", customer: "Julian Park", issue: "Warehouse B", age: "23m" },
    ],
  },
  {
    label: "Ready to dispatch",
    count: 46,
    tint: "text-success bg-success/10",
    items: [
      { id: "#4094", customer: "Emma Li", issue: "DHL pickup 16:00", age: "3m" },
      { id: "#4092", customer: "Rohan Das", issue: "Express label printed", age: "8m" },
      { id: "#4090", customer: "Maya Flores", issue: "COD confirmed", age: "13m" },
    ],
  },
];

const rows = [
  {
    id: "#4108",
    customer: "Aditi Rao",
    email: "aditi@orynticlabs.com",
    channel: "Web",
    total: 684,
    items: 4,
    payment: "Review",
    shipping: "Hold",
    age: "4m ago",
    priority: "High",
    tone: "from-chart-4 to-chart-1",
  },
  {
    id: "#4105",
    customer: "Marco Stein",
    email: "marco@atelier.studio",
    channel: "Instagram",
    total: 148.5,
    items: 2,
    payment: "Paid",
    shipping: "Packing",
    age: "11m ago",
    priority: "Medium",
    tone: "from-chart-2 to-chart-3",
  },
  {
    id: "#4101",
    customer: "Noah Bennett",
    email: "noah@fastmail.com",
    channel: "Web",
    total: 89.5,
    items: 1,
    payment: "Paid",
    shipping: "Queued",
    age: "17m ago",
    priority: "Normal",
    tone: "from-chart-3 to-chart-2",
  },
  {
    id: "#4098",
    customer: "Sara Khan",
    email: "sara@northco.io",
    channel: "Retail POS",
    total: 412,
    items: 6,
    payment: "Paid",
    shipping: "Packing",
    age: "22m ago",
    priority: "High",
    tone: "from-chart-5 to-chart-4",
  },
  {
    id: "#4094",
    customer: "Emma Li",
    email: "emma@fabricate.co",
    channel: "Wholesale",
    total: 1248,
    items: 12,
    payment: "Paid",
    shipping: "Ready",
    age: "31m ago",
    priority: "Normal",
    tone: "from-chart-1 to-chart-5",
  },
  {
    id: "#4089",
    customer: "Priya Shah",
    email: "priya@work.io",
    channel: "Web",
    total: 512.4,
    items: 5,
    payment: "Refunded",
    shipping: "Returned",
    age: "58m ago",
    priority: "High",
    tone: "from-chart-4 to-chart-1",
  },
];

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface", className)}>{children}</div>
  );
}

function StatusPill({
  tone,
  label,
}: {
  tone: "success" | "warning" | "info" | "muted" | "destructive";
  label: string;
}) {
  const styles = {
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    info: "text-info bg-info/10",
    muted: "text-muted-foreground bg-muted",
    destructive: "text-destructive bg-destructive/10",
  };

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium",
        styles[tone],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function OrdersHero() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-[12px] text-muted-foreground">Order operations</div>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight">Orders control tower</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          46 shipments are ready for dispatch and 14 orders need review before cutoff.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[12.5px] font-medium hover:border-border-strong transition-colors">
          <Download className="h-3.5 w-3.5" />
          Export queue
        </button>
        <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-[12.5px] font-medium text-background hover:opacity-90 transition-opacity">
          <Receipt className="h-3.5 w-3.5" />
          Create order
        </button>
      </div>
    </div>
  );
}

function MetricsStrip() {
  const metrics = [
    { label: "Orders today", value: "312", foot: "18 above target", icon: Receipt },
    { label: "To fulfill", value: "88", foot: "46 ready to dispatch", icon: Truck },
    { label: "At risk", value: "14", foot: "Manual review queue", icon: ShieldAlert },
    { label: "Returns", value: "6", foot: "2 awaiting inspection", icon: RotateCcw },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="p-5">
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {metric.label}
              </div>
              <div className="mt-2 text-[24px] font-semibold tracking-tight num">
                {metric.value}
              </div>
              <div className="mt-1 text-[11.5px] text-muted-foreground">{metric.foot}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function QueueBoard() {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[13.5px] font-semibold">Fulfillment board</div>
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">
            Live queue for the next carrier pickup window
          </div>
        </div>
        <button className="text-[11.5px] text-muted-foreground hover:text-foreground">
          Open warehouse view
        </button>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {stages.map((stage) => (
          <div
            key={stage.label}
            className="rounded-lg border border-border bg-surface-muted/50 p-3"
          >
            <div className="flex items-center gap-2">
              <div className={cn("grid h-7 w-7 place-items-center rounded-md", stage.tint)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="text-[12.5px] font-semibold">{stage.label}</div>
                <div className="text-[11px] text-muted-foreground">{stage.count} orders</div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {stage.items.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[12px] font-medium">{item.id}</div>
                      <div className="mt-1 text-[12.5px] font-medium">{item.customer}</div>
                      <div className="mt-0.5 text-[11.5px] text-muted-foreground">{item.issue}</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{item.age}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ServicePanel() {
  const items = [
    {
      icon: Clock3,
      title: "Cutoff timer",
      body: "DHL express closes in 01h 42m. 9 orders still need labels.",
      tone: "warning" as const,
    },
    {
      icon: AlertTriangle,
      title: "Exceptions",
      body: "4 orders are blocked on address validation and 2 on payment review.",
      tone: "destructive" as const,
    },
    {
      icon: PackageCheck,
      title: "Accuracy",
      body: "Pick-pack accuracy is at 99.2% across both warehouses today.",
      tone: "success" as const,
    },
  ];

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="text-[13.5px] font-semibold">Dispatch SLA</div>
        <div className="mt-4 space-y-3">
          {[
            { label: "Same day", value: 82, tone: "bg-success" },
            { label: "Next day", value: 13, tone: "bg-info" },
            { label: "Breached", value: 5, tone: "bg-destructive" },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="num font-medium">{item.value}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", item.tone)}
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-[13.5px] font-semibold">Operations notes</div>
        <div className="mt-3 space-y-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex gap-3 rounded-lg border border-border bg-surface-muted/50 p-3"
              >
                <div
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-md",
                    item.tone === "success" && "text-success bg-success/10",
                    item.tone === "warning" && "text-warning bg-warning/10",
                    item.tone === "destructive" && "text-destructive bg-destructive/10",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[12.5px] font-medium">{item.title}</div>
                  <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                    {item.body}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function OrdersTable() {
  const [filter, setFilter] = useState("All");

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
        <div>
          <div className="text-[13.5px] font-semibold">Order queue</div>
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">
            Prioritized by risk, dispatch urgency, and channel
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-[12px] text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            Search orders
          </div>
          <div className="inline-flex items-center rounded-md border border-border bg-surface-muted p-0.5 text-[12px]">
            {["All", "Review", "Packing", "Ready"].map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={cn(
                  "h-7 rounded-[5px] px-2.5 transition-colors",
                  filter === option
                    ? "bg-surface text-foreground shadow-xs font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
          <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[12px] font-medium hover:border-border-strong transition-colors">
            <Filter className="h-3.5 w-3.5" />
            Filters
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full text-[13px]">
          <thead className="border-y border-border bg-surface-muted/50">
            <tr className="text-[11px] text-muted-foreground">
              <th className="h-9 px-5 text-left font-medium">Order</th>
              <th className="h-9 px-3 text-left font-medium">Customer</th>
              <th className="h-9 px-3 text-left font-medium">Channel</th>
              <th className="h-9 px-3 text-left font-medium">Items</th>
              <th className="h-9 px-3 text-left font-medium">Payment</th>
              <th className="h-9 px-3 text-left font-medium">Shipping</th>
              <th className="h-9 px-3 text-left font-medium">Priority</th>
              <th className="h-9 px-3 text-right font-medium">Total</th>
              <th className="h-9 px-5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border last:border-0 transition-colors hover:bg-accent/40"
              >
                <td className="px-5 py-3">
                  <div className="font-mono text-[12.5px] font-medium">{row.id}</div>
                  <div className="text-[11px] text-muted-foreground">{row.age}</div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white",
                        row.tone,
                      )}
                    >
                      {row.customer
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{row.customer}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{row.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-muted-foreground">{row.channel}</td>
                <td className="px-3 py-3 num">{row.items}</td>
                <td className="px-3 py-3">
                  <StatusPill
                    tone={
                      row.payment === "Paid"
                        ? "success"
                        : row.payment === "Refunded"
                          ? "destructive"
                          : "warning"
                    }
                    label={row.payment}
                  />
                </td>
                <td className="px-3 py-3">
                  <StatusPill
                    tone={
                      row.shipping === "Ready"
                        ? "success"
                        : row.shipping === "Packing"
                          ? "info"
                          : row.shipping === "Returned"
                            ? "destructive"
                            : row.shipping === "Hold"
                              ? "warning"
                              : "muted"
                    }
                    label={row.shipping}
                  />
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      "inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium",
                      row.priority === "High" && "bg-destructive/10 text-destructive",
                      row.priority === "Medium" && "bg-warning/10 text-warning",
                      row.priority === "Normal" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {row.priority}
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-medium num">
                  {formatCurrency(row.total)}
                </td>
                <td className="px-5 py-3 text-right">
                  <button className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ReturnsBanner() {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-destructive/10 text-destructive">
          <RotateCcw className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-medium">Returns inspection batch opens at 17:30</div>
          <div className="text-[11.5px] text-muted-foreground">
            6 returned orders are waiting for QA disposition and refund release.
          </div>
        </div>
        <button className="inline-flex h-8 items-center gap-1 text-[12px] font-medium text-foreground">
          Open returns desk
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </Card>
  );
}

export default function OrdersPage() {
  return (
    <AppShell section="Orders">
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <OrdersHero />
        <MetricsStrip />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <QueueBoard />
          </div>
          <ServicePanel />
        </div>
        <ReturnsBanner />
        <OrdersTable />
      </div>
    </AppShell>
  );
}
