/**
 * Shared storefront helpers for loading settings safely in editor vs live site.
 */
import { window as siteWindow } from '@wix/site-window';
import { getSettings } from '../backend/settings.web';
import { getPlanStatus } from '../backend/billing.web';
import type { AppSettings } from '../types';
import { defaultSettings } from './whatsapp';

export type StorefrontViewMode = 'Site' | 'Preview' | 'Editor' | string;

export type StorefrontRuntime = {
  settings: AppSettings;
  isPaid: boolean;
  /** Wix view mode when available (Site / Preview / Editor). */
  viewMode: StorefrontViewMode;
};

export async function getViewMode(): Promise<StorefrontViewMode> {
  try {
    return await siteWindow.viewMode();
  } catch {
    return 'Site';
  }
}

/** True when APIs + settings should load (live or Preview). */
export async function isStorefrontRuntime(): Promise<boolean> {
  const mode = await getViewMode();
  return mode === 'Site' || mode === 'Preview';
}

export async function loadStorefrontSettings(): Promise<AppSettings> {
  const runtime = await loadStorefrontRuntime();
  return runtime.settings;
}

/** Settings plus paid-plan flag. Unpaid sites hide the WhatsApp button. */
export async function loadStorefrontRuntime(): Promise<StorefrontRuntime> {
  const viewMode = await getViewMode();

  // Editor canvas: APIs are often sandboxed — still attempt load; callers show a placeholder if unpaid/empty.
  if (viewMode === 'Editor') {
    try {
      const [settings, plan] = await Promise.all([getSettings(), getPlanStatus()]);
      return {
        settings,
        isPaid: Boolean(plan?.isPaid),
        viewMode,
      };
    } catch {
      return { settings: defaultSettings(), isPaid: false, viewMode };
    }
  }

  try {
    const [settings, plan] = await Promise.all([getSettings(), getPlanStatus()]);
    return {
      settings,
      isPaid: Boolean(plan?.isPaid),
      viewMode,
    };
  } catch {
    return { settings: defaultSettings(), isPaid: false, viewMode };
  }
}

/** Merchant-only hint in Preview when the plugin is present but not configured. */
export function shouldShowSetupHint(runtime: {
  isPaid: boolean;
  viewMode: StorefrontViewMode;
  settings: AppSettings;
}): boolean {
  return (
    runtime.isPaid &&
    runtime.viewMode === 'Preview' &&
    !runtime.settings.whatsappNumber?.trim()
  );
}

export function openWhatsApp(url: string): void {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    // Popup blocked — navigate current tab as fallback.
    window.location.href = url;
  }
}
