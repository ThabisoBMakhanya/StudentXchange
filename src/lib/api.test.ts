import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getListings, placeOrder } from './api';

describe('getListings', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 'listing-1',
            title: 'Laptop',
            type: 'PHYSICAL',
            status: 'ACTIVE',
            price: 250,
            sellerId: 'seller-1',
          },
        ],
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends uppercase listing type filters to the backend', async () => {
    const listings = await getListings({ type: 'service', categoryId: 'category-2', search: 'repair' });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('type=SERVICE&categoryId=category-2&search=repair'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
    expect(listings[0].type).toBe('physical');
  });
});

describe('placeOrder', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'order-123',
          listingId: 'listing-1',
          listingTitle: 'Laptop',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          quantity: 2,
          unitPrice: 250,
          total: 500,
          commission: 50,
          paymentMethod: 'MTN_MOMO',
          escrowStatus: 'HELD',
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends only the server-safe order payload and not buyerId', async () => {
    await placeOrder({
      listingId: 'listing-1',
      quantity: 2,
      paymentMethod: 'mtn_momo',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/orders'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          listingId: 'listing-1',
          quantity: 2,
          paymentMethod: 'MTN_MOMO',
        }),
      }),
    );
  });
});
