import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Command,
  CreditCard,
  LogOut,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  User,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatCurrency } from "@/lib/utils";

const searchGroups = [
  {
    heading: "Navigate",
    items: [
      { label: "Overview", route: "/", icon: ShoppingBag, shortcut: "G O" },
      { label: "Orders", route: "/orders", icon: ShoppingBag, shortcut: "G R" },
      { label: "Settings", route: "/settings", icon: Settings, shortcut: "G S" },
    ],
  },
  {
    heading: "Recent entities",
    items: [
      { label: "Order #4108", route: "/orders", icon: CreditCard, shortcut: "O 1" },
      { label: "Refund review queue", route: "/orders", icon: Shield, shortcut: "Q R" },
      { label: "Billing settings", route: "/settings", icon: CreditCard, shortcut: "B I" },
    ],
  },
];

const notifications = [
  {
    title: "Payment review required",
    body: "Order #4108 is flagged for manual review before fulfillment.",
    time: "2m ago",
    tone: "bg-warning/10 text-warning",
  },
  {
    title: "Dispatch window closing",
    body: "Nine express orders still need labels before 16:00 pickup.",
    time: "12m ago",
    tone: "bg-info/10 text-info",
  },
  {
    title: "Refund approved",
    body: `Refund released for ${formatCurrency(512.4)} on order #4089.`,
    time: "27m ago",
    tone: "bg-success/10 text-success",
  },
];

type NotificationItem = (typeof notifications)[number];

export function Topbar({
  onToggle,
  section = "Overview",
  insightsOpen = false,
  onInsightsToggle,
}: {
  onToggle: () => void;
  section?: string;
  insightsOpen?: boolean;
  onInsightsToggle?: () => void;
}) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>(notifications);
  const [isBellActive, setIsBellActive] = useState(false);
  const unreadCount = notificationItems.length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setNotificationItems((current) =>
        [
          {
            title: "New high-value order",
            body: `Order #4112 was placed for ${formatCurrency(1284)} and is waiting for allocation.`,
            time: "now",
            tone: "bg-info/10 text-info",
          },
          ...current,
        ].slice(0, 4),
      );
      setIsBellActive(true);

      try {
        const audioContext = new window.AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(740, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.04, audioContext.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.35);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.35);
      } catch {
        // Ignore audio failures in browsers that block autoplay or audio context startup.
      }
    }, 4500);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!isBellActive) return;

    const timeoutId = window.setTimeout(() => {
      setIsBellActive(false);
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [isBellActive]);

  const navigate = (route: string) => {
    setSearchOpen(false);
    router.push(route);
  };

  const handleNotificationOpenChange = (open: boolean) => {
    if (open) {
      setIsBellActive(false);
    }
  };

  return (
    <>
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search pages, orders, queues, and settings..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {searchGroups.map((group, index) => (
            <div key={group.heading}>
              <CommandGroup heading={group.heading}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.label}
                      value={item.label}
                      onSelect={() => navigate(item.route)}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                      <CommandShortcut>{item.shortcut}</CommandShortcut>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {index < searchGroups.length - 1 ? <CommandSeparator /> : null}
            </div>
          ))}
        </CommandList>
      </CommandDialog>

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
            <span className="text-muted-foreground">OryCMS</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="font-medium">{section}</span>
          </div>

          {/* Search / Command */}
          <div className="flex-1 flex justify-center">
            <button
              onClick={() => setSearchOpen(true)}
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
            <button
              onClick={onInsightsToggle}
              title="AI Insights"
              className={cn(
                "grid h-8 w-8 place-items-center rounded-md transition-colors",
                insightsOpen
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Sparkles className="h-4 w-4" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="hidden sm:inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-[12.5px] font-medium text-foreground/80 transition-colors hover:border-border-strong hover:bg-accent/40">
                  <span className="relative flex h-4 w-4 items-center justify-center">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    <span className="absolute h-2 w-2 animate-ping rounded-full bg-success/70" />
                  </span>
                  Live Store
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Storefront status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Live on admin.orycms.in</DropdownMenuItem>
                <DropdownMenuItem>Sync catalog</DropdownMenuItem>
                <DropdownMenuItem>Open storefront logs</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu onOpenChange={handleNotificationOpenChange}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "relative grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                    isBellActive && "notification-bell-ring",
                  )}
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className={cn("w-[360px] p-0", isBellActive && "notification-panel-glow")}
              >
                <div className="border-b border-border px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[12.5px] font-semibold">Notifications</div>
                    <div className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] text-muted-foreground">
                      {unreadCount} new
                    </div>
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    Operations alerts, review tasks, and dispatch updates
                  </div>
                </div>
                <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
                  {notificationItems.slice(0, 4).map((notification) => (
                    <div
                      key={notification.title}
                      className="rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-accent/30"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 grid h-8 w-8 place-items-center rounded-md",
                            notification.tone,
                          )}
                        >
                          <Bell className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[12.5px] font-medium">{notification.title}</div>
                            <div className="text-[10.5px] text-muted-foreground">
                              {notification.time}
                            </div>
                          </div>
                          <div className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                            {notification.body}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border px-3 py-2">
                  <button
                    onClick={() => router.push("/settings")}
                    className="w-full rounded-md px-3 py-2 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    Manage notification preferences
                  </button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <button className="ml-1 hidden sm:inline-flex h-8 items-center gap-1.5 pl-2 pr-3 rounded-md bg-foreground text-background text-[12.5px] font-medium hover:opacity-90 transition-opacity">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Quick action
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 rounded-full">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarFallback className="bg-gradient-to-br from-chart-3 to-chart-4 text-[11px] font-semibold text-white">
                      OC
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="pb-2">
                  <div className="text-[12.5px] font-semibold">Tushar Gupta</div>
                  <div className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                    Owner · OryCMS by OrynticLabs
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <User className="h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings className="h-4 w-4" />
                  Workspace settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/orders")}>
                  <ShoppingBag className="h-4 w-4" />
                  Orders desk
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Shield className="h-4 w-4" />
                  Security log
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  );
}
