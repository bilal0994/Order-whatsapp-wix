import { APP_OWNER_UNLOCK_SITE_IDS } from '../consts';

/** Wix CLI development sites are usually named "Dev Sitex…". */
const DEV_SITE_NAME = /^dev\s+site/i;

/**
 * True for app-owner test installs (CLI Dev Sites / allowlisted site IDs).
 * Merchants on normal sites still need a paid plan.
 */
export function hasAppOwnerUnlock(
  siteDisplayName?: string | null,
  siteId?: string | null
): boolean {
  if (siteId && APP_OWNER_UNLOCK_SITE_IDS.includes(siteId)) {
    return true;
  }
  const name = (siteDisplayName || '').trim();
  return name.length > 0 && DEV_SITE_NAME.test(name);
}
