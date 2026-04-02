export const INSTALLER_DESKTOP_ROUTE = '/installer';
export const INSTALLER_MOBILE_ROUTE = '/installer-mobile';

const INSTALLER_MOBILE_MEDIA_QUERY = '(max-width: 767px)';

const swapInstallerRouteRoot = (pathname: string, fromRoot: string, toRoot: string) => {
  if (pathname === fromRoot) {
    return toRoot;
  }

  if (pathname.startsWith(`${fromRoot}/`)) {
    return `${toRoot}${pathname.slice(fromRoot.length)}`;
  }

  return toRoot;
};

export const isInstallerPortalPath = (pathname: string) => {
  return (
    pathname === INSTALLER_DESKTOP_ROUTE ||
    pathname.startsWith(`${INSTALLER_DESKTOP_ROUTE}/`) ||
    pathname === INSTALLER_MOBILE_ROUTE ||
    pathname.startsWith(`${INSTALLER_MOBILE_ROUTE}/`)
  );
};

export const getInstallerPreferredRoute = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return INSTALLER_DESKTOP_ROUTE;
  }

  return window.matchMedia(INSTALLER_MOBILE_MEDIA_QUERY).matches
    ? INSTALLER_MOBILE_ROUTE
    : INSTALLER_DESKTOP_ROUTE;
};

export const getInstallerMobilePath = (pathname: string) => {
  return swapInstallerRouteRoot(pathname, INSTALLER_DESKTOP_ROUTE, INSTALLER_MOBILE_ROUTE);
};

export const getInstallerDesktopPath = (pathname: string) => {
  return swapInstallerRouteRoot(pathname, INSTALLER_MOBILE_ROUTE, INSTALLER_DESKTOP_ROUTE);
};