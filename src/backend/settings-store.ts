import { collections, items } from '@wix/data';
import { auth } from '@wix/essentials';
import {
  BACKUP_SETTINGS_COLLECTION_GUID,
  BACKUP_SETTINGS_COLLECTION_ID,
  LEGACY_SETTINGS_COLLECTION_ID,
  SETTINGS_COLLECTION_ID,
  SETTINGS_SINGLETON_KEY,
} from '../consts';
import type {
  AppSettings,
  ButtonPosition,
  ProductVisibility,
  StorageHealth,
} from '../types';
import { defaultSettings } from '../shared/whatsapp';
import { normalizeFormSettings, parseFormFields } from '../shared/formConfig';
import {
  extractErrorDebug,
  extractErrorMessage,
} from '../shared/errorMessage';

type SettingsRow = {
  _id?: string;
  singletonKey?: string;
  /** JSON blob used by OowSettings backup collection. */
  settingsJson?: string;
  whatsappNumber?: string;
  buttonText?: string;
  buttonColor?: string;
  enabled?: boolean;
  defaultOrderStatus?: AppSettings['defaultOrderStatus'];
  productVisibility?: string;
  selectedProductIds?: string | string[];
  selectedProducts?: string | string[];
  buttonPosition?: string;
  hideAddToCart?: boolean;
  showOnProductPages?: boolean;
  showOnCart?: boolean;
  formTitle?: string;
  formSubmitText?: string;
  formFields?: string | AppSettings['formFields'];
  messageTemplate?: string;
};

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function isSystemError(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  return (
    msg.includes('system error occurred') ||
    msg === '{}' ||
    msg === '{"message":"","details":{}}'
  );
}

function isMissingCollection(error: unknown): boolean {
  const msg = errorMessage(error);
  return msg.includes('WDE0025') || msg.toLowerCase().includes('does not exist');
}

function isCmsMissing(error: unknown): boolean {
  const msg = errorMessage(error);
  return msg.includes('WDE0110') || msg.includes('CMS app is not installed');
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parseProductIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean);
      }
    } catch {
      // fall through — treat as comma-separated
    }
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function parseVisibility(raw: unknown): ProductVisibility {
  return raw === 'selected' ? 'selected' : 'all';
}

function parseButtonPosition(raw: unknown): ButtonPosition {
  return raw === 'before-add-to-cart' ? 'before-add-to-cart' : 'after-add-to-cart';
}

function toAppSettings(row: SettingsRow | null): AppSettings {
  const defaults = defaultSettings();
  if (!row) return defaults;

  if (typeof row.settingsJson === 'string' && row.settingsJson.trim()) {
    try {
      const parsed = JSON.parse(row.settingsJson) as Partial<AppSettings>;
      const form = normalizeFormSettings(parsed);
      return {
        whatsappNumber: parsed.whatsappNumber ?? defaults.whatsappNumber,
        buttonText: parsed.buttonText || defaults.buttonText,
        buttonColor: parsed.buttonColor || defaults.buttonColor,
        enabled: parsed.enabled !== false,
        defaultOrderStatus: parsed.defaultOrderStatus || defaults.defaultOrderStatus,
        productVisibility: parseVisibility(parsed.productVisibility),
        selectedProductIds: Array.isArray(parsed.selectedProductIds)
          ? parsed.selectedProductIds.map(String).filter(Boolean)
          : defaults.selectedProductIds,
        buttonPosition: parseButtonPosition(parsed.buttonPosition),
        hideAddToCart: parsed.hideAddToCart === true,
        showOnProductPages: parsed.showOnProductPages !== false,
        showOnCart: parsed.showOnCart !== false,
        ...form,
      };
    } catch {
      // fall through to flat fields
    }
  }

  const fromSelected = parseProductIds(row.selectedProductIds);
  const selectedProductIds =
    fromSelected.length > 0 ? fromSelected : parseProductIds(row.selectedProducts);
  const form = normalizeFormSettings({
    formTitle: row.formTitle,
    formSubmitText: row.formSubmitText,
    formFields: parseFormFields(row.formFields),
    messageTemplate: row.messageTemplate,
  });
  return {
    whatsappNumber: row.whatsappNumber ?? defaults.whatsappNumber,
    buttonText: row.buttonText || defaults.buttonText,
    buttonColor: row.buttonColor || defaults.buttonColor,
    enabled: row.enabled !== false,
    defaultOrderStatus: row.defaultOrderStatus || defaults.defaultOrderStatus,
    productVisibility: parseVisibility(row.productVisibility),
    selectedProductIds,
    buttonPosition: parseButtonPosition(row.buttonPosition),
    hideAddToCart: row.hideAddToCart === true,
    showOnProductPages: row.showOnProductPages !== false,
    showOnCart: row.showOnCart !== false,
    ...form,
  };
}

function buildPayload(settings: AppSettings) {
  return {
    singletonKey: SETTINGS_SINGLETON_KEY,
    whatsappNumber: settings.whatsappNumber,
    buttonText: settings.buttonText,
    buttonColor: settings.buttonColor,
    enabled: settings.enabled,
    defaultOrderStatus: settings.defaultOrderStatus,
    productVisibility: settings.productVisibility,
    selectedProductIds: JSON.stringify(settings.selectedProductIds || []),
    buttonPosition: settings.buttonPosition,
    hideAddToCart: Boolean(settings.hideAddToCart),
    showOnProductPages: settings.showOnProductPages !== false,
    showOnCart: settings.showOnCart !== false,
    formTitle: settings.formTitle,
    formSubmitText: settings.formSubmitText,
    formFields: JSON.stringify(settings.formFields || []),
    messageTemplate: settings.messageTemplate,
  };
}

/** Minimal backup row — one JSON field avoids schema mismatches on merchant sites. */
function buildJsonBackupPayload(settings: AppSettings) {
  return {
    singletonKey: SETTINGS_SINGLETON_KEY,
    settingsJson: JSON.stringify(settings),
  };
}

function isOpaqueHandleError(error: unknown): boolean {
  return extractErrorMessage(error).includes('Unable to handle the request');
}

/** Last-resort legacy row when even selectedProducts is unknown. */
function buildLegacyCorePayload(settings: AppSettings) {
  return {
    singletonKey: SETTINGS_SINGLETON_KEY,
    whatsappNumber: settings.whatsappNumber,
    buttonText: settings.buttonText,
    buttonColor: settings.buttonColor,
    enabled: settings.enabled,
    defaultOrderStatus: settings.defaultOrderStatus,
    productVisibility: settings.productVisibility,
  };
}

async function querySettings(collectionId: string): Promise<SettingsRow | null> {
  const elevatedQuery = auth.elevate(items.query);
  const result = await elevatedQuery(collectionId)
    .eq('singletonKey', SETTINGS_SINGLETON_KEY)
    .limit(1)
    .find();

  const row = result.items?.[0] as SettingsRow | undefined;
  return row ?? null;
}

/**
 * Usability check via items.query (Read/Write Data Items).
 * getDataCollection (Manage Data Collections) often returns empty "System error"
 * even when the collection exists and is writable — do not rely on it alone.
 */
async function probeCollection(
  collectionId: string
): Promise<{ ok: boolean; cmsMissing: boolean; detail: string }> {
  try {
    await querySettings(collectionId);
    return { ok: true, cmsMissing: false, detail: '' };
  } catch (queryError) {
    if (isCmsMissing(queryError)) {
      return {
        ok: false,
        cmsMissing: true,
        detail: extractErrorMessage(queryError),
      };
    }
    if (!isMissingCollection(queryError) && !isSystemError(queryError)) {
      // Collection likely exists; query flaky (permissions / empty schema).
      // Confirm via Management API when possible.
      try {
        const elevatedGet = auth.elevate(collections.getDataCollection);
        await elevatedGet(collectionId);
        return { ok: true, cmsMissing: false, detail: 'exists-get' };
      } catch {
        // Fall through — treat as not ready with query detail.
      }
    }

    // Secondary: Management get (may system-error without Manage Data Collections).
    try {
      const elevatedGet = auth.elevate(collections.getDataCollection);
      await elevatedGet(collectionId);
      return { ok: true, cmsMissing: false, detail: 'exists-get' };
    } catch (getError) {
      if (isCmsMissing(getError)) {
        return {
          ok: false,
          cmsMissing: true,
          detail: extractErrorMessage(getError),
        };
      }
      const detail = [
        extractErrorMessage(queryError),
        extractErrorMessage(getError),
      ]
        .filter(Boolean)
        .join(' | ')
        .slice(0, 200);
      return { ok: false, cmsMissing: false, detail };
    }
  }
}

function rowHasSettingsJson(row: SettingsRow | null): boolean {
  return Boolean(row?.settingsJson && String(row.settingsJson).trim());
}

function rowHasFormFields(row: SettingsRow | null): boolean {
  if (!row) return false;
  if (rowHasSettingsJson(row)) {
    try {
      const parsed = JSON.parse(String(row.settingsJson)) as Partial<AppSettings>;
      return Array.isArray(parsed.formFields) && parsed.formFields.length > 0;
    } catch {
      return true; // blob present — prefer over empty primary
    }
  }
  if (typeof row.formFields === 'string') return row.formFields.trim().length > 2;
  return Array.isArray(row.formFields) && row.formFields.length > 0;
}

/**
 * Lean Save writes the full blob to OowSettings first, then returns.
 * Primary `@…/settings` is often stale / missing formFields after app updates.
 * Prefer any row that carries settingsJson (or formFields) so dashboard
 * renames reach the storefront.
 */
async function querySettingsWithFallback(): Promise<SettingsRow | null> {
  const candidates: SettingsRow[] = [];

  const tryQuery = async (collectionId: string) => {
    try {
      const row = await querySettings(collectionId);
      if (row) candidates.push(row);
    } catch (error) {
      if (
        !isMissingCollection(error) &&
        !isOpaqueHandleError(error) &&
        collectionId === SETTINGS_COLLECTION_ID
      ) {
        // Primary opaque errors used to abort entirely; keep scanning backups.
        if (!isSystemError(error)) throw error;
      }
    }
  };

  // Backup first — this is what lean Save actually updates.
  await tryQuery(BACKUP_SETTINGS_COLLECTION_ID);
  await tryQuery(BACKUP_SETTINGS_COLLECTION_GUID);
  await tryQuery(SETTINGS_COLLECTION_ID);
  await tryQuery(LEGACY_SETTINGS_COLLECTION_ID);

  if (!candidates.length) return null;

  const withForm = candidates.find(rowHasFormFields);
  if (withForm) return withForm;

  const withJson = candidates.find(rowHasSettingsJson);
  if (withJson) return withJson;

  return candidates[0];
}

function cleanPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** Stable singleton id so save() can upsert without a prior query hit. */
const SETTINGS_ITEM_ID = 'orderwhatsapp-settings-default';

/**
 * Schema for the app-owned `@…/settings` collection (matches Data Collections
 * extension). Recreated at runtime when install-time provisioning raced CMS.
 */
const PRIMARY_COLLECTION_FIELDS = [
  { key: 'singletonKey', type: 'TEXT' as const, displayName: 'Singleton Key' },
  { key: 'whatsappNumber', type: 'TEXT' as const, displayName: 'WhatsApp Number' },
  { key: 'buttonText', type: 'TEXT' as const, displayName: 'Button Text' },
  { key: 'buttonColor', type: 'TEXT' as const, displayName: 'Button Color' },
  { key: 'enabled', type: 'BOOLEAN' as const, displayName: 'Enabled' },
  {
    key: 'defaultOrderStatus',
    type: 'TEXT' as const,
    displayName: 'Default Order Status',
  },
  {
    key: 'productVisibility',
    type: 'TEXT' as const,
    displayName: 'Product Visibility',
  },
  {
    key: 'selectedProductIds',
    type: 'TEXT' as const,
    displayName: 'Selected Product IDs',
  },
  {
    key: 'buttonPosition',
    type: 'TEXT' as const,
    displayName: 'Button Position',
  },
  {
    key: 'hideAddToCart',
    type: 'BOOLEAN' as const,
    displayName: 'Hide Add to Cart',
  },
  {
    key: 'showOnProductPages',
    type: 'BOOLEAN' as const,
    displayName: 'Show on Product Pages',
  },
  {
    key: 'showOnCart',
    type: 'BOOLEAN' as const,
    displayName: 'Show on Cart',
  },
  {
    key: 'formTitle',
    type: 'TEXT' as const,
    displayName: 'Form Title',
  },
  {
    key: 'formSubmitText',
    type: 'TEXT' as const,
    displayName: 'Form Submit Text',
  },
  {
    key: 'formFields',
    type: 'TEXT' as const,
    displayName: 'Form Fields',
  },
  {
    key: 'messageTemplate',
    type: 'TEXT' as const,
    displayName: 'Message Template',
  },
];

/** Native CMS fields for sites where the app Data Collections extension never provisioned. */
const LEGACY_COLLECTION_FIELDS = [
  ...PRIMARY_COLLECTION_FIELDS.slice(0, 7),
  {
    key: 'selectedProducts',
    type: 'TEXT' as const,
    displayName: 'Selected Products',
  },
  ...PRIMARY_COLLECTION_FIELDS.slice(7),
];

async function ensureLegacyFieldSchema(): Promise<void> {
  try {
    const elevatedGet = auth.elevate(collections.getDataCollection);
    const col = await elevatedGet(LEGACY_SETTINGS_COLLECTION_ID);
    const existingKeys = new Set(
      (col.fields || []).map((f) => f.key).filter(Boolean) as string[]
    );
    const elevatedAddField = auth.elevate(collections.createDataCollectionField);
    for (const field of LEGACY_COLLECTION_FIELDS) {
      if (existingKeys.has(field.key)) continue;
      try {
        await elevatedAddField(LEGACY_SETTINGS_COLLECTION_ID, { field });
      } catch {
        // Field may already exist or collection may reject — continue.
      }
    }
  } catch {
    // Collection missing — ensureLegacySettingsCollection handles create.
  }
}

function isSubrequestLimitError(error: unknown): boolean {
  return extractErrorMessage(error)
    .toLowerCase()
    .includes('too many subrequests');
}

/**
 * Minimal write — Worker invocations have a hard subrequest cap.
 * One Admin save (upsert), then one elevated save. No query + multi-retry grid.
 */
async function writePayloadToCollection(
  collectionId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const data = {
    ...cleanPayload(payload),
    _id: SETTINGS_ITEM_ID,
  };
  const errors: string[] = [];

  try {
    await items.save(collectionId, data);
    return;
  } catch (e) {
    errors.push(`admin-save:${extractErrorMessage(e).slice(0, 90)}`);
    if (isSubrequestLimitError(e)) {
      throw new Error(
        `Write to ${collectionId} failed (${errors.join(' | ')})`
      );
    }
  }

  try {
    const elevatedSave = auth.elevate(items.save);
    await elevatedSave(collectionId, data);
    return;
  } catch (e) {
    errors.push(`app-save:${extractErrorMessage(e).slice(0, 90)}`);
    throw new Error(
      `Write to ${collectionId} failed (${errors.join(' | ') || 'unknown'})`
    );
  }
}

/**
 * App-owned `@…/settings` can only be provisioned by the Data Collections
 * extension (install/update). Runtime create of namespaced IDs returns empty
 * system errors — so we only detect existence here, never create.
 */
export async function ensureAppSettingsCollection(): Promise<{
  ok: boolean;
  created: boolean;
  detail: string;
}> {
  try {
    await querySettings(SETTINGS_COLLECTION_ID);
    return { ok: true, created: false, detail: '' };
  } catch (queryError) {
    if (isCmsMissing(queryError)) {
      return {
        ok: false,
        created: false,
        detail: extractErrorMessage(queryError),
      };
    }
  }

  try {
    const elevatedGet = auth.elevate(collections.getDataCollection);
    await elevatedGet(SETTINGS_COLLECTION_ID);
    return { ok: true, created: false, detail: 'exists-get' };
  } catch (getError) {
    if (isCmsMissing(getError)) {
      return {
        ok: false,
        created: false,
        detail: extractErrorMessage(getError),
      };
    }
    return {
      ok: false,
      created: false,
      detail: extractErrorMessage(getError).slice(0, 200),
    };
  }
}

/**
 * Create native OrderWhatsAppSettings when the app-owned collection was never
 * provisioned (common on sites installed before Data Collections existed).
 */
export async function ensureLegacySettingsCollection(): Promise<{
  ok: boolean;
  created: boolean;
  detail: string;
}> {
  try {
    const elevatedGet = auth.elevate(collections.getDataCollection);
    await elevatedGet(LEGACY_SETTINGS_COLLECTION_ID);
    return { ok: true, created: false, detail: '' };
  } catch (getError) {
    if (isCmsMissing(getError)) {
      return {
        ok: false,
        created: false,
        detail: extractErrorMessage(getError),
      };
    }
    // Missing or opaque error → try create.
  }

  try {
    const elevatedCreate = auth.elevate(collections.createDataCollection);
    await elevatedCreate({
      _id: LEGACY_SETTINGS_COLLECTION_ID,
      displayName: 'Order on WhatsApp Settings',
      displayField: 'whatsappNumber',
      fields: LEGACY_COLLECTION_FIELDS,
      permissions: {
        insert: 'ADMIN',
        update: 'ADMIN',
        remove: 'ADMIN',
        read: 'ANYONE',
      },
    });
    return { ok: true, created: true, detail: 'created' };
  } catch (createError) {
    const msg = extractErrorMessage(createError);
    const already =
      msg.toLowerCase().includes('already') ||
      msg.includes('WDE0074') ||
      msg.toLowerCase().includes('duplicate');
    if (already) {
      return { ok: true, created: false, detail: 'exists' };
    }
    return { ok: false, created: false, detail: msg.slice(0, 200) };
  }
}

/**
 * Fresh minimal collection for merchant sites where legacy exists but writes fail.
 * Only singletonKey + settingsJson — avoids schema / opaque write errors.
 * createDataCollection requires a GUID-style _id.
 */
export async function ensureBackupSettingsCollection(): Promise<{
  ok: boolean;
  created: boolean;
  detail: string;
  collectionId?: string;
}> {
  // Already usable?
  for (const id of [BACKUP_SETTINGS_COLLECTION_ID, BACKUP_SETTINGS_COLLECTION_GUID]) {
    try {
      await querySettings(id);
      return { ok: true, created: false, detail: '', collectionId: id };
    } catch {
      // try get / next id
    }
    try {
      const elevatedGet = auth.elevate(collections.getDataCollection);
      await elevatedGet(id);
      return { ok: true, created: false, detail: 'exists-get', collectionId: id };
    } catch (getError) {
      if (isCmsMissing(getError)) {
        return {
          ok: false,
          created: false,
          detail: extractErrorMessage(getError),
        };
      }
    }
  }

  const createIds = [BACKUP_SETTINGS_COLLECTION_GUID, BACKUP_SETTINGS_COLLECTION_ID];
  let lastDetail = '';

  for (const id of createIds) {
    try {
      const elevatedCreate = auth.elevate(collections.createDataCollection);
      await elevatedCreate({
        _id: id,
        displayName: 'Order on WhatsApp App Settings',
        displayField: 'singletonKey',
        fields: [
          { key: 'singletonKey', type: 'TEXT', displayName: 'Singleton Key' },
          { key: 'settingsJson', type: 'TEXT', displayName: 'Settings JSON' },
        ],
        permissions: {
          insert: 'ADMIN',
          update: 'ADMIN',
          remove: 'ADMIN',
          read: 'ANYONE',
        },
      });
      return { ok: true, created: true, detail: 'created', collectionId: id };
    } catch (createError) {
      const msg = extractErrorMessage(createError);
      lastDetail = msg.slice(0, 200);
      const already =
        msg.toLowerCase().includes('already') ||
        msg.includes('WDE0074') ||
        msg.toLowerCase().includes('duplicate');
      if (already) {
        return { ok: true, created: false, detail: 'exists', collectionId: id };
      }
    }
  }

  const hint = isSystemError({ message: lastDetail })
    ? ' Add Manage Data Collections permission in Dev Center, then update the app on this site.'
    : '';
  return {
    ok: false,
    created: false,
    detail: (lastDetail + hint).slice(0, 240),
  };
}

function buildHealth(
  primary: { ok: boolean; cmsMissing: boolean; detail: string },
  legacy: { ok: boolean; cmsMissing: boolean; detail: string },
  backup: { ok: boolean; cmsMissing: boolean; detail: string }
): StorageHealth {
  const cmsMissing = primary.cmsMissing || legacy.cmsMissing || backup.cmsMissing;
  const ready = primary.ok || legacy.ok || backup.ok;

  let detail = '';
  if (cmsMissing) {
    detail =
      'Wix CMS is not installed on this site. Add CMS (Content Manager), then try again.';
  } else if (!ready) {
    const blob = `${primary.detail} ${legacy.detail} ${backup.detail}`.toLowerCase();
    if (blob.includes('system error') || blob.includes('applicationerror')) {
      detail =
        'Cannot create settings storage yet. In Dev Center → Permissions, add Manage Data Collections + Read/Write Data Items, then Update the app on this site and Retry.';
    } else {
      detail =
        'Settings storage is still setting up. Click Retry to create it, then Save.';
    }
  }

  return {
    ready,
    primaryOk: primary.ok,
    legacyOk: legacy.ok,
    backupOk: backup.ok,
    cmsMissing,
    detail: detail || primary.detail || legacy.detail || backup.detail || '',
    primaryDetail: (primary.detail || '').slice(0, 160),
    legacyDetail: (legacy.detail || '').slice(0, 160),
    backupDetail: (backup.detail || '').slice(0, 160),
  };
}

export async function getStorageHealth(): Promise<StorageHealth> {
  // Self-heal on every health check (dashboard load, Retry, Save).
  return ensureStorageReady();
}

/**
 * Dashboard load / Retry / Save: if `@…/settings` is missing for THIS site,
 * recreate it (then backup + legacy fallbacks). Merchants need not reinstall.
 * Fast path: parallel probes + prefer native OowSettings (namespaced create often hangs).
 */
export async function ensureStorageReady(): Promise<StorageHealth> {
  const probeMs = 6000;
  const createMs = 10000;

  let [primary, legacy, backupA, backupB] = await Promise.all([
    withTimeout(probeCollection(SETTINGS_COLLECTION_ID), probeMs, 'probe-primary').catch(
      (e) => ({
        ok: false,
        cmsMissing: false,
        detail: extractErrorMessage(e),
      })
    ),
    withTimeout(
      probeCollection(LEGACY_SETTINGS_COLLECTION_ID),
      probeMs,
      'probe-legacy'
    ).catch((e) => ({
      ok: false,
      cmsMissing: false,
      detail: extractErrorMessage(e),
    })),
    withTimeout(
      probeCollection(BACKUP_SETTINGS_COLLECTION_ID),
      probeMs,
      'probe-backup'
    ).catch((e) => ({
      ok: false,
      cmsMissing: false,
      detail: extractErrorMessage(e),
    })),
    withTimeout(
      probeCollection(BACKUP_SETTINGS_COLLECTION_GUID),
      probeMs,
      'probe-backup-guid'
    ).catch((e) => ({
      ok: false,
      cmsMissing: false,
      detail: extractErrorMessage(e),
    })),
  ]);

  let backup = backupA.ok ? backupA : backupB;
  if (!backup.ok && backupB.detail) {
    backup = {
      ...backup,
      detail: [backupA.detail, backupB.detail].filter(Boolean).join(' | ').slice(0, 200),
      cmsMissing: backupA.cmsMissing || backupB.cmsMissing,
    };
  }

  if (primary.cmsMissing || legacy.cmsMissing || backup.cmsMissing) {
    return buildHealth(primary, legacy, backup);
  }

  // Prefer native backup first — app-namespaced create often hangs/fails via API.
  if (!backup.ok) {
    try {
      const ensured = await withTimeout(
        ensureBackupSettingsCollection(),
        createMs,
        'create-backup'
      );
      if (ensured.ok) {
        backup = { ok: true, cmsMissing: false, detail: ensured.detail || 'ensured' };
      } else if (ensured.detail) {
        backup = { ...backup, detail: ensured.detail };
      }
    } catch (e) {
      backup = { ...backup, detail: extractErrorMessage(e) };
    }
  }

  // Try app-owned collection, but don't block if backup already ready.
  if (!primary.ok) {
    try {
      const ensured = await withTimeout(
        ensureAppSettingsCollection(),
        createMs,
        'create-primary'
      );
      if (ensured.ok) {
        primary = { ok: true, cmsMissing: false, detail: ensured.detail || 'ensured' };
      } else if (ensured.detail) {
        primary = { ...primary, detail: ensured.detail };
      }
    } catch (e) {
      primary = { ...primary, detail: extractErrorMessage(e) };
    }
  }

  // Legacy only if nothing else is ready.
  if (!primary.ok && !backup.ok && !legacy.ok) {
    try {
      const legacyEnsured = await withTimeout(
        ensureLegacySettingsCollection(),
        createMs,
        'create-legacy'
      );
      if (legacyEnsured.ok) {
        legacy = {
          ok: true,
          cmsMissing: false,
          detail: legacyEnsured.detail || 'ensured',
        };
      } else if (legacyEnsured.detail) {
        legacy = { ...legacy, detail: legacyEnsured.detail };
      }
    } catch (e) {
      legacy = { ...legacy, detail: extractErrorMessage(e) };
    }
  }

  const health = buildHealth(primary, legacy, backup);
  return health;
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const row = await querySettingsWithFallback();
    return toAppSettings(row);
  } catch {
    return defaultSettings();
  }
}

function formatPersistDebug(
  steps: Array<Record<string, unknown>>,
  health: StorageHealth | null,
  extra?: Record<string, unknown>
): string {
  const payload = {
    steps,
    health: health
      ? {
          ready: health.ready,
          p: health.primaryOk,
          l: health.legacyOk,
          b: health.backupOk,
          cms: health.cmsMissing,
          pd: (health.primaryDetail || '').slice(0, 80),
          ld: (health.legacyDetail || '').slice(0, 80),
          bd: (health.backupDetail || '').slice(0, 80),
        }
      : null,
    ...extra,
  };
  try {
    return JSON.stringify(payload);
  } catch {
    return '{"steps":"unserializable"}';
  }
}

export async function persistSettings(settings: AppSettings): Promise<AppSettings> {
  const fullPayload = buildPayload(settings);
  const jsonBackupPayload = buildJsonBackupPayload(settings);
  const legacyCorePayload = buildLegacyCorePayload(settings);
  const steps: Array<Record<string, unknown>> = [
    { step: 'plan', lean: true, note: 'no-health-probe-avoid-subrequest-limit' },
  ];

  // Do NOT call getStorageHealth/ensure here — that alone can exhaust the
  // Worker subrequest budget before any write runs.

  // 1) Backup JSON (one collection id at a time, max ~2 saves each)
  // This is the source of truth for lean Save — loadSettings prefers it.
  let lastBackupError: unknown;
  for (const backupId of [
    BACKUP_SETTINGS_COLLECTION_ID,
    BACKUP_SETTINGS_COLLECTION_GUID,
  ]) {
    try {
      await writePayloadToCollection(backupId, jsonBackupPayload);
      steps.push({ step: 'backup-json', collectionId: backupId, ok: true });
      return settings;
    } catch (backupError) {
      lastBackupError = backupError;
      steps.push({
        step: 'backup-json',
        collectionId: backupId,
        ...extractErrorDebug(backupError),
      });
      if (isCmsMissing(backupError)) {
        throw new Error(
          `Wix CMS is not installed on this site. Add CMS (Content Manager), then try Save again. |DBG|${formatPersistDebug(steps, null)}`
        );
      }
      if (isSubrequestLimitError(backupError)) {
        throw new Error(
          `Save write failed (Worker subrequest limit). Wait a second and Save again. |DBG|${formatPersistDebug(steps, null, { skipPrimary: true })}`
        );
      }
    }
  }

  // 2) Legacy core payload — single attempt
  try {
    await writePayloadToCollection(LEGACY_SETTINGS_COLLECTION_ID, legacyCorePayload);
    steps.push({ step: 'legacy-core', ok: true });
    return settings;
  } catch (legacyError) {
    steps.push({
      step: 'legacy-core',
      ...extractErrorDebug(legacyError),
    });
    if (isCmsMissing(legacyError)) {
      throw new Error(
        `Wix CMS is not installed on this site. Add CMS (Content Manager), then try Save again. |DBG|${formatPersistDebug(steps, null)}`
      );
    }
    if (isSubrequestLimitError(legacyError)) {
      throw new Error(
        `Save write failed (Worker subrequest limit). Wait a second and Save again. |DBG|${formatPersistDebug(steps, null, { skipPrimary: true })}`
      );
    }

    // 3) Primary once (elevated) — only if legacy failed for another reason
    try {
      await writePayloadToCollection(SETTINGS_COLLECTION_ID, fullPayload);
      steps.push({ step: 'primary', ok: true });
      return settings;
    } catch (primaryError) {
      steps.push({
        step: 'primary',
        ...extractErrorDebug(primaryError),
      });
      const backupMsg = lastBackupError
        ? extractErrorMessage(lastBackupError).slice(0, 120)
        : '';
      const legacyMsg = extractErrorMessage(legacyError).slice(0, 120);
      const primaryMsg = extractErrorMessage(primaryError).slice(0, 120);
      throw new Error(
        `Save write failed. backup:[${backupMsg || 'n/a'}] legacy:[${legacyMsg}] primary:[${primaryMsg}] |DBG|${formatPersistDebug(
          steps,
          null,
          { skipPrimary: false }
        )}`
      );
    }
  }
}
