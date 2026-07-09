"use client";

import type { NotificationResource } from "@tournament/api-client";
import {
  AlertTriangle,
  BarChart2,
  Bell,
  CalendarX,
  CheckCheck,
  Inbox,
  Lock,
  Megaphone,
  Network,
  Radio,
  ShieldAlert,
  Swords,
  Trophy,
  UserX,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useActionRequired,
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
  useResolveNotification,
  useUnreadCount,
} from "@/features/notifications/use-notifications";
import { cn } from "@/lib/utils";

// Map icon strings (lucide kebab names) to components
const ICON_MAP: Record<string, LucideIcon> = {
  "alert-triangle": AlertTriangle,
  "bar-chart-2": BarChart2,
  bell: Bell,
  "calendar-x": CalendarX,
  lock: Lock,
  megaphone: Megaphone,
  network: Network,
  radio: Radio,
  "shield-alert": ShieldAlert,
  swords: Swords,
  trophy: Trophy,
  "user-x": UserX,
  "x-circle": XCircle,
};

function NotifIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Bell;
  return <Icon className={cn("h-4 w-4 shrink-0", className)} strokeWidth={2.25} />;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function ActionRequiredRow({ n }: { n: NotificationResource }) {
  const resolve = useResolveNotification();
  return (
    <div className="border-pink/40 bg-pink-tint/20 flex flex-col gap-2 border-l-4 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <NotifIcon name={n.icon} className="text-pink mt-0.5" />
          <span className="text-sm font-semibold leading-snug">{n.title ?? n.type}</span>
        </div>
        <span className="text-muted-foreground shrink-0 font-mono text-[10px] uppercase tracking-[0.14em]">
          {timeAgo(n.createdAt)}
        </span>
      </div>
      {n.body ? <p className="text-muted-foreground pl-6 text-sm">{n.body}</p> : null}
      <div className="flex items-center gap-2 pl-6">
        {n.ctaHref && n.ctaLabel ? (
          <Button asChild tone="candy" size="sm" className="h-7 px-3 text-xs">
            <Link href={n.ctaHref}>{n.ctaLabel}</Link>
          </Button>
        ) : null}
        <Button
          tone="ghost"
          size="sm"
          className="text-muted-foreground h-7 px-2 text-xs"
          disabled={resolve.isPending}
          onClick={() => resolve.mutate(n.id)}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function UpdateRow({ n }: { n: NotificationResource }) {
  const markRead = useMarkNotificationRead();
  const unread = n.status !== "read" && n.status !== "resolved";
  return (
    <button
      type="button"
      onClick={() => unread && markRead.mutate(n.id)}
      className="hover:bg-muted flex w-full items-start gap-3 px-4 py-3 text-left transition-colors"
    >
      <NotifIcon
        name={n.icon}
        className={cn("mt-0.5", unread ? "text-foreground" : "text-muted-foreground")}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-sm leading-snug", unread ? "font-semibold" : "font-normal")}>
          {n.title ?? n.type}
        </span>
        {n.body ? <span className="text-muted-foreground text-sm">{n.body}</span> : null}
        <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.16em]">
          {timeAgo(n.createdAt)}
        </span>
      </span>
      {unread ? (
        <span className="bg-candy mt-1.5 h-2 w-2 shrink-0 rounded-full" aria-hidden />
      ) : null}
    </button>
  );
}

export function NotificationCenter() {
  const { data: unreadData } = useUnreadCount();
  const { data: actionData, isLoading: actionLoading } = useActionRequired();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useNotifications();
  const markAll = useMarkAllRead();

  const actionItems = actionData ?? [];
  const updateItems = data?.pages.flatMap((p) => p.items) ?? [];
  const count = unreadData?.count ?? 0;
  const hasContent = actionItems.length > 0 || updateItems.length > 0;

  return (
    <Popover>
      <PopoverTrigger
        className="border-ink bg-card hover:bg-muted focus-visible:border-candy shadow-sticker-xs relative flex h-9 w-9 items-center justify-center rounded-full border-2 outline-none transition-colors"
        aria-label={`Notifications${count ? `, ${count} action required` : ""}`}
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2.25} />
        {count > 0 ? (
          <span className="bg-pink text-ink border-ink absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 px-1 font-mono text-[10px] font-bold">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="border-ink flex items-center justify-between border-b-2 px-4 py-3">
          <span className="text-2xs font-mono font-semibold uppercase tracking-[0.22em]">
            Notifications
          </span>
          {updateItems.some((n) => n.status !== "read") ? (
            <Button
              tone="ghost"
              size="sm"
              className="text-candy-dark h-7 gap-1.5 px-2 text-xs"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              <CheckCheck className="h-4 w-4" strokeWidth={2.5} />
              Mark all read
            </Button>
          ) : null}
        </div>

        <ScrollArea className="max-h-[28rem]">
          {actionLoading || isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 border-0" />
              ))}
            </div>
          ) : !hasContent ? (
            <EmptyState
              icon={Inbox}
              title="You're all caught up"
              description="Operational alerts and tournament updates will show up here."
              className="py-10"
            />
          ) : (
            <div>
              {actionItems.length > 0 ? (
                <div>
                  <div className="border-border border-b px-4 pb-1.5 pt-3">
                    <span className="text-pink text-2xs font-mono font-semibold uppercase tracking-[0.18em]">
                      Action Required
                    </span>
                  </div>
                  <div className="divide-border divide-y">
                    {actionItems.map((n) => (
                      <ActionRequiredRow key={n.id} n={n} />
                    ))}
                  </div>
                </div>
              ) : null}

              {updateItems.length > 0 ? (
                <div>
                  {actionItems.length > 0 ? (
                    <div className="border-border border-b px-4 pb-1.5 pt-3">
                      <span className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.18em]">
                        Updates
                      </span>
                    </div>
                  ) : null}
                  <div className="divide-border divide-y">
                    {updateItems.map((n) => (
                      <UpdateRow key={n.id} n={n} />
                    ))}
                  </div>
                  {hasNextPage ? (
                    <div className="p-3">
                      <Button
                        tone="paper"
                        size="sm"
                        className="w-full"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                      >
                        Load more
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
