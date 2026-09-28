/**
 * Plan status for dashboard + storefront plugins.
 *
 * import { getPlanStatus } from 'backend/billing.web';
 */
import { webMethod, Permissions } from '@wix/web-methods';
import type { PlanStatus } from '../types';
import { getPlanStatus as loadPlanStatus } from './billing';

export const getPlanStatus = webMethod(
  Permissions.Anyone,
  async (): Promise<PlanStatus> => {
    return loadPlanStatus();
  }
);
