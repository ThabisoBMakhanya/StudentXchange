// ─── Core domain types for StudentXchange ───────────────────────────────────

export type MarketplaceRole = 'customer' | 'seller';
export type UserRole = MarketplaceRole | 'admin';
export type Portal = 'marketplace' | 'admin';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  university: string;
  roles: UserRole[];
  kycStatus: KycStatus;
  suspended: boolean;
  banned: boolean;
  createdAt: string;
}

export type KycStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

export type ListingType = 'physical' | 'service';

export interface Category {
  id: string;
  type: ListingType;
  name: string;
  slug: string;
  description: string;
  icon: string; // key into icon map
  parentId: string | null;
  active: boolean;
  sortOrder: number;
}

export interface Listing {
  id: string;
  sellerId: string;
  sellerName: string;
  type: ListingType;
  categoryId: string;
  title: string;
  description: string;
  price: number; // SZL
  currency: 'SZL';
  images: string[]; // gradient keys for placeholder art
  // physical
  stock?: number;
  condition?: 'new' | 'like_new' | 'good' | 'fair';
  // service
  durationMinutes?: number;
  availabilitySlots?: string[];
  location: string;
  escrowStatus: EscrowStatus;
  status: 'active' | 'paused' | 'sold_out';
  createdAt: string;
}

export type EscrowStatus =
  | 'pending_payment'
  | 'held'
  | 'withheld_by_admin'
  | 'released'
  | 'refunded'
  | 'split'
  | 'disputed';

export type PaymentMethod = 'dpo_pay' | 'mtn_momo';

export interface Order {
  id: string;
  listingId: string;
  listingTitle: string;
  listingType: ListingType;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  quantity: number;
  unitPrice: number;
  total: number; // SZL
  commission: number; // SZL, kept by platform
  paymentMethod: PaymentMethod;
  escrowStatus: EscrowStatus;
  trackingCode?: string;
  shippedAt?: string;
  deliveredAt?: string;
  confirmedAt?: string;
  withheldAt?: string;
  withheldReason?: string;
  createdAt: string;
}

export interface CartItem {
  listingId: string;
  quantity: number;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: 'order' | 'user' | 'listing' | 'category' | 'payout' | 'kyc' | 'settings';
  targetId: string;
  detail: string;
  createdAt: string;
}

export interface Payout {
  id: string;
  sellerId: string;
  sellerName: string;
  orderId: string;
  amount: number; // SZL after commission
  status: 'pending' | 'processing' | 'paid' | 'failed';
  createdAt: string;
}

export interface Dispute {
  id: string;
  orderId: string;
  raisedById: string;
  raisedByName: string;
  reason: string;
  details: string;
  status: 'open' | 'resolved_buyer' | 'resolved_seller' | 'split' | 'closed';
  resolutionNote?: string;
  createdAt: string;
}

export interface AdminKpi {
  totalUsers: number;
  totalSellers: number;
  totalListings: number;
  activeListings: number;
  totalOrders: number;
  escrowBalance: number; // SZL held
  withheldBalance: number; // SZL frozen by admin
  revenue: number; // SZL commission earned
  pendingKyc: number;
  openDisputes: number;
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  university: string;
  roles: UserRole[];
  kycStatus: KycStatus;
  status: 'active' | 'suspended' | 'banned';
  joinedAt: string;
  totalOrders: number;
  totalSpent: number;
}

export interface AdminMfaChallenge {
  userId: string;
  expiresAt: number;
}

export type AdminOtpChannel = 'sms' | 'email';
