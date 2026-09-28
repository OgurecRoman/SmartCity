export const PORTAL_ROOT_ID = 'app-portal';

export function getPortalRoot(): HTMLElement {
  return document.getElementById(PORTAL_ROOT_ID) ?? document.body;
}
