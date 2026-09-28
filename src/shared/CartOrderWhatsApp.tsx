import React, { useCallback, useEffect, useState, type FC } from 'react';
import { currentCart } from '@wix/ecom';
import { createWhatsAppOrder } from '../backend/orders.web';
import type {
  AppSettings,
  CheckoutCustomer,
  OrderLineItemInput,
} from '../types';
import { defaultSettings, shouldShowForProduct } from './whatsapp';
import { loadStorefrontRuntime, openWhatsApp, shouldShowSetupHint } from './storefront';
import { CheckoutModal } from './CheckoutModal';
import { WhatsAppOrderButton } from './WhatsAppOrderButton';

function mapCartLineItems(
  cart: currentCart.Cart | undefined
): OrderLineItemInput[] {
  const lines = cart?.lineItems || [];
  return lines
    .map((line) => {
      const productId =
        line.catalogReference?.catalogItemId ||
        line.productName?.original ||
        '';
      if (!productId && !line.productName?.original) {
        return null;
      }
      const options: Record<string, string> = {};
      line.descriptionLines?.forEach((d) => {
        const key = d.name?.original || d.name?.translated || 'Option';
        const value =
          d.plainText?.original ||
          d.plainText?.translated ||
          d.colorInfo?.original ||
          d.colorInfo?.translated ||
          '';
        if (value) options[key] = value;
      });

      const price =
        line.price?.amount ||
        line.fullPrice?.amount ||
        '0';

      return {
        productId: line.catalogReference?.catalogItemId || productId,
        productName: line.productName?.original || 'Item',
        quantity: line.quantity || 1,
        price: String(price),
        variantId: line.catalogReference?.options?.variantId as
          | string
          | undefined,
        options: Object.keys(options).length ? options : undefined,
      } as OrderLineItemInput;
    })
    .filter(Boolean) as OrderLineItemInput[];
}

type Props = {
  className?: string;
};

/** Shared cart WhatsApp button for side cart plugin and full cart page widget. */
export const CartOrderWhatsApp: FC<Props> = ({ className }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<OrderLineItemInput[]>([]);
  const [currency, setCurrency] = useState('USD');
  const [emptyCart, setEmptyCart] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [showSetupHint, setShowSetupHint] = useState(false);

  const refreshCart = useCallback(async () => {
    try {
      const cart = await currentCart.getCurrentCart();
      const mapped = mapCartLineItems(cart);
      setLineItems(mapped);
      setEmptyCart(mapped.length === 0);
      setCurrency(cart?.currency || 'USD');
    } catch {
      setLineItems([]);
      setEmptyCart(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadStorefrontRuntime();
        if (!cancelled) {
          setSettings(data.settings);
          setIsPaid(data.isPaid);
          setShowSetupHint(shouldShowSetupHint(data));
        }
        await refreshCart();
      } catch {
        if (!cancelled) setSettings(defaultSettings());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshCart]);

  const disabled =
    loading ||
    !isPaid ||
    !settings.enabled ||
    !settings.whatsappNumber ||
    emptyCart ||
    lineItems.length === 0;

  const cartEligible =
    settings.productVisibility !== 'selected' ||
    lineItems.some((line) => shouldShowForProduct(settings, line.productId));

  const showCartButton =
    !loading &&
    settings.enabled &&
    settings.showOnCart !== false &&
    cartEligible &&
    !showSetupHint;

  const summary =
    lineItems.length === 0
      ? 'Your cart is empty'
      : `${lineItems.length} item(s) in cart`;

  const onOpen = async () => {
    setError(null);
    await refreshCart();
    setOpen(true);
  };

  const onSubmit = useCallback(
    async (customer: CheckoutCustomer) => {
      if (!lineItems.length) {
        setError('Your cart is empty.');
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const result = await createWhatsAppOrder({
          customer,
          lineItems,
          currency,
        });
        setOpen(false);
        openWhatsApp(result.whatsappUrl);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not create the order.'
        );
      } finally {
        setSubmitting(false);
      }
    },
    [lineItems, currency]
  );

  return (
    <div className={className}>
      {showSetupHint ? (
        <div
          style={{
            fontSize: 12,
            color: '#666',
            padding: '8px 0',
            fontFamily:
              'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          Order on WhatsApp: add your WhatsApp number in the app dashboard, then
          Publish.
        </div>
      ) : showCartButton ? (
        <>
          <WhatsAppOrderButton
            text={settings.buttonText}
            color={settings.buttonColor}
            disabled={disabled}
            loading={loading}
            onClick={onOpen}
          />
          {!isPaid && (
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
              Upgrade required to complete WhatsApp orders
            </div>
          )}
          <CheckoutModal
            open={open}
            title={settings.formTitle}
            submitText={settings.formSubmitText}
            fields={settings.formFields}
            summary={summary}
            submitting={submitting}
            error={error}
            onClose={() => !submitting && setOpen(false)}
            onSubmit={onSubmit}
          />
        </>
      ) : null}
    </div>
  );
};
