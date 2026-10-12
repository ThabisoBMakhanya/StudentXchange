/**
 * API client — connects to the NestJS + Prisma + PostgreSQL backend.
 * Base URL defaults to http://localhost:3000/api (the NestJS server).
 * Swap VITE_API_URL in .env to point at a deployed backend.
 */
import type {
  AdminKpi,
  AuditLogEntry,
  Category,
  Dispute,
  KycStatus,
  Listing,
  Order,
  Payout,
  User,
  MarketplaceRole,
  UserRole,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

function getToken(): string | null {
  const raw = localStorage.getItem('sx-auth');
  if (!raw) return null;
  try {
    return JSON.parse(raw).state?.token ?? null;
  } catch {
    return null;
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

type AuthResponse = {
  user: Omit<User, 'roles' | 'kycStatus'> & { roles: string[]; kycStatus: string };
  token: string;
};

function normalizeAuthResponse(response: AuthResponse): { user: User; token: string } {
  return {
    ...response,
    user: {
      ...response.user,
      roles: response.user.roles.map((role) => role.toLowerCase() as UserRole),
      kycStatus: response.user.kycStatus.toLowerCase() as KycStatus,
    },
  };
}

export async function login(email: string, password: string): Promise<{ user: User; token: string }> {
  const response = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return normalizeAuthResponse(response);
}

export async function register(input: {
  fullName: string;
  email: string;
  phone: string;
  university: string;
  roles: MarketplaceRole[];
  password: string;
}): Promise<{ user: User; token: string }> {
  const response = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      roles: input.roles.map((role) => role.toUpperCase()),
    }),
  });
  return normalizeAuthResponse(response);
}

export async function enableMarketplaceRole(role: MarketplaceRole): Promise<User> {
  const response = await request<AuthResponse['user']>('/auth/roles', {
    method: 'POST',
    body: JSON.stringify({ role: role.toUpperCase() }),
  }, getToken());
  return {
    ...response,
    roles: response.roles.map((item) => item.toLowerCase() as UserRole),
    kycStatus: response.kycStatus.toLowerCase() as KycStatus,
  };
}

// ─── Listings ────────────────────────────────────────────────────────────────

export async function getListings(filters?: {
  type?: 'physical' | 'service';
  categoryId?: string;
  search?: string;
}): Promise<Listing[]> {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type.toUpperCase());
  if (filters?.categoryId) params.set('categoryId', filters.categoryId);
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();
  const listings = await request<unknown[]>(`/listings${qs ? `?${qs}` : ''}`);
  return listings.map(normalizeListing);
}

export async function getListing(id: string): Promise<Listing | undefined> {
  try {
    return normalizeListing(await request<unknown>(`/listings/${id}`));
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) {
      return undefined;
    }
    throw err;
  }
}

export async function createListing(
  sellerId: string,
  input: Partial<Listing> & { title: string; price: number; type: 'physical' | 'service' },
): Promise<Listing> {
  const payload = input as Partial<Listing> & {
    title: string;
    price: number;
    type: Listing['type'];
    condition?: Listing['condition'];
  };
  const listing = await request<unknown>('/listings', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      type: payload.type.toUpperCase(),
      condition: payload.condition?.toUpperCase(),
    }),
  }, getToken());
  return normalizeListing(listing);
}

export async function getSellerListings(sellerId: string): Promise<Listing[]> {
  const listings = await request<unknown[]>('/seller/listings', {}, getToken());
  return listings.map(normalizeListing);
}

// ─── Categories ──────────────────────────────────────────────────────────────

export async function getCategories(type?: 'physical' | 'service'): Promise<Category[]> {
  const qs = type ? `?type=${type.toUpperCase()}` : '';
  const categories = await request<Array<Omit<Category, 'type'> & { type: string }>>(`/categories${qs}`);
  return categories.map((category) => ({ ...category, type: category.type.toLowerCase() as Category['type'] }));
}

function normalizeListing(value: unknown): Listing {
  const listing = value as Partial<Listing> & {
    type?: string;
    status?: string;
    condition?: string | null;
    escrowStatus?: string;
  };
  return {
    ...listing,
    id: listing.id ?? '',
    sellerId: listing.sellerId ?? '',
    sellerName: listing.sellerName ?? '',
    type: (listing.type?.toLowerCase() ?? 'physical') as Listing['type'],
    categoryId: listing.categoryId ?? '',
    title: listing.title ?? '',
    description: listing.description ?? '',
    price: listing.price ?? 0,
    currency: 'SZL',
    images: listing.images ?? [],
    condition: listing.condition?.toLowerCase() as Listing['condition'],
    location: listing.location ?? '',
    escrowStatus: (listing.escrowStatus?.toLowerCase() ?? 'pending_payment') as Listing['escrowStatus'],
    status: (listing.status?.toLowerCase() ?? 'paused') as Listing['status'],
    createdAt: listing.createdAt ?? new Date().toISOString(),
  };
}

function normalizeOrder(value: unknown): Order {
  const raw = value as Record<string, any>;
  return {
    ...raw,
    listingTitle: raw.listing?.title ?? raw.listingTitle ?? '',
    listingType: String(raw.listing?.type ?? raw.listingType ?? '').toLowerCase(),
    buyerName: raw.buyer?.fullName ?? raw.buyerName ?? '',
    sellerName: raw.seller?.fullName ?? raw.sellerName ?? '',
    paymentMethod: String(raw.paymentMethod).toLowerCase(),
    escrowStatus: String(raw.escrowStatus).toLowerCase(),
    total: Number(raw.total),
    commission: Number(raw.commission),
    unitPrice: Number(raw.unitPrice),
  } as Order;
}

function normalizePayout(value: unknown): Payout {
  const raw = value as Record<string, any>;
  return {
    ...raw,
    sellerName: raw.seller?.fullName ?? raw.sellerName ?? '',
    amount: Number(raw.amount),
    status: String(raw.status).toLowerCase(),
  } as Payout;
}

function normalizeDispute(value: unknown): Dispute {
  const raw = value as Record<string, any>;
  return {
    ...raw,
    raisedByName: raw.raisedBy?.fullName ?? raw.raisedByName ?? '',
    status: String(raw.status).toLowerCase(),
  } as Dispute;
}

export async function saveCategory(
  actor: string,
  cat: Omit<Category, 'id'> & { id?: string },
): Promise<Category> {
  if (cat.id) {
    return request(`/admin/categories/${cat.id}`, {
      method: 'POST',
      body: JSON.stringify(cat),
    }, getToken());
  }
  return request('/admin/categories', {
    method: 'POST',
    body: JSON.stringify(cat),
  }, getToken());
}

export async function deleteCategory(actor: string, id: string): Promise<void> {
  await request(`/admin/categories/${id}/delete`, {
    method: 'POST',
  }, getToken());
}

// ─── Orders & escrow ─────────────────────────────────────────────────────────

export async function placeOrder(input: {
  listingId: string;
  quantity: number;
  paymentMethod: 'dpo_pay' | 'mtn_momo';
}): Promise<Order> {
  const order = await request<unknown>('/orders', {
    method: 'POST',
    body: JSON.stringify({ ...input, paymentMethod: input.paymentMethod.toUpperCase() }),
  }, getToken());
  return normalizeOrder(order);
}

export async function getOrdersForBuyer(buyerId: string): Promise<Order[]> {
  return (await request<unknown[]>('/orders/buyer', {}, getToken())).map(normalizeOrder);
}

export async function getOrdersForSeller(sellerId: string): Promise<Order[]> {
  return (await request<unknown[]>('/orders/seller', {}, getToken())).map(normalizeOrder);
}

export async function getAllOrders(): Promise<Order[]> {
  return (await request<unknown[]>('/admin/orders', {}, getToken())).map(normalizeOrder);
}

export async function getOrder(id: string): Promise<Order | undefined> {
  try {
    return normalizeOrder(await request(`/orders/${id}`, {}, getToken()));
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) {
      return undefined;
    }
    throw err;
  }
}

export async function markShipped(orderId: string): Promise<Order> {
  return normalizeOrder(await request(`/orders/${orderId}/ship`, { method: 'POST' }, getToken()));
}

export async function confirmReceipt(orderId: string): Promise<Order> {
  return normalizeOrder(await request(`/orders/${orderId}/confirm`, { method: 'POST' }, getToken()));
}

export async function raiseDispute(
  orderId: string,
  raisedById: string,
  reason: string,
  details: string,
): Promise<Dispute> {
  return request(`/orders/${orderId}/dispute`, {
    method: 'POST',
    body: JSON.stringify({ reason, details }),
  }, getToken());
}

// ─── Admin: users ────────────────────────────────────────────────────────────

export async function getAdminUsers(): Promise<User[]> {
  return request('/admin/users', {}, getToken());
}

export async function setUserStatus(
  actor: string,
  userId: string,
  status: 'active' | 'suspended' | 'banned',
): Promise<User> {
  return request(`/admin/users/${userId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  }, getToken());
}

// ─── Admin: KYC ──────────────────────────────────────────────────────────────

export async function setKycStatus(
  actor: string,
  userId: string,
  status: KycStatus,
  note?: string,
): Promise<User> {
  // Note: the backend uses submissionId; this is a simplified wrapper
  return request(`/admin/kyc/${userId}/review`, {
    method: 'POST',
    body: JSON.stringify({ status, note }),
  }, getToken());
}

// ─── Admin: escrow control panel ─────────────────────────────────────────────

export async function adminWithholdFunds(
  actor: string,
  orderId: string,
  reason: string,
): Promise<Order> {
  return request(`/admin/orders/${orderId}/withhold`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }, getToken());
}

export async function adminReleaseFunds(actor: string, orderId: string): Promise<Order> {
  return request(`/admin/orders/${orderId}/release`, { method: 'POST' }, getToken());
}

export async function adminRefundBuyer(actor: string, orderId: string): Promise<Order> {
  return request(`/admin/orders/${orderId}/refund`, { method: 'POST' }, getToken());
}

export async function adminSplitFunds(
  actor: string,
  orderId: string,
  buyerPercent: number,
): Promise<Order> {
  return request(`/admin/orders/${orderId}/split`, {
    method: 'POST',
    body: JSON.stringify({ buyerPercent }),
  }, getToken());
}

// ─── Admin: disputes ─────────────────────────────────────────────────────────

export async function getDisputes(): Promise<Dispute[]> {
  return (await request<unknown[]>('/admin/disputes', {}, getToken())).map(normalizeDispute);
}

export async function resolveDispute(
  actor: string,
  disputeId: string,
  resolution: Dispute['status'],
  note: string,
): Promise<Dispute> {
  return request(`/admin/disputes/${disputeId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ status: resolution.toUpperCase(), note }),
  }, getToken());
}

// ─── Admin: payouts ──────────────────────────────────────────────────────────

export async function getPayouts(): Promise<Payout[]> {
  return (await request<unknown[]>('/admin/payouts', {}, getToken())).map(normalizePayout);
}

export async function getSellerPayouts(): Promise<Payout[]> {
  return (await request<unknown[]>('/seller/payouts', {}, getToken())).map(normalizePayout);
}

export async function markPayoutPaid(actor: string, payoutId: string): Promise<Payout> {
  return request(`/admin/payouts/${payoutId}/paid`, { method: 'POST' }, getToken());
}

// ─── Admin: KPI + audit ──────────────────────────────────────────────────────

export async function getAdminKpi(): Promise<AdminKpi> {
  return request('/admin/kpis', {}, getToken());
}

export async function getAuditLog(): Promise<AuditLogEntry[]> {
  return request('/admin/audit', {}, getToken());
}
