import {
  DEFAULT_BUTTON_COLOR,
  DEFAULT_BUTTON_TEXT,
  DEFAULT_ORDER_STATUS,
} from '../consts';
import type { AppSettings, CheckoutCustomer, OrderLineItemInput } from '../types';
import {
  DEFAULT_FORM_SUBMIT_TEXT,
  DEFAULT_FORM_TITLE,
  DEFAULT_MESSAGE_TEMPLATE,
  defaultFormFields,
  renderMessageTemplate,
} from './formConfig';

export function defaultSettings(): AppSettings {
  return {
    whatsappNumber: '',
    buttonText: DEFAULT_BUTTON_TEXT,
    buttonColor: DEFAULT_BUTTON_COLOR,
    enabled: true,
    defaultOrderStatus: DEFAULT_ORDER_STATUS,
    productVisibility: 'all',
    selectedProductIds: [],
    buttonPosition: 'after-add-to-cart',
    hideAddToCart: false,
    showOnProductPages: true,
    showOnCart: true,
    formTitle: DEFAULT_FORM_TITLE,
    formSubmitText: DEFAULT_FORM_SUBMIT_TEXT,
    formFields: defaultFormFields(),
    messageTemplate: DEFAULT_MESSAGE_TEMPLATE,
  };
}

/** Whether the WhatsApp button should render for this product. */
export function shouldShowForProduct(
  settings: AppSettings,
  productId?: string
): boolean {
  if (!settings.enabled) return false;
  if (settings.productVisibility !== 'selected') return true;
  if (!productId) return false;
  return settings.selectedProductIds.includes(productId);
}

/** Digits only for wa.me links. */
export function normalizeWhatsAppNumber(input: string): string {
  return (input || '').replace(/\D/g, '');
}

/** Loose E.164-ish check: optional +, 8–15 digits. */
export function isValidWhatsAppNumber(input: string): boolean {
  const trimmed = (input || '').trim();
  if (!trimmed) return false;
  if (!/^\+?[\d\s\-()]+$/.test(trimmed)) return false;
  const digits = normalizeWhatsAppNumber(trimmed);
  return digits.length >= 8 && digits.length <= 15;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = normalizeWhatsAppNumber(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function formatOrderMessage(params: {
  orderId: string;
  customer: CheckoutCustomer;
  lineItems: OrderLineItemInput[];
  currency?: string;
  template?: string;
  formFields?: AppSettings['formFields'];
}): string {
  return renderMessageTemplate(params.template || DEFAULT_MESSAGE_TEMPLATE, {
    orderId: params.orderId,
    customer: params.customer,
    lineItems: params.lineItems,
    currency: params.currency,
    formFields: params.formFields,
  });
}
