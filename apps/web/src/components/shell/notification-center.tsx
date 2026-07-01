"use client";

import type { NotificationResource } from "@tournament/api-client";
import { Bell, CheckCheck, Inbox } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "@/features/notifications/use-notifications";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function NotificationRow({ n }: { n: NotificationResource }) {
  const markRead = useMarkNotificationRead();
  const unread = n.status !== "read";
  return (
    <button
      type="button"
      onClick={() => unread && markRead.mutate(n.id)}
      className="hover:bg-muted flex w-full items-start gap-3 px-4 py-3 text-left transition-colors"
    >
      <span
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          unread ? "bg-candy" : "bg-transparent",
        )}
        aria-hidden
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{n.title ?? n.type}</span>
        {n.body ? <span className="text-muted-foreground text-sm">{n.body}</span> : null}
        <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.16em]">
          {timeAgo(n.createdAt)}
        </span>
      </span>
    </button>
  );
}

export function NotificationCenter() {
  const { data: unread } = useUnreadCount();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useNotifications();
  const markAll = useMarkAllRead();

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const count = unread?.count ?? 0;

  return (
    <Popover>
      <PopoverTrigger
        className="border-ink bg-card hover:bg-muted focus-visible:border-candy shadow-sticker-xs relative flex h-9 w-9 items-center justify-center rounded-full border-2 outline-none transition-colors"
        aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
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
          {count > 0 ? (
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

        <ScrollArea className="max-h-[24rem]">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 border-0" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="You're all caught up"
              description="Match results and updates will show up here."
              className="py-10"
            />
          ) : (
            <div className="divide-border divide-y">
              {items.map((n) => (
                <NotificationRow key={n.id} n={n} />
              ))}
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
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
