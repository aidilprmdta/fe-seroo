export const ROUTES = {
  login: "/auth/login",
  profile: "/profile",
  selectOutlet: "/select-outlet",
  accessPending: "/access-pending",
  crew: "/crew",
  crewPos: "/crew/pos",
  crewOrders: "/crew/orders",
  manager: "/manager/dashboard",
  owner: "/owner/dashboard",
  adminCatalog: "/admin/catalog",
  adminAccounts: "/admin/accounts",
  adminAudit: "/admin/audit",
  adminDashboard: "/admin/dashboard",
  adminOutlets: "/admin/outlets",
  notifications: "/notifications",
  inventory: "/inventory",
  waste: "/waste",
  stockRequests: "/stock-requests",
  expenses: "/expenses",
  reports: "/reports",
  closings: "/closings",
  forgotPassword: "/auth/bantuan-reset-password",
  changePassword: "/auth/ganti-password",
  cooldown: "/auth/cooldown",
  helpFaq: "/help-faq",
  outletMembers: "/owner/outlet-members",
};

const ROLE_ROUTES = {
  ADMIN_PUSAT: ROUTES.adminCatalog,
  OWNER_MITRA: ROUTES.owner,
  OWNER: ROUTES.owner,
  MANAGER: ROUTES.manager,
  CREW: ROUTES.crew,
};

function isValidMembership(membership) {
  return (
    membership &&
    typeof membership.outletId === "string" &&
    ROLE_ROUTES[membership.role]
  );
}

export function getInitialOutletContext(memberships) {
  if (!Array.isArray(memberships) || memberships.length === 0) {
    return { activeOutletId: null, activeRole: null };
  }

  if (memberships.length === 1 && isValidMembership(memberships[0])) {
    return {
      activeOutletId: memberships[0].outletId,
      activeRole: memberships[0].role,
    };
  }

  return { activeOutletId: null, activeRole: null };
}

export function resolveLandingRoute(memberships, context) {
  if (!Array.isArray(memberships) || memberships.length === 0) {
    return ROUTES.accessPending;
  }

  if (memberships.length === 1) {
    return isValidMembership(memberships[0])
      ? ROLE_ROUTES[memberships[0].role]
      : ROUTES.accessPending;
  }

  const selected = memberships.find(
    (membership) =>
      membership.outletId === context?.activeOutletId &&
      membership.role === context?.activeRole,
  );
  return selected ? ROLE_ROUTES[selected.role] : ROUTES.selectOutlet;
}

export function getSelectedMembership(memberships, outletId) {
  if (!Array.isArray(memberships)) {
    return null;
  }
  return (
    memberships.find(
      (membership) =>
        isValidMembership(membership) && membership.outletId === outletId,
    ) ?? null
  );
}

export function isAllowedRoute(pathname, memberships, context) {
  if (pathname === ROUTES.login) {
    return false;
  }
  if (
    pathname === ROUTES.profile ||
    pathname === ROUTES.changePassword ||
    pathname === ROUTES.helpFaq ||
    pathname === ROUTES.notifications
  ) {
    return true;
  }
  if (pathname === ROUTES.forgotPassword || pathname === ROUTES.cooldown) {
    return true;
  }

  const landingRoute = resolveLandingRoute(memberships, context);
  if (pathname === ROUTES.selectOutlet) {
    return Array.isArray(memberships) &&
      memberships.filter(isValidMembership).length > 1;
  }
  if (pathname === ROUTES.accessPending) {
    return landingRoute === ROUTES.accessPending;
  }
  if (pathname === ROUTES.crewPos) {
    return landingRoute === ROUTES.crew;
  }
  if (pathname === ROUTES.crewOrders) {
    const membership = getSelectedMembership(
      memberships,
      context?.activeOutletId,
    );
    return (
      (membership?.role === "CREW" || membership?.role === "MANAGER") &&
      membership.role === context?.activeRole
    );
  }
  if (pathname === ROUTES.inventory || pathname === ROUTES.waste) {
    const membership = getSelectedMembership(
      memberships,
      context?.activeOutletId,
    );
    return (
      membership?.role === "CREW" || membership?.role === "MANAGER"
    ) && membership.role === context?.activeRole;
  }
  if (pathname === ROUTES.stockRequests) {
    const membership = getSelectedMembership(
      memberships,
      context?.activeOutletId,
    );
    return (
      (membership?.role === "CREW" || membership?.role === "MANAGER") &&
      membership.role === context?.activeRole
    );
  }
  if (
    pathname === ROUTES.adminCatalog ||
    pathname === ROUTES.adminAccounts ||
    pathname === ROUTES.adminAudit ||
    pathname === ROUTES.adminDashboard ||
    pathname === ROUTES.adminOutlets
  ) {
    const membership =
      getSelectedMembership(memberships, context?.activeOutletId) ||
      memberships.find((m) => m.role === "ADMIN_PUSAT");
    return membership?.role === "ADMIN_PUSAT";
  }
  if (
    pathname === ROUTES.expenses ||
    pathname === ROUTES.reports ||
    pathname === ROUTES.closings ||
    pathname === ROUTES.outletMembers
  ) {
    const membership = getSelectedMembership(
      memberships,
      context?.activeOutletId,
    );
    return (
      (membership?.role === "MANAGER" ||
        membership?.role === "OWNER" ||
        membership?.role === "OWNER_MITRA" ||
        membership?.role === "ADMIN_PUSAT") &&
      membership.role === context?.activeRole
    );
  }
  return pathname === landingRoute;
}
