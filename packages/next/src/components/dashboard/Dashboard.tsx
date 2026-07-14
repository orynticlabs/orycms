import { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Plus,
  Ticket,
  Image as ImageIcon,
  Megaphone,
  Truck,
  Clock,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn, formatCompactCurrency, formatCurrency } from "@/lib/utils";

/* ---------- data ---------- */
const revenueData = [
  { d: "Mon", v: 4200, p: 3800 },
  { d: "Tue", v: 5100, p: 4400 },
  { d: "Wed", v: 4800, p: 4600 },
  { d: "Thu", v: 6200, p: 5100 },
  { d: "Fri", v: 7400, p: 5800 },
  { d: "Sat", v: 8900, p: 6900 },
  { d: "Sun", v: 7800, p: 6200 },
];

const funnel = [
  { label: "Visitors", value: 48210, pct: 100 },
  { label: "Add to Cart", value: 12384, pct: 25.7 },
  { label: "Checkout", value: 5842, pct: 12.1 },
  { label: "Purchase", value: 3126, pct: 6.5 },
];

const topProducts = [
  { name: "Linen Crewneck Tee", sku: "LT-01", sold: 428, rev: 12840, trend: 12.4 },
  { name: "Canvas Everyday Tote", sku: "CT-04", sold: 361, rev: 9748, trend: 8.1 },
  { name: "Ceramic Mug — Sand", sku: "CM-11", sold: 289, rev: 5202, trend: -3.2 },
  { name: "Merino Beanie", sku: "MB-02", sold: 214, rev: 4708, trend: 5.6 },
  { name: "Oak Serving Board", sku: "OS-07", sold: 172, rev: 8256, trend: 21.0 },
];

const orders = [
  {
    id: "#4021",
    name: "Amelia Watson",
    email: "amelia@hey.com",
    items: 3,
    total: 248.0,
    pay: "paid",
    ship: "processing",
    initials: "AW",
    tone: "from-chart-1 to-chart-5",
  },
  {
    id: "#4020",
    name: "Noah Bennett",
    email: "noah@fastmail.com",
    items: 1,
    total: 89.5,
    pay: "paid",
    ship: "shipped",
    initials: "NB",
    tone: "from-chart-2 to-chart-3",
  },
  {
    id: "#4019",
    name: "Priya Shah",
    email: "priya@work.io",
    items: 5,
    total: 512.4,
    pay: "pending",
    ship: "unfulfilled",
    initials: "PS",
    tone: "from-chart-4 to-chart-1",
  },
  {
    id: "#4018",
    name: "Marc Dubois",
    email: "marc@dubois.fr",
    items: 2,
    total: 164.0,
    pay: "paid",
    ship: "delivered",
    initials: "MD",
    tone: "from-chart-3 to-chart-2",
  },
  {
    id: "#4017",
    name: "Ines García",
    email: "ines@correo.es",
    items: 4,
    total: 328.9,
    pay: "refunded",
    ship: "returned",
    initials: "IG",
    tone: "from-chart-5 to-chart-4",
  },
];

/* ---------- primitives ---------- */
function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface", className)}>{children}</div>
  );
}

function Delta({ v }: { v: number }) {
  const up = v >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11.5px] font-medium px-1.5 h-[20px] rounded-full num",
        up ? "text-success bg-success/10" : "text-destructive bg-destructive/10",
      )}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? "+" : ""}
      {v.toFixed(1)}%
    </span>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center p-0.5 rounded-md border border-border bg-surface-muted text-[12px]">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            "px-2.5 h-6 rounded-[5px] transition-colors",
            value === o
              ? "bg-surface text-foreground shadow-xs font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function StatusPill({
  kind,
  label,
}: {
  kind:
    | "paid"
    | "pending"
    | "refunded"
    | "shipped"
    | "processing"
    | "unfulfilled"
    | "delivered"
    | "returned";
  label: string;
}) {
  const map: Record<string, string> = {
    paid: "text-success bg-success/10",
    delivered: "text-success bg-success/10",
    shipped: "text-info bg-info/10",
    processing: "text-warning bg-warning/10",
    pending: "text-warning bg-warning/10",
    unfulfilled: "text-muted-foreground bg-muted",
    refunded: "text-destructive bg-destructive/10",
    returned: "text-destructive bg-destructive/10",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium px-1.5 h-[20px] rounded-full",
        map[kind],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/* ---------- sections ---------- */
function Hero() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-1">
      <div>
        <div className="text-[12px] text-muted-foreground">Wednesday, July 8</div>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight leading-tight">
          Good evening, Tushar <span className="inline-block">👋</span>
        </h1>
        <p className="text-[13.5px] text-muted-foreground mt-1">
          Sales are pacing <span className="text-success font-medium">14.2% ahead</span> of last
          week. Two products need restocking.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button className="h-9 px-3 rounded-lg border border-border bg-surface text-[12.5px] font-medium hover:border-border-strong transition-colors">
          Export report
        </button>
        <button className="h-9 px-3 rounded-lg bg-foreground text-background text-[12.5px] font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          New product
        </button>
      </div>
    </div>
  );
}

function ExecMetrics() {
  const metrics = [
    {
      label: "Revenue today",
      value: formatCurrency(14283),
      delta: 12.4,
      foot: `vs. ${formatCurrency(12712)} yesterday`,
    },
    { label: "Orders", value: "312", delta: 8.1, foot: "42 pending fulfillment" },
    { label: "Conversion rate", value: "3.28%", delta: -0.6, foot: "of 48,210 visitors" },
    {
      label: "Avg. order value",
      value: formatCurrency(92.4),
      delta: 4.2,
      foot: "AOV up over 7 days",
    },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
        {metrics.map((m) => (
          <div key={m.label} className="p-5">
            <div className="text-[12px] text-muted-foreground">{m.label}</div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <div className="text-[24px] font-semibold tracking-tight num">{m.value}</div>
              <Delta v={m.delta} />
            </div>
            <div className="mt-1 text-[11.5px] text-muted-foreground">{m.foot}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RevenueChart() {
  const [range, setRange] = useState("7D");
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] text-muted-foreground">Revenue</div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-[22px] font-semibold tracking-tight num">
              {formatCurrency(74392.1)}
            </div>
            <Delta v={14.2} />
          </div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5">
            Compared to {formatCurrency(65148)} previous period
          </div>
        </div>
        <Segmented options={["1D", "7D", "1M", "1Y"]} value={range} onChange={setRange} />
      </div>

      <div className="mt-4 h-[240px] -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={revenueData} margin={{ top: 10, left: -12, right: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.22 0.02 265)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="oklch(0.22 0.02 265)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey="d"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              tickFormatter={(v) => formatCompactCurrency(v)}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-border-strong)", strokeDasharray: "3 3" }}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
                boxShadow: "var(--shadow-elevated)",
              }}
              labelStyle={{ color: "var(--color-muted-foreground)", marginBottom: 2 }}
              formatter={(v: number) => [formatCurrency(v), "Revenue"]}
            />
            <Area
              type="monotone"
              dataKey="p"
              stroke="var(--color-border-strong)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="transparent"
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke="var(--color-foreground)"
              strokeWidth={2}
              fill="url(#rev)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function OrdersOverview() {
  const rows = [
    { icon: Clock, label: "Active", value: 128, tint: "text-warning bg-warning/10" },
    { icon: Truck, label: "Shipping", value: 74, tint: "text-info bg-info/10" },
    { icon: CheckCircle2, label: "Delivered", value: 892, tint: "text-success bg-success/10" },
    { icon: RotateCcw, label: "Refunds", value: 6, tint: "text-destructive bg-destructive/10" },
  ];
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13.5px] font-semibold">Orders overview</div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5">
            Snapshot of order pipeline
          </div>
        </div>
        <button className="text-[11.5px] text-muted-foreground hover:text-foreground">
          View all →
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.label} className="flex items-center gap-3 py-1.5">
              <div className={cn("h-7 w-7 rounded-md grid place-items-center", r.tint)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="text-[13px]">{r.label}</div>
              <div className="ml-auto num text-[14px] font-semibold tabular-nums">{r.value}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Funnel() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13.5px] font-semibold">Sales funnel</div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5">Last 7 days</div>
        </div>
        <span className="text-[11.5px] text-muted-foreground">Conv. 6.5%</span>
      </div>
      <div className="mt-4 space-y-3">
        {funnel.map((f, i) => (
          <div key={f.label}>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-muted-foreground">{f.label}</span>
              <span className="num tabular-nums font-medium">
                {f.value.toLocaleString()}{" "}
                <span className="text-muted-foreground font-normal">· {f.pct}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-foreground rounded-full transition-all duration-500"
                style={{ width: `${f.pct}%`, opacity: 1 - i * 0.15 }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CustomerInsights() {
  const data = [
    { d: "W1", n: 120, r: 210 },
    { d: "W2", n: 145, r: 232 },
    { d: "W3", n: 132, r: 258 },
    { d: "W4", n: 168, r: 274 },
    { d: "W5", n: 190, r: 288 },
    { d: "W6", n: 172, r: 305 },
  ];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[13.5px] font-semibold">Customer insights</div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5">
            New vs. returning · 6 weeks
          </div>
        </div>
        <div className="flex gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-foreground" />
            New
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-border-strong" />
            Returning
          </span>
        </div>
      </div>
      <div className="mt-4 h-[160px] -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 0, left: -20, bottom: 0 }}
            barCategoryGap={16}
          >
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey="d"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "var(--color-accent)" }}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="n" fill="var(--color-foreground)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="r" fill="var(--color-border-strong)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 pt-3 border-t border-border">
        {[
          { l: "New (30d)", v: "1,284", d: 9.2 },
          { l: "Returning", v: "3,478", d: 4.1 },
          { l: "LTV", v: formatCurrency(412), d: 6.7 },
        ].map((s) => (
          <div key={s.l}>
            <div className="text-[11px] text-muted-foreground">{s.l}</div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-[15px] font-semibold num">{s.v}</span>
              <Delta v={s.d} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TopProducts() {
  const maxRevenue = Math.max(...topProducts.map((product) => product.rev));

  return (
    <Card>
      <div className="flex items-center justify-between p-5 pb-3">
        <div>
          <div className="text-[13.5px] font-semibold">Top products</div>
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">By revenue · last 7 days</div>
        </div>
        <button className="text-[11.5px] text-muted-foreground hover:text-foreground">
          View all →
        </button>
      </div>
      <div className="space-y-2 px-3 pb-3">
        {topProducts.map((p, i) => (
          <div
            key={p.sku}
            className="rounded-lg border border-border bg-surface-muted/35 p-3 transition-colors hover:bg-accent/40"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-[10px] font-mono text-muted-foreground">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{p.name}</div>
                    <div className="mt-0.5 text-[11px] font-mono text-muted-foreground">
                      {p.sku}
                    </div>
                  </div>
                  <Delta v={p.trend} />
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${(p.rev / maxRevenue) * 100}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-[11.5px]">
                  <div>
                    <div className="text-muted-foreground">Units sold</div>
                    <div className="mt-0.5 font-medium num">{p.sold}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-muted-foreground">Revenue</div>
                    <div className="mt-0.5 font-medium num">{formatCurrency(p.rev)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function InventoryHealth() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13.5px] font-semibold">Inventory health</div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5">All warehouses</div>
        </div>
        <span className="text-[11.5px] font-medium text-success">Healthy</span>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="relative h-[86px] w-[86px]">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="var(--color-muted)"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="var(--color-foreground)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(84 / 100) * 97.4} 97.4`}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="text-[18px] font-semibold num leading-none">84</div>
              <div className="text-[9.5px] text-muted-foreground uppercase tracking-wider">
                score
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-1.5 text-[12.5px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">In stock</span>
            <span className="num font-medium">1,284</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Low stock</span>
            <span className="num font-medium text-warning">12</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Out of stock</span>
            <span className="num font-medium text-destructive">3</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function QuickActions() {
  const actions = [
    { icon: Plus, label: "Add product" },
    { icon: Ticket, label: "Create coupon" },
    { icon: ImageIcon, label: "Publish banner" },
    { icon: Megaphone, label: "New campaign" },
  ];
  return (
    <Card className="p-5">
      <div className="text-[13.5px] font-semibold">Quick actions</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {actions.map((a) => {
          const I = a.icon;
          return (
            <button
              key={a.label}
              className="group flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-surface hover:border-border-strong hover:bg-accent/60 text-[12.5px] font-medium transition-all"
            >
              <div className="h-6 w-6 rounded-md bg-surface-muted grid place-items-center group-hover:bg-foreground group-hover:text-background transition-colors">
                <I className="h-3.5 w-3.5" />
              </div>
              <span className="truncate">{a.label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function OrdersTable() {
  return (
    <Card>
      <div className="p-5 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[13.5px] font-semibold">Recent orders</div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5">312 orders today</div>
        </div>
        <div className="flex items-center gap-2">
          <Segmented options={["All", "Unfulfilled", "Refunds"]} value="All" onChange={() => {}} />
          <button className="h-8 px-3 rounded-md border border-border bg-surface text-[12px] font-medium hover:border-border-strong transition-colors">
            Export
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[720px]">
          <thead className="border-y border-border bg-surface-muted/50">
            <tr className="text-[11px] text-muted-foreground">
              <th className="text-left font-medium px-5 h-9">Order</th>
              <th className="text-left font-medium px-3 h-9">Customer</th>
              <th className="text-left font-medium px-3 h-9">Items</th>
              <th className="text-left font-medium px-3 h-9">Payment</th>
              <th className="text-left font-medium px-3 h-9">Shipping</th>
              <th className="text-right font-medium px-3 h-9">Total</th>
              <th className="text-right font-medium px-5 h-9"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors"
              >
                <td className="px-5 py-3">
                  <div className="font-medium font-mono text-[12.5px]">{o.id}</div>
                  <div className="text-[11px] text-muted-foreground">2m ago</div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "h-7 w-7 rounded-full bg-gradient-to-br grid place-items-center text-[10px] font-semibold text-white",
                        o.tone,
                      )}
                    >
                      {o.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{o.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{o.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 num tabular-nums">{o.items}</td>
                <td className="px-3 py-3">
                  <StatusPill kind={o.pay as never} label={o.pay} />
                </td>
                <td className="px-3 py-3">
                  <StatusPill kind={o.ship as never} label={o.ship} />
                </td>
                <td className="px-3 py-3 text-right num tabular-nums font-medium">
                  {formatCurrency(o.total)}
                </td>
                <td className="px-5 py-3 text-right">
                  <button className="h-7 w-7 grid place-items-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
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

/* ---------- root ---------- */
export function Dashboard() {
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      <Hero />
      <ExecMetrics />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <OrdersOverview />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Funnel />
        <CustomerInsights />
        <div className="space-y-5">
          <InventoryHealth />
          <QuickActions />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <OrdersTable />
        </div>
        <TopProducts />
      </div>
    </div>
  );
}
