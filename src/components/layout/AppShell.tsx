import type { ReactNode } from 'react';
import { BottomNav, type NavItem } from './BottomNav';
import { SellerModeBar } from './SellerModeBar';

/**
 * Mobile-first app shell: centered max-w-lg column, header slot,
 * scrollable content, and a fixed bottom navigation bar.
 */
export function AppShell({
  children,
  nav,
  hideNav = false,
  sellerModeControls = false,
}: {
  children: ReactNode;
  nav?: NavItem[];
  hideNav?: boolean;
  sellerModeControls?: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col rounded-none border-x border-surface-border bg-white/75 shadow-[0_30px_80px_-44px_rgba(37,99,235,0.38)] backdrop-blur-sm md:my-3 md:rounded-[28px] md:border">
      <div className="flex-1">
        {sellerModeControls && <SellerModeBar />}
        {children}
      </div>
      {!hideNav && nav && <BottomNav items={nav} />}
      {!hideNav && nav && <div className="h-16" />}
    </div>
  );
}
