export const ROUTES = {
  login: "/auth/login",
  selectOutlet: "/select-outlet",
  accessPending: "/access-pending",
  crew: "/crew",
  crewPos: "/crew/pos",
  manager: "/manager/dashboard",
  owner: "/owner/dashboard",
};

const ROLE_ROUTES = {
  CREW: ROUTES.crew,
  MANAGER: ROUTES.manager,
  OWNER: ROUTES.owner,
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
  return pathname === landingRoute;
}
