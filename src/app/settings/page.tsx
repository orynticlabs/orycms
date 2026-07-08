"use client";

import { useState } from "react";
import {
  Bell,
  Building2,
  Check,
  CreditCard,
  Globe,
  Lock,
  Mail,
  Shield,
  Smartphone,
  Store,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface", className)}>{children}</div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-surface-muted text-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[13.5px] font-semibold">{title}</div>
        <div className="mt-0.5 text-[11.5px] text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="max-w-[620px]">
        <div className="text-[12.5px] font-medium">{title}</div>
        <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
          {description}
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [profileName, setProfileName] = useState("Tushar Gupta");
  const [companyName, setCompanyName] = useState("OryCMS");
  const [companyEmail, setCompanyEmail] = useState("ops@orynticlabs.com");
  const [supportEmail, setSupportEmail] = useState("support@orynticlabs.com");
  const [domain, setDomain] = useState("admin.orycms.in");
  const [address, setAddress] = useState(
    "OrynticLabs Private Limited, Bengaluru, Karnataka, India",
  );
  const [orderPrefix, setOrderPrefix] = useState("ORY");
  const [lowStockThreshold, setLowStockThreshold] = useState("8");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [language, setLanguage] = useState("en-IN");
  const [twoFactor, setTwoFactor] = useState(true);
  const [auditLog, setAuditLog] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(false);
  const [marketingDigest, setMarketingDigest] = useState(true);
  const [returnApproval, setReturnApproval] = useState(true);
  const [internationalOrders, setInternationalOrders] = useState(false);

  return (
    <AppShell section="Settings" showInsights={false}>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[12px] text-muted-foreground">Workspace configuration</div>
            <h1 className="mt-1 text-[26px] font-semibold tracking-tight">Settings</h1>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Configure store identity, operational defaults, notifications, security, and billing
              for OryCMS.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">Discard changes</Button>
            <Button>Save changes</Button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
          <div className="space-y-5">
            <Card className="p-5">
              <SectionHeader
                icon={Building2}
                title="Organization profile"
                description="Core identity and public contact points used across invoices, notifications, and storefront templates."
              />
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-[11.5px] font-medium text-muted-foreground">
                    Workspace name
                  </span>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11.5px] font-medium text-muted-foreground">
                    Admin owner
                  </span>
                  <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11.5px] font-medium text-muted-foreground">
                    Operations email
                  </span>
                  <Input value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11.5px] font-medium text-muted-foreground">
                    Support email
                  </span>
                  <Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
                </label>
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-[11.5px] font-medium text-muted-foreground">
                    Admin domain
                  </span>
                  <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
                </label>
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-[11.5px] font-medium text-muted-foreground">
                    Registered address
                  </span>
                  <Textarea value={address} onChange={(e) => setAddress(e.target.value)} />
                </label>
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader
                icon={Store}
                title="Store defaults"
                description="Operational preferences that shape how orders, pricing, and catalog workflows behave."
              />
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-[11.5px] font-medium text-muted-foreground">Currency</span>
                  <Select defaultValue="INR">
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11.5px] font-medium text-muted-foreground">Time zone</span>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time zone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Kolkata">Asia/Kolkata</SelectItem>
                      <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11.5px] font-medium text-muted-foreground">Locale</span>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select locale" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en-IN">English (India)</SelectItem>
                      <SelectItem value="hi-IN">Hindi (India)</SelectItem>
                      <SelectItem value="en-GB">English (UK)</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11.5px] font-medium text-muted-foreground">
                    Order prefix
                  </span>
                  <Input value={orderPrefix} onChange={(e) => setOrderPrefix(e.target.value)} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11.5px] font-medium text-muted-foreground">
                    Low stock threshold
                  </span>
                  <Input
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                  />
                </label>
              </div>
              <div className="mt-5 rounded-lg border border-border bg-surface-muted/40 p-4">
                <div className="text-[12px] font-medium">Pricing preview</div>
                <div className="mt-1 text-[11.5px] text-muted-foreground">
                  Dashboard totals, catalog summaries, and order values now render in rupees, for
                  example {formatCurrency(74392.1)}.
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader
                icon={Bell}
                title="Notifications"
                description="Control which operational events should interrupt the team and where those alerts are delivered."
              />
              <div className="mt-5">
                <SettingRow
                  title="Email alerts"
                  description="Send fulfillment issues, payment review alerts, and stock exceptions to operations inboxes."
                  control={<Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />}
                />
                <SettingRow
                  title="Push alerts"
                  description="Deliver urgent dispatch and fraud-review updates to mobile devices for the active team."
                  control={<Switch checked={pushAlerts} onCheckedChange={setPushAlerts} />}
                />
                <SettingRow
                  title="Weekly marketing digest"
                  description="Share campaign summary, conversion shifts, and revenue highlights every Monday morning."
                  control={
                    <Switch checked={marketingDigest} onCheckedChange={setMarketingDigest} />
                  }
                />
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader
                icon={Shield}
                title="Security and approvals"
                description="Protect account access and enforce controls for sensitive operations."
              />
              <div className="mt-5">
                <SettingRow
                  title="Two-factor authentication"
                  description="Require a second factor for all admin logins."
                  control={<Switch checked={twoFactor} onCheckedChange={setTwoFactor} />}
                />
                <SettingRow
                  title="Audit log retention"
                  description="Retain user action history for 180 days across settings, orders, and catalog changes."
                  control={<Switch checked={auditLog} onCheckedChange={setAuditLog} />}
                />
                <SettingRow
                  title="Return approval workflow"
                  description="Require supervisor sign-off before refund release on returns above threshold."
                  control={<Switch checked={returnApproval} onCheckedChange={setReturnApproval} />}
                />
                <SettingRow
                  title="International orders"
                  description="Allow order intake from international shipping zones and customs-enabled carriers."
                  control={
                    <Switch
                      checked={internationalOrders}
                      onCheckedChange={setInternationalOrders}
                    />
                  }
                />
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="p-5">
              <SectionHeader
                icon={CreditCard}
                title="Plan and billing"
                description="Commercial settings for the current workspace."
              />
              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-border bg-surface-muted/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[12.5px] font-medium">Growth plan</div>
                      <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                        Monthly billing with advanced analytics and role controls
                      </div>
                    </div>
                    <span className="rounded-full bg-success/10 px-2 py-1 text-[11px] font-medium text-success">
                      Active
                    </span>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className="text-[22px] font-semibold num">{formatCurrency(2499)}</div>
                      <div className="text-[11.5px] text-muted-foreground">per month</div>
                    </div>
                    <Button variant="outline">Manage plan</Button>
                  </div>
                </div>
                <div className="space-y-3 text-[12px]">
                  {[
                    "Next invoice on 01 Aug 2026",
                    "Billing contact: finance@orynticlabs.com",
                    "Auto-charge via corporate Visa ending in 4821",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-success" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader
                icon={Users}
                title="Team access"
                description="Users currently holding privileged workspace roles."
              />
              <div className="mt-5 space-y-3">
                {[
                  {
                    name: "Tushar Gupta",
                    role: "Owner",
                    meta: "Full access to billing, security, and catalog operations",
                    icon: Mail,
                  },
                  {
                    name: "Ritika Sharma",
                    role: "Operations Admin",
                    meta: "Orders, warehouse flows, dispatch, and refunds",
                    icon: Globe,
                  },
                  {
                    name: "Aditya Mehra",
                    role: "Security Reviewer",
                    meta: "Fraud review queue and audit approvals",
                    icon: Smartphone,
                  },
                ].map((member) => {
                  const Icon = member.icon;
                  return (
                    <div
                      key={member.name}
                      className="rounded-lg border border-border bg-surface-muted/40 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-background">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[12.5px] font-medium">{member.name}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] text-muted-foreground">
                              {member.role}
                            </span>
                          </div>
                          <div className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                            {member.meta}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" className="w-full">
                  Invite teammate
                </Button>
              </div>
            </Card>

            <Card className="border-destructive/30 p-5">
              <SectionHeader
                icon={Lock}
                title="Danger zone"
                description="High-impact actions with irreversible consequences."
              />
              <div className="mt-5 space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <div>
                  <div className="text-[12.5px] font-medium">Freeze storefront intake</div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    Temporarily stop new order creation while still allowing staff access.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline">Export workspace data</Button>
                  <Button variant="destructive">Disable intake</Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
