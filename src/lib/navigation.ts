import type { NavItem } from '../components/layout/BottomNav';

export const CUSTOMER_NAV: NavItem[] = [
  { to: '/', icon: 'home', label: 'Home', match: ['/'] },
  { to: '/orders', icon: 'package', label: 'Orders', match: ['/orders'] },
  { to: '/cart', icon: 'cart', label: 'Cart', match: ['/cart'] },
  { to: '/profile', icon: 'user', label: 'Profile', match: ['/profile'] },
];

export const SELLER_NAV: NavItem[] = [
  { to: '/seller', icon: 'chart', label: 'Dashboard', match: ['/seller'] },
  { to: '/seller/listings', icon: 'tag', label: 'Listings', match: ['/seller/listings'] },
  { to: '/seller/orders', icon: 'package', label: 'Orders', match: ['/seller/orders'] },
  { to: '/seller/payouts', icon: 'wallet', label: 'Payouts', match: ['/seller/payouts'] },
];
