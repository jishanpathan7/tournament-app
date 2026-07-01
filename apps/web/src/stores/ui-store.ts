import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Global UI state — the narrow set of things that genuinely span the component tree
 * (the guideline's "real cross-tree need"): sidebar collapse (persisted), the ⌘K
 * command palette, and the mobile nav drawer. Server data lives in TanStack Query, not
 * here; form state lives in react-hook-form, not here.
 */
interface UiState {
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  mobileNavOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;
  setMobileNavOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      commandOpen: false,
      mobileNavOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
    }),
    {
      name: "tp.ui",
      // Only persist the durable preference; transient overlays reset on reload.
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) as UiState,
    },
  ),
);
