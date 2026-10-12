import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MarketplaceRole, UserRole } from '../types';

interface RoleState {
  mode: MarketplaceRole;
  activeUserId: string | null;
  preferences: Record<string, MarketplaceRole>;
  setMode: (mode: MarketplaceRole) => void;
  setUserRoles: (userId: string, roles: UserRole[]) => void;
  clearActiveUser: () => void;
}

/**
 * Role switcher state — only meaningful for dual-role users.
 * Single-role users are pinned to their only role by the router.
 */
export const useRoleStore = create<RoleState>()(
  persist(
    (set) => ({
      mode: 'customer',
      activeUserId: null,
      preferences: {},
      setMode: (mode) => set((state) => {
        if (!state.activeUserId) {
          return { mode };
        }
        return {
          mode,
          preferences: { ...state.preferences, [state.activeUserId]: mode },
        };
      }),
      setUserRoles: (userId, roles) => set((state) => {
        const marketplaceRoles = roles.filter(
          (role): role is MarketplaceRole => role === 'customer' || role === 'seller',
        );
        const savedMode = state.preferences[userId];
        const mode = savedMode && marketplaceRoles.includes(savedMode)
          ? savedMode
          : marketplaceRoles.length === 1
            ? marketplaceRoles[0]
            : 'customer';

        return {
          mode,
          activeUserId: userId,
          preferences: { ...state.preferences, [userId]: mode },
        };
      }),
      clearActiveUser: () => set({ activeUserId: null }),
    }),
    { name: 'sx-role' },
  ),
);
