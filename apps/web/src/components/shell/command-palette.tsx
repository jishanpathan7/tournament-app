"use client";

import { LayoutDashboard, Search, Settings, Trophy, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useUiStore } from "@/stores/ui-store";

/**
 * ⌘K command palette. A functional navigation launcher for now — global entity search
 * (tournaments, participants, matches) lands with the search API. Open state lives in the
 * UI store so the topbar search field and the ⌘K shortcut share it.
 */
const NAV_COMMANDS = [
  { label: "Dashboard", href: "/console", icon: LayoutDashboard },
  { label: "Tournaments", href: "/console/tournaments", icon: Trophy },
  { label: "Staff", href: "/console/people", icon: Users },
  { label: "Settings", href: "/console/settings", icon: Settings },
];

export function CommandPalette() {
  const router = useRouter();
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key?.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        useUiStore.getState().toggleCommand();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search or jump to…" />
      <CommandList>
        <CommandEmpty>No results. Entity search arrives with the search API.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {NAV_COMMANDS.map((c) => (
            <CommandItem key={c.href} value={c.label} onSelect={() => go(c.href)}>
              <c.icon className="text-muted-foreground h-4 w-4" strokeWidth={2.25} />
              {c.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Search">
          <CommandItem disabled value="global-search-placeholder">
            <Search className="text-muted-foreground h-4 w-4" strokeWidth={2.25} />
            Global search — coming soon
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
