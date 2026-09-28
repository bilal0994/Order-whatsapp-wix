/**
 * Settings web methods — call from dashboard and site plugins:
 *
 * import { getSettings, saveSettings, getStorageHealth } from 'backend/settings.web';
 */
import { webMethod, Permissions } from '@wix/web-methods';
import type {
  AppSettings,
  ButtonPosition,
  ProductVisibility,
  SaveSettingsResult,
  StorageHealth,
} from '../types';
import { isValidWhatsAppNumber } from '../shared/whatsapp';
import {
  DEFAULT_FORM_SUBMIT_TEXT,
  DEFAULT_FORM_TITLE,
  DEFAULT_MESSAGE_TEMPLATE,
  normalizeFormSettings,
} from '../shared/formConfig';
import { extractErrorMessage } from '../shared/errorMessage';
import {
  ensureStorageReady,
  getStorageHealth as loadStorageHealth,
  loadSettings,
  persistSettings,
} from './settings-store';
import { assertPaidPlan } from './billing';

function normalizeVisibility(value: unknown): ProductVisibility {
  return value === 'selected' ? 'selected' : 'all';
}

function normalizeButtonPosition(value: unknown): ButtonPosition {
  return value === 'before-add-to-cart' ? 'before-add-to-cart' : 'after-add-to-cart';
}

function normalizeProductIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter(Boolean))];
}

export const getSettings = webMethod(
  Permissions.Anyone,
  async (): Promise<AppSettings> => {
    return loadSettings();
  }
);

export const getStorageHealth = webMethod(
  Permissions.Admin,
  async (): Promise<StorageHealth> => {
    return loadStorageHealth();
  }
);

/**
 * Dashboard load / Retry: recreate missing `@…/settings` (and backups) for this
 * site via elevated Data Collections API — heals install-time CMS race.
 */
export const ensureStorage = webMethod(
  Permissions.Admin,
  async (): Promise<StorageHealth> => {
    return ensureStorageReady();
  }
);

export const saveSettings = webMethod(
  Permissions.Admin,
  async (settings: AppSettings): Promise<SaveSettingsResult> => {
    if (!settings) {
      return { ok: false, error: 'Settings payload is required.', debug: {} };
    }

    try {
      await assertPaidPlan();
    } catch (error) {
      return {
        ok: false,
        error: extractErrorMessage(error) || 'Upgrade required.',
        debug: { raw: extractErrorMessage(error).slice(0, 300) },
      };
    }

    const whatsappNumber = (settings.whatsappNumber || '').trim();
    if (settings.enabled && !isValidWhatsAppNumber(whatsappNumber)) {
      return {
        ok: false,
        error:
          'Enter a valid WhatsApp number with country code (8–15 digits).',
        debug: {},
      };
    }

    const buttonText = (settings.buttonText || '').trim();
    if (!buttonText) {
      return { ok: false, error: 'Button text is required.', debug: {} };
    }

    const buttonColor = (settings.buttonColor || '').trim();
    if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(buttonColor)) {
      return {
        ok: false,
        error: 'Button color must be a valid hex color (e.g. #25D366).',
        debug: {},
      };
    }

    const productVisibility = normalizeVisibility(settings.productVisibility);
    const selectedProductIds = normalizeProductIds(settings.selectedProductIds);
    const buttonPosition = normalizeButtonPosition(settings.buttonPosition);
    const hideAddToCart = Boolean(settings.hideAddToCart);
    const showOnProductPages = settings.showOnProductPages !== false;
    const showOnCart = settings.showOnCart !== false;
    const form = normalizeFormSettings(settings);

    if (productVisibility === 'selected' && selectedProductIds.length === 0) {
      return {
        ok: false,
        error: 'Select at least one product, or choose “All products”.',
        debug: {},
      };
    }

    if (!form.formFields.length) {
      return {
        ok: false,
        error: 'Add at least one form field in WhatsApp form settings.',
        debug: {},
      };
    }

    try {
      const saved = await persistSettings({
        whatsappNumber,
        buttonText,
        buttonColor,
        enabled: Boolean(settings.enabled),
        defaultOrderStatus: settings.defaultOrderStatus || 'NOT_PAID',
        productVisibility,
        selectedProductIds,
        buttonPosition,
        hideAddToCart,
        showOnProductPages,
        showOnCart,
        formTitle: form.formTitle || DEFAULT_FORM_TITLE,
        formSubmitText: form.formSubmitText || DEFAULT_FORM_SUBMIT_TEXT,
        formFields: form.formFields,
        messageTemplate: form.messageTemplate || DEFAULT_MESSAGE_TEMPLATE,
      });
      return { ok: true, settings: saved };
    } catch (error) {
      const raw = extractErrorMessage(error);
      const dbgIdx = raw.indexOf('|DBG|');
      const head = dbgIdx >= 0 ? raw.slice(0, dbgIdx).trim() : raw;
      let steps: unknown[] | undefined;
      let skipPrimary: boolean | undefined;
      let health:
        | {
            ready: boolean;
            primaryOk: boolean;
            legacyOk: boolean;
            backupOk?: boolean;
            cmsMissing: boolean;
          }
        | undefined;
      if (dbgIdx >= 0) {
        try {
          const parsed = JSON.parse(raw.slice(dbgIdx + 5)) as {
            steps?: unknown[];
            skipPrimary?: boolean;
            health?: {
              ready: boolean;
              p: boolean;
              l: boolean;
              b?: boolean;
              cms: boolean;
            };
          };
          steps = parsed.steps;
          skipPrimary = parsed.skipPrimary;
          if (parsed.health) {
            health = {
              ready: parsed.health.ready,
              primaryOk: parsed.health.p,
              legacyOk: parsed.health.l,
              backupOk: parsed.health.b,
              cmsMissing: parsed.health.cms,
            };
          }
        } catch {
          // ignore parse errors
        }
      }
      return {
        ok: false,
        error: head || 'Failed to save settings.',
        debug: {
          raw: raw.slice(0, 800),
          steps,
          health,
          skipPrimary,
        },
      };
    }
  }
);
