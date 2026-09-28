import type { ButtonPosition } from '../types';

const STYLE_ID = 'oow-hide-add-to-cart-style';
const HOST_ATTR = 'data-oow-product-host';

const ATC_SELECTORS = [
  '[data-hook="add-to-cart"]',
  '[data-hook="add-to-cart-button"]',
  '[data-testid="add-to-cart"]',
  '[data-testid="addToCart"]',
  'button[data-hook*="add-to-cart"]',
  '[aria-label*="Add to Cart" i]',
  '[aria-label*="Add to cart" i]',
];

const BUY_NOW_SELECTORS = [
  '[data-hook="buy-now"]',
  '[data-hook="buy-now-button"]',
  '[data-testid="buy-now"]',
  '[aria-label*="Buy Now" i]',
  '[aria-label*="Buy now" i]',
];

function queryFirst(root: ParentNode, selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    try {
      const el = root.querySelector(sel);
      if (el instanceof HTMLElement) return el;
    } catch {
      // Some browsers reject the `i` flag in attribute selectors.
    }
  }
  return null;
}

function findByButtonText(root: ParentNode, patterns: RegExp[]): HTMLElement | null {
  const buttons = root.querySelectorAll('button, [role="button"], a');
  for (const node of Array.from(buttons)) {
    if (!(node instanceof HTMLElement)) continue;
    const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
    if (patterns.some((re) => re.test(text))) {
      return node;
    }
  }
  return null;
}

/** Best-effort find of the Wix Stores Add to Cart control. */
export function findAddToCartButton(doc: Document = document): HTMLElement | null {
  return (
    queryFirst(doc, ATC_SELECTORS) ||
    findByButtonText(doc, [/^add to cart$/i, /^add to bag$/i])
  );
}

function findBuyNowButton(doc: Document = document): HTMLElement | null {
  return (
    queryFirst(doc, BUY_NOW_SELECTORS) ||
    findByButtonText(doc, [/^buy now$/i, /^buy it now$/i])
  );
}

/**
 * Pick a host node we can safely move next to Add to Cart.
 * Walks up from the plugin root toward a sibling of the ATC control.
 */
export function resolvePluginHost(from: HTMLElement): HTMLElement {
  const atc = findAddToCartButton(from.ownerDocument || document);
  let current: HTMLElement | null = from;

  // Prefer the custom element host when rendered in shadow DOM.
  const root = from.getRootNode();
  if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
    current = root.host;
  }

  if (!atc) {
    current.setAttribute(HOST_ATTR, 'true');
    return current;
  }

  let best: HTMLElement = current;
  for (let i = 0; i < 14 && current; i++) {
    const parent: HTMLElement | null = current.parentElement;
    if (!parent) break;
    if (parent.contains(atc) && !current.contains(atc)) {
      best = current;
      break;
    }
    best = current;
    current = parent;
  }

  best.setAttribute(HOST_ATTR, 'true');
  return best;
}

function setHidden(el: HTMLElement | null, hidden: boolean) {
  if (!el) return;
  if (hidden) {
    if (!el.dataset.oowPrevDisplay) {
      el.dataset.oowPrevDisplay = el.style.display || '';
    }
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
  } else if (el.dataset.oowPrevDisplay !== undefined) {
    el.style.display = el.dataset.oowPrevDisplay;
    delete el.dataset.oowPrevDisplay;
    el.removeAttribute('aria-hidden');
  }
}

function ensureHideStyles(doc: Document, hide: boolean) {
  const existing = doc.getElementById(STYLE_ID);
  if (!hide) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    [data-hook="add-to-cart"],
    [data-hook="add-to-cart-button"],
    [data-testid="add-to-cart"],
    [data-testid="addToCart"],
    [data-hook="buy-now"],
    [data-hook="buy-now-button"],
    [data-testid="buy-now"] {
      display: none !important;
    }
  `;
  doc.head.appendChild(style);
}

export type ProductPageLayoutOptions = {
  /** Element inside the product plugin (e.g. root div). */
  rootEl: HTMLElement | null;
  position: ButtonPosition;
  hideAddToCart: boolean;
  /** False when the WhatsApp button is not shown for this product. */
  active: boolean;
};

/**
 * Reposition the WhatsApp plugin relative to Add to Cart and optionally hide
 * native purchase buttons. Safe to call repeatedly; restores when inactive.
 */
export function applyProductPageLayout(options: ProductPageLayoutOptions): () => void {
  const { rootEl, position, hideAddToCart, active } = options;
  const doc = rootEl?.ownerDocument || document;

  const cleanup = () => {
    ensureHideStyles(doc, false);
    setHidden(findAddToCartButton(doc), false);
    setHidden(findBuyNowButton(doc), false);
  };

  if (!active || !rootEl) {
    cleanup();
    return cleanup;
  }

  const host = resolvePluginHost(rootEl);
  const atc = findAddToCartButton(doc);

  if (atc && host && host !== atc && !atc.contains(host)) {
    const anchor =
      atc.closest('[data-hook="product-page-actions"], [data-hook="add-to-cart-wrapper"], form') ||
      atc.parentElement ||
      atc;

    const parent = anchor.parentElement;
    if (parent) {
      const alreadyBefore =
        position === 'before-add-to-cart' && host.nextSibling === anchor;
      const alreadyAfter =
        position === 'after-add-to-cart' && anchor.nextSibling === host;
      if (!alreadyBefore && !alreadyAfter) {
        try {
          if (position === 'before-add-to-cart') {
            parent.insertBefore(host, anchor);
          } else if (anchor.nextSibling) {
            parent.insertBefore(host, anchor.nextSibling);
          } else {
            parent.appendChild(host);
          }
        } catch {
          // Layout still works in the default slot if DOM move fails.
        }
      }
    }
  }

  ensureHideStyles(doc, hideAddToCart);
  setHidden(findAddToCartButton(doc), hideAddToCart);
  setHidden(findBuyNowButton(doc), hideAddToCart);

  return cleanup;
}
