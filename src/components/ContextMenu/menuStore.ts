import { create } from 'zustand';

export type MenuItem =
  | '-'
  | { label: string; action(): void; shortcut?: string; danger?: boolean; disabled?: boolean };

interface MenuState {
  menu: { x: number; y: number; items: MenuItem[] } | null;
  open(x: number, y: number, items: MenuItem[]): void;
  close(): void;
}

export const useMenu = create<MenuState>()((set) => ({
  menu: null,
  open: (x, y, items) => set({ menu: { x, y, items } }),
  close: () => set({ menu: null }),
}));
