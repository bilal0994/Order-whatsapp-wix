/** App ID from wix.config.json / Dev Center. */
export const APP_ID = 'bded4014-20be-4629-800e-a78f0c368703';

/** App namespace from Dev Center (App ID & keys). Used when Data Collections extension is live. */
export const APP_NAMESPACE = '@fayyazaiman6/orderwhatsapp';

/** App-namespaced collection created by the Data Collections extension on install. */
export const SETTINGS_COLLECTION_ID = `${APP_NAMESPACE}/settings`;

/** Legacy manual CMS collection (pre-extension). */
export const LEGACY_SETTINGS_COLLECTION_ID = 'OrderWhatsAppSettings';

/**
 * App-managed backup collection (native CMS). Created at runtime when the
 * app-owned collection was never provisioned. Minimal schema: JSON blob.
 * Not tied to any merchant account name.
 */
export const BACKUP_SETTINGS_COLLECTION_ID = 'OowSettings';

/**
 * Stable GUID form for createDataCollection (API expects a GUID-style _id).
 * We still probe/read `OowSettings` for older creates.
 */
export const BACKUP_SETTINGS_COLLECTION_GUID = 'c8e4f1a2-3b5d-4e6f-9a0b-1c2d3e4f5a6b';

/** Singleton key so each site keeps one settings row. */
export const SETTINGS_SINGLETON_KEY = 'default';

/** Wix Stores catalog app id for eCom order line item catalogReference. */
export const STORES_CATALOG_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';

export const DEFAULT_BUTTON_TEXT = 'Order on WhatsApp';
export const DEFAULT_BUTTON_COLOR = '#25D366';

export const DEFAULT_ORDER_STATUS = 'NOT_PAID' as const;

/**
 * App-owner test sites: unlock Save / storefront without a paid plan.
 * Includes the CLI Dev Site used for OrderWhatsApp. Add more site IDs if needed.
 * Production merchant sites are NOT listed here — they still need Upgrade.
 */
export const APP_OWNER_UNLOCK_SITE_IDS: string[] = [
  '628da76b-1b87-4b9b-81eb-55de206e97f9', // Dev Sitex1940908119
];

/** Merchant support WhatsApp (dashboard “Contact Support Now”). */
export const SUPPORT_WHATSAPP_NUMBER = '+923315423626';
export const SUPPORT_WHATSAPP_MESSAGE =
  'Hi, I need help with Order on WhatsApp';

export type DefaultOrderStatus = 'NOT_PAID' | 'PAID' | 'PARTIALLY_PAID';
