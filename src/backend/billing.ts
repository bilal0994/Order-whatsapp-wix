import { appInstances } from '@wix/app-management';
import { auth } from '@wix/essentials';
import { APP_ID } from '../consts';
import { hasAppOwnerUnlock } from '../shared/appOwnerAccess';
import type { PlanStatus } from '../types';

export const UNPAID_PLAN_ERROR =
  'Upgrade to a paid plan to use Order on WhatsApp.';

const unpaidStatus = (instanceId = '', siteId = ''): PlanStatus => ({
  isFree: true,
  isPaid: false,
  instanceId,
  siteId: siteId || undefined,
  upgradeUrl: instanceId
    ? `https://www.wix.com/apps/upgrade/${APP_ID}?appInstanceId=${instanceId}`
    : `https://www.wix.com/apps/upgrade/${APP_ID}`,
});

const paidStatus = (instanceId: string, siteId = ''): PlanStatus => ({
  isFree: false,
  isPaid: true,
  instanceId,
  siteId: siteId || undefined,
  upgradeUrl: `https://www.wix.com/apps/upgrade/${APP_ID}?appInstanceId=${instanceId}`,
});

export async function getPlanStatus(): Promise<PlanStatus> {
  try {
    // Web methods run with visitor/member tokens; elevate so Manage Your App
    // can read billing (isFree / packageName) correctly.
    const elevatedGetAppInstance = auth.elevate(appInstances.getAppInstance);
    const response = await elevatedGetAppInstance();
    const instanceId = response.instance?.instanceId || '';
    const isFree = response.instance?.isFree !== false;
    const siteId = response.site?.siteId || '';
    const siteDisplayName = response.site?.siteDisplayName || '';

    // App owner: unlock on Wix Dev Sites / allowlisted sites without Upgrade.
    if (hasAppOwnerUnlock(siteDisplayName, siteId)) {
      return paidStatus(instanceId, siteId);
    }

    if (isFree) {
      return unpaidStatus(instanceId, siteId);
    }

    return paidStatus(instanceId, siteId);
  } catch {
    // Fail closed: do not unlock the app if billing cannot be verified.
    return unpaidStatus();
  }
}

export async function assertPaidPlan(): Promise<PlanStatus> {
  const plan = await getPlanStatus();
  if (!plan.isPaid) {
    throw new Error(UNPAID_PLAN_ERROR);
  }
  return plan;
}
