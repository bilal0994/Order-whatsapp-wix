import React, { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';
import { createWhatsAppOrder } from '../../../../backend/orders.web';
import type { AppSettings, CheckoutCustomer, OrderLineItemInput } from '../../../../types';
import { defaultSettings, shouldShowForProduct } from '../../../../shared/whatsapp';
import { getProductDetails } from '../../../../shared/catalog';
import { loadStorefrontRuntime, openWhatsApp, shouldShowSetupHint } from '../../../../shared/storefront';
import { applyProductPageLayout } from '../../../../shared/productPageLayout';
import { CheckoutModal } from '../../../../shared/CheckoutModal';
import { WhatsAppOrderButton } from '../../../../shared/WhatsAppOrderButton';
import styles from './plugin.module.css';

type Props = {
  productId?: string;
  selectedVariantId?: string;
  quantity?: string | number;
  selectedChoices?: string | Record<string, string>;
};

function parseChoices(
  raw?: string | Record<string, string>
): Record<string, string> | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'object') {
    return raw as Record<string, string>;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, string>;
    }
  } catch {
    // ignore
  }
  return undefined;
}

const ProductOrderWhatsApp: FC<Props> = ({
  productId,
  selectedVariantId,
  quantity = 1,
  selectedChoices,
}) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productName, setProductName] = useState('Product');
  const [price, setPrice] = useState('0');
  const [currency, setCurrency] = useState('USD');
  const [needsVariant, setNeedsVariant] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [showSetupHint, setShowSetupHint] = useState(false);
  const [viewMode, setViewMode] = useState<string>('Site');
  const rootRef = useRef<HTMLDivElement>(null);

  const qty = Math.max(1, Number(quantity) || 1);
  const choices = useMemo(
    () => parseChoices(selectedChoices),
    [selectedChoices]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadStorefrontRuntime();
        if (!cancelled) {
          setSettings(data.settings);
          setIsPaid(data.isPaid);
          setShowSetupHint(shouldShowSetupHint(data));
          setViewMode(String(data.viewMode || 'Site'));
        }
      } catch {
        if (!cancelled) setSettings(defaultSettings());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    (async () => {
      try {
        const details = await getProductDetails(productId, selectedVariantId);
        if (!details || cancelled) return;
        setProductName(details.name);
        setNeedsVariant(details.needsVariant);
        setPrice(details.unitPrice);
        setCurrency(details.currency);
      } catch {
        // Keep defaults; submit will still send productId.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, selectedVariantId]);

  // Show from saved settings. Paid plan is enforced when creating an order, not for button visibility
  // (Preview/Publish was hiding the button when billing reported free).
  const visible =
    settings.showOnProductPages !== false &&
    shouldShowForProduct(settings, productId);
  // Merchant-only: never show placeholders to live shoppers.
  const showSlotPlaceholder =
    !loading &&
    !visible &&
    !showSetupHint &&
    (viewMode === 'Editor' || viewMode === 'Preview');

  useEffect(() => {
    if (loading) return;

    let lastCleanup: (() => void) | undefined;
    let debounceTimer: number | undefined;
    let applying = false;
    const doc = rootRef.current?.ownerDocument || document;

    const apply = () => {
      if (applying) return;
      applying = true;
      try {
        lastCleanup = applyProductPageLayout({
          rootEl: rootRef.current,
          position: settings.buttonPosition,
          hideAddToCart: settings.hideAddToCart,
          active: visible,
        });
      } finally {
        applying = false;
      }
    };

    apply();

    const observer = new MutationObserver(() => {
      if (applying) return;
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(apply, 100);
    });
    observer.observe(doc.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.clearTimeout(debounceTimer);
      lastCleanup?.();
    };
  }, [
    loading,
    visible,
    settings.buttonPosition,
    settings.hideAddToCart,
    productId,
  ]);

  const disabled =
    loading ||
    !isPaid ||
    !settings.enabled ||
    !settings.whatsappNumber ||
    !productId ||
    (needsVariant && !selectedVariantId);

  const summary = `${productName} × ${qty}`;

  const onSubmit = useCallback(
    async (customer: CheckoutCustomer) => {
      if (!productId) return;
      if (needsVariant && !selectedVariantId) {
        setError('Please select all product options first.');
        return;
      }

      setSubmitting(true);
      setError(null);
      try {
        const lineItem: OrderLineItemInput = {
          productId,
          productName,
          quantity: qty,
          price,
          variantId: selectedVariantId,
          options: choices,
        };
        const result = await createWhatsAppOrder({
          customer,
          lineItems: [lineItem],
          currency,
        });
        setOpen(false);
        openWhatsApp(result.whatsappUrl);
      } catch (err) {
        const msg =
          (typeof err === 'object' &&
            err &&
            'message' in err &&
            typeof (err as { message: unknown }).message === 'string' &&
            (err as { message: string }).message) ||
          (err instanceof Error ? err.message : '') ||
          'Could not create the order.';
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [
      productId,
      needsVariant,
      selectedVariantId,
      productName,
      qty,
      price,
      choices,
      currency,
    ]
  );

  return (
    <div className={styles.root} ref={rootRef} data-oow-product-root>
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
      ) : visible ? (
        <>
          <WhatsAppOrderButton
            text={settings.buttonText}
            color={settings.buttonColor}
            disabled={disabled}
            loading={loading}
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
          />
          {needsVariant && !selectedVariantId && !loading && (
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
              Select options to order
            </div>
          )}
          {!isPaid && !loading && (
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
      ) : showSlotPlaceholder ? (
        <div
          style={{
            fontSize: 12,
            color: '#888',
            padding: '8px 0',
            border: '1px dashed #ccc',
            borderRadius: 6,
            textAlign: 'center',
            fontFamily:
              'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          Order on WhatsApp (save settings, then Preview / Publish to see the
          live button)
        </div>
      ) : null}
    </div>
  );
};

const customElement = reactToWebComponent(
  ProductOrderWhatsApp,
  React,
  ReactDOM,
  {
    props: {
      productId: 'string',
      selectedVariantId: 'string',
      quantity: 'string',
      selectedChoices: 'string',
    },
  }
);

export default customElement;
