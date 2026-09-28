import type { DefaultOrderStatus } from './consts';

export type ProductVisibility = 'all' | 'selected';

/** Where the WhatsApp button sits relative to Add to Cart on the product page. */
export type ButtonPosition = 'before-add-to-cart' | 'after-add-to-cart';

export type FormFieldType = 'text' | 'textarea' | 'tel' | 'select';

/** Configurable checkout form field (dashboard → storefront modal). */
export type FormFieldConfig = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  /** Options when type is select. */
  options?: string[];
};

export type AppSettings = {
  whatsappNumber: string;
  buttonText: string;
  buttonColor: string;
  enabled: boolean;
  defaultOrderStatus: DefaultOrderStatus;
  /** Show button on every product, or only on selected ones. */
  productVisibility: ProductVisibility;
  /** Product IDs when productVisibility is "selected". */
  selectedProductIds: string[];
  /** Product page: place WhatsApp button before or after Add to Cart. */
  buttonPosition: ButtonPosition;
  /** Hide native Add to Cart / Buy Now; show only Order on WhatsApp. */
  hideAddToCart: boolean;
  /** Show WhatsApp button on product pages. */
  showOnProductPages: boolean;
  /** Show WhatsApp button on cart (side cart). */
  showOnCart: boolean;
  /** Checkout modal title. */
  formTitle: string;
  /** Checkout modal submit button label. */
  formSubmitText: string;
  /** Dynamic form fields shown in the checkout modal. */
  formFields: FormFieldConfig[];
  /** WhatsApp message template with {{placeholders}}. */
  messageTemplate: string;
};

export type CheckoutCustomer = {
  name: string;
  phone: string;
  address: string;
  notes?: string;
  /** Values for custom (non-core) form fields, keyed by field id. */
  customFields?: Record<string, string>;
  /** Labels for custom fields (for WhatsApp message / buyer note). */
  customFieldLabels?: Record<string, string>;
};

export type OrderLineItemInput = {
  productId: string;
  productName: string;
  quantity: number;
  price: string;
  variantId?: string;
  options?: Record<string, string>;
  sku?: string;
};

export type CreateWhatsAppOrderRequest = {
  customer: CheckoutCustomer;
  lineItems: OrderLineItemInput[];
  currency?: string;
};

export type CreateWhatsAppOrderResponse = {
  orderId: string;
  whatsappUrl: string;
  message: string;
};

/** Paid-plan status from Get App Instance. Unpaid sites are blocked until upgrade. */
export type PlanStatus = {
  isFree: boolean;
  isPaid: boolean;
  instanceId: string;
  upgradeUrl: string;
  /** Meta site id when available (Editor deep link). */
  siteId?: string;
};

/** CMS / Data Collections readiness for settings Save. */
export type StorageHealth = {
  ready: boolean;
  primaryOk: boolean;
  legacyOk: boolean;
  /** True when OowSettings backup collection is queryable. */
  backupOk?: boolean;
  cmsMissing: boolean;
  detail: string;
  /** Raw probe errors (safe for debug toasts; no secrets). */
  primaryDetail?: string;
  legacyDetail?: string;
  backupDetail?: string;
};

/**
 * Save result — prefer ok:false over throw so Wix does not replace our
 * write diagnostics with "Unable to handle the request".
 */
export type SaveSettingsResult =
  | { ok: true; settings: AppSettings }
  | {
      ok: false;
      error: string;
      /** Compact write/health diagnostics for toast + debug ingest. */
      debug: {
        skipPrimary?: boolean;
        health?: {
          ready: boolean;
          primaryOk: boolean;
          legacyOk: boolean;
          backupOk?: boolean;
          cmsMissing: boolean;
        };
        steps?: unknown[];
        raw?: string;
      };
    };
