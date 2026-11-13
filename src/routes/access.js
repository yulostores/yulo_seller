// Who may open which screen — one pure module, used by the route guard, the navigation and the
// tests. The server enforces every rule again on every call; this only decides what the portal
// shows, so a person never lands on a screen whose every request would be refused.
//
//   seller not approved (pending / rejected)  → status, onboarding and the agreement
//   seller suspended                          → the status screen only
//   approved, employee                        → Redeem Coupon and their own account only
//   approved, owner / manager                 → everything in the sidebar

import {
  LayoutDashboard,
  BarChart3,
  Ticket,
  Tag,
  CreditCard,
  MessageSquareText,
  FileSignature,
  Store,
  UserRound,
} from "lucide-react";

export const PATHS = {
  login: "/login",
  signup: "/signup",
  status: "/status",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  reports: "/reports",
  redeem: "/redeem",
  offers: "/offers",
  plans: "/plans",
  reminders: "/reminders",
  agreement: "/agreement",
  profile: "/profile",
  account: "/account",
};

// The full sidebar, in order, for owners and managers.
export const NAV_ITEMS = [
  { path: PATHS.dashboard, label: "Dashboard", icon: LayoutDashboard },
  { path: PATHS.redeem, label: "Redeem Coupon", icon: Ticket },
  { path: PATHS.reports, label: "Reports", icon: BarChart3 },
  { path: PATHS.offers, label: "Offers", icon: Tag },
  { path: PATHS.plans, label: "Plans", icon: CreditCard },
  { path: PATHS.reminders, label: "Reminder SMS", icon: MessageSquareText },
  { path: PATHS.agreement, label: "Agreement", icon: FileSignature },
  { path: PATHS.profile, label: "Profile", icon: Store },
];

const EMPLOYEE_NAV = [
  { path: PATHS.redeem, label: "Redeem Coupon", icon: Ticket },
  { path: PATHS.account, label: "My account", icon: UserRound },
];

export const PUBLIC_PATHS = [PATHS.login, PATHS.signup];

/** What kind of access a session has: 'anonymous' | 'unapproved' | 'suspended' | 'employee' | 'full'. */
export function accessLevel(session) {
  if (!session?.user || !session?.seller) return "anonymous";
  const status = session.seller.status;
  if (status === "suspended") return "suspended";
  if (status !== "active") return "unapproved"; // pending, rejected
  return session.user.role === "employee" ? "employee" : "full";
}

const ALLOWED = {
  anonymous: PUBLIC_PATHS,
  // The agreement can be read (and accepted by the owner) while the application is in review.
  unapproved: [PATHS.status, PATHS.onboarding, PATHS.agreement],
  suspended: [PATHS.status],
  employee: [PATHS.redeem, PATHS.account],
  full: [...NAV_ITEMS.map((n) => n.path), PATHS.account],
};

const HOME = {
  anonymous: PATHS.login,
  unapproved: PATHS.status,
  suspended: PATHS.status,
  employee: PATHS.redeem,
  full: PATHS.dashboard,
};

/** Where this session starts (and where it is sent from a screen it may not open). */
export function homeFor(session) {
  return HOME[accessLevel(session)];
}

/** The screens this session may open. */
export function allowedPaths(session) {
  return ALLOWED[accessLevel(session)];
}

/** Whether `pathname` (or a screen under it, e.g. /reports/coupons) may be opened. */
export function canVisit(session, pathname) {
  return allowedPaths(session).some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** The navigation for this session (empty when there is no app shell). */
export function navFor(session) {
  const level = accessLevel(session);
  if (level === "full") return NAV_ITEMS;
  if (level === "employee") return EMPLOYEE_NAV;
  return [];
}

export const ROLE_LABELS = {
  owner: "Owner",
  manager: "Manager",
  employee: "Employee",
};
