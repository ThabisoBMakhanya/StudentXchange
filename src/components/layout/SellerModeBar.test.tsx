import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SellerModeBar } from './SellerModeBar';
import { useAuthStore } from '../../stores/authStore';
import { useRoleStore } from '../../stores/roleStore';

describe('SellerModeBar', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null });
    useRoleStore.setState({
      mode: 'seller',
      activeUserId: 'user-1',
      preferences: { 'user-1': 'seller' },
    });
  });

  it('logs the user out and clears the active role when they sign out', () => {
    const logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout');
    const clearActiveUserSpy = vi.spyOn(useRoleStore.getState(), 'clearActiveUser');

    render(
      <MemoryRouter initialEntries={['/seller']}>
        <Routes>
          <Route path="/seller" element={<SellerModeBar />} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(clearActiveUserSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
});
