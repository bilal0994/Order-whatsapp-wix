/**
 * Order creation + WhatsApp handoff.
 *
 * import { createWhatsAppOrder } from 'backend/orders.web';
 */
import { webMethod, Permissions } from '@wix/web-methods';
import { auth } from '@wix/essentials';
import { orders } from '@wix/ecom';
import { STORES_CATALOG_APP_ID } from '../consts';
import type {
  CreateWhatsAppOrderRequest,
  CreateWhatsAppOrderResponse,
  OrderLineItemInput,
} from '../types';
import {
  buildWhatsAppUrl,
  formatOrderMessage,
  isValidWhatsAppNumber,
} from '../shared/whatsapp';
import { loadSettings } from './settings-store';
import { assertPaidPlan } from './billing';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateRequest(payload: CreateWhatsAppOrderRequest) {
  if (!payload?.customer) {
    throw new Error('Customer details are required.');
  }
  const { name, phone, address } = payload.customer;
  if (!name?.trim()) throw new Error('Name is required.');
  if (!phone?.trim()) throw new Error('Phone is required.');
  if (!address?.trim()) throw new Error('Address is required.');
  if (!payload.lineItems?.length) {
    throw new Error('At least one line item is required.');
  }
  for (const item of payload.lineItems) {
    if (!item.productId) throw new Error('Each item needs a productId.');
    if (!item.productName?.trim()) throw new Error('Each item needs a product name.');
    if (!item.quantity || item.quantity < 1) {
      throw new Error('Each item needs a quantity of at least 1.');
    }
    if (item.price === undefined || item.price === null || item.price === '') {
      throw new Error('Each item needs a price.');
    }
  }
}

function toOrderLineItems(lineItems: OrderLineItemInput[]) {
  return lineItems.map((item) => {
    const descriptionLines = item.options
      ? Object.entries(item.options).map(([k, v]) => `${k}: ${v}`)
      : undefined;
    const lineTotal = (Number(item.price) || 0) * item.quantity;
    const taxableAmount = lineTotal.toFixed(2);

    return {
      quantity: item.quantity,
      productName: {
        original: item.productName,
      },
      catalogReference: {
        catalogItemId: item.productId,
        appId: STORES_CATALOG_APP_ID,
        ...(item.variantId
          ? { options: { variantId: item.variantId } }
          : item.options
            ? { options: item.options }
            : {}),
      },
      itemType: {
        preset: 'PHYSICAL' as const,
      },
      price: {
        amount: String(item.price),
      },
      // WhatsApp = pay later; offline unpaid orders stay visible in the Orders tab.
      paymentOption: 'FULL_PAYMENT_OFFLINE' as const,
      // Required by createOrder validation on this site.
      taxInfo: {
        taxRate: '0',
        taxableAmount: { amount: taxableAmount },
        taxAmount: { amount: '0.00' },
        taxIncludedInPrice: true,
      },
      ...(descriptionLines?.length
        ? {
            descriptionLines: descriptionLines.map((d) => ({
              name: { original: d },
            })),
          }
        : {}),
    };
  });
}

function sumLineItems(lineItems: OrderLineItemInput[]): string {
  const total = lineItems.reduce((sum, item) => {
    const unit = Number(item.price) || 0;
    return sum + unit * item.quantity;
  }, 0);
  return total.toFixed(2);
}

function errorText(error: unknown): string {
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function isNonRetryable(error: unknown): boolean {
  const text = errorText(error);
  const status =
    typeof error === 'object' && error && 'status' in error
      ? Number((error as { status: unknown }).status)
      : undefined;
  return (
    status === 400 ||
    status === 403 ||
    status === 429 ||
    text.includes('RATE_LIMITED') ||
    text.includes('INVALID_ARGUMENT') ||
    text.includes('Validation failed') ||
    text.includes('REQUIRED_FIELD')
  );
}

function friendlyOrderError(error: unknown): Error {
  const text = errorText(error);
  if (text.includes('RATE_LIMITED') || text.includes('Too many requests')) {
    return new Error(
      'Wix is rate-limiting order creation. Wait 10–15 minutes, then submit only once.'
    );
  }
  if (
    text.includes('taxInfo') ||
    text.includes('taxDetails') ||
    text.includes('INVALID_ARGUMENT')
  ) {
    return new Error(
      'Could not create the order due to invalid order data. Please try again.'
    );
  }
  if (text.includes('403') || text.toLowerCase().includes('permission')) {
    return new Error(
      'Missing Manage Orders permission on OrderWhatsApp. Add it in Dev Center, update the app, then try again.'
    );
  }
  try {
    const parsed = JSON.parse(text) as { message?: string };
    if (parsed?.message) {
      return new Error(parsed.message);
    }
  } catch {
    // ignore
  }
  return error instanceof Error ? error : new Error(text || 'Failed to create order.');
}

async function createOrderWithRetry(
  orderPayload: Parameters<typeof orders.createOrder>[0],
  attempts = 1
) {
  const elevatedCreate = auth.elevate(orders.createOrder);
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await elevatedCreate(orderPayload);
    } catch (error) {
      lastError = error;
      if (isNonRetryable(error) || i >= attempts - 1) {
        break;
      }
      await sleep(400 * (i + 1));
    }
  }

  throw friendlyOrderError(lastError);
}

export const createWhatsAppOrder = webMethod(
  Permissions.Anyone,
  async (
    payload: CreateWhatsAppOrderRequest
  ): Promise<CreateWhatsAppOrderResponse> => {
    validateRequest(payload);

    await assertPaidPlan();

    const settings = await loadSettings();
    if (!settings.enabled) {
      throw new Error('Order on WhatsApp is currently disabled.');
    }
    if (!isValidWhatsAppNumber(settings.whatsappNumber)) {
      throw new Error(
        'The store owner has not configured a valid WhatsApp number yet.'
      );
    }

    const currency = payload.currency || 'USD';
    const subtotal = sumLineItems(payload.lineItems);
    const lineItems = toOrderLineItems(payload.lineItems);

    const buyerNote = [
      payload.customer.notes?.trim(),
      ...Object.entries(payload.customer.customFields || {}).map(([id, value]) => {
        const label = payload.customer.customFieldLabels?.[id] || id;
        return `${label}: ${value}`;
      }),
      `Ordered via WhatsApp. Customer phone: ${payload.customer.phone}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const result = await createOrderWithRetry({
        lineItems,
        channelInfo: {
          type: 'OTHER_PLATFORM',
        },
        // APPROVED + NOT_PAID offline unpaid orders appear in the Orders dashboard.
        // NOT_PAID without this becomes INITIALIZED and is hidden from Orders search.
        status: 'APPROVED',
        priceSummary: {
          subtotal: { amount: subtotal },
          total: { amount: subtotal },
        },
        currency,
        currencyConversionDetails: {
          originalCurrency: currency,
          conversionRate: '1',
        },
        buyerInfo: {
          fullName: payload.customer.name.trim(),
          phone: payload.customer.phone.trim(),
        },
        shippingInfo: {
          logistics: {
            shippingDestination: {
              address: {
                addressLine: payload.customer.address.trim(),
              },
              contactDetails: {
                fullName: {
                  firstName: payload.customer.name.trim(),
                },
                phone: payload.customer.phone.trim(),
              },
            },
          },
        },
        buyerNote,
        paymentStatus: settings.defaultOrderStatus,
      } as Parameters<typeof orders.createOrder>[0]);

      const orderId = result?._id || 'unknown';

      const message = formatOrderMessage({
        orderId,
        customer: payload.customer,
        lineItems: payload.lineItems,
        currency,
        template: settings.messageTemplate,
        formFields: settings.formFields,
      });

      const whatsappUrl = buildWhatsAppUrl(settings.whatsappNumber, message);

      return {
        orderId,
        whatsappUrl,
        message,
      };
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(
            (error as { message?: string })?.message ||
              'Failed to create order.'
          );
    }
  }
);
