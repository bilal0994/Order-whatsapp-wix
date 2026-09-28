/**
 * Dual Catalog V1 + V3 support for Wix Stores.
 * Call getCatalogVersion before product reads; each site is permanently on one version.
 */
import { catalogVersioning, products, productsV3 } from '@wix/stores';

export type CatalogVersion =
  | 'V1_CATALOG'
  | 'V3_CATALOG'
  | 'STORES_NOT_INSTALLED';

export type CatalogProductOption = {
  id: string;
  value: string;
};

export type CatalogProductDetails = {
  productId: string;
  name: string;
  currency: string;
  unitPrice: string;
  /** Shopper must select options / a variant before ordering. */
  needsVariant: boolean;
};

let cachedVersion: CatalogVersion | undefined;

/** Resolve (and cache) which Stores catalog the current site uses. */
export async function resolveCatalogVersion(): Promise<CatalogVersion> {
  if (cachedVersion) return cachedVersion;
  try {
    const res = await catalogVersioning.getCatalogVersion();
    const version = res.catalogVersion;
    if (
      version === 'V1_CATALOG' ||
      version === 'V3_CATALOG' ||
      version === 'STORES_NOT_INSTALLED'
    ) {
      cachedVersion = version;
    } else {
      cachedVersion = 'STORES_NOT_INSTALLED';
    }
  } catch {
    cachedVersion = 'STORES_NOT_INSTALLED';
  }
  return cachedVersion;
}

/** Product picker options for the dashboard (id + display name). */
export async function listProductsForSelect(
  limit = 100
): Promise<CatalogProductOption[]> {
  const version = await resolveCatalogVersion();
  if (version === 'STORES_NOT_INSTALLED') return [];

  if (version === 'V3_CATALOG') {
    const result = await productsV3.queryProducts().limit(limit).find();
    return (result.items || [])
      .map((p) => ({
        id: p._id || '',
        value: p.name || p._id || 'Product',
      }))
      .filter((o) => o.id);
  }

  const result = await products.queryProducts().limit(limit).find();
  return (result.items || [])
    .map((p) => ({
      id: p._id || '',
      value: p.name || p._id || 'Product',
    }))
    .filter((o) => o.id);
}

function v3VariantPrice(variant: {
  price?: {
    actualPrice?: { amount?: string };
    amount?: string;
  };
}): string | undefined {
  const amount =
    variant?.price?.actualPrice?.amount ?? variant?.price?.amount;
  return amount != null ? String(amount) : undefined;
}

/** Load name / price / variant requirements for the product-page button. */
export async function getProductDetails(
  productId: string,
  selectedVariantId?: string
): Promise<CatalogProductDetails | null> {
  const version = await resolveCatalogVersion();
  if (version === 'STORES_NOT_INSTALLED') return null;

  if (version === 'V3_CATALOG') {
    const product = await productsV3.getProduct(productId, {
      fields: ['CURRENCY', 'VARIANT_OPTION_CHOICE_NAMES'],
    });
    if (!product) return null;

    const variants = product.variantsInfo?.variants || [];
    const options = product.options || [];
    const hasOptionChoices = options.some(
      (o) => (o.choicesSettings?.choices?.length || 0) > 0
    );
    const needsVariant =
      variants.length > 1 || (options.length > 0 && hasOptionChoices);

    let unitPrice = '0';
    if (selectedVariantId) {
      const match = variants.find((v) => v._id === selectedVariantId);
      unitPrice =
        v3VariantPrice(match || {}) ||
        v3VariantPrice(variants[0] || {}) ||
        '0';
    } else {
      unitPrice = v3VariantPrice(variants[0] || {}) || '0';
    }

    return {
      productId,
      name: product.name || 'Product',
      currency: product.currency || 'USD',
      unitPrice,
      needsVariant,
    };
  }

  const res = await products.getProduct(productId);
  const product = res.product;
  if (!product) return null;

  const needsVariant =
    (Boolean(product.manageVariants) && (product.variants?.length || 0) > 1) ||
    (product.productOptions?.length || 0) > 0;

  let unitPrice: string | number =
    product.priceData?.price ??
    product.price?.price ??
    product.priceData?.discountedPrice ??
    0;

  if (selectedVariantId && product.variants?.length) {
    const variant = product.variants.find((v) => v._id === selectedVariantId);
    const variantPrice =
      variant?.variant?.priceData?.price ??
      (variant as { priceData?: { price?: number } } | undefined)?.priceData
        ?.price;
    if (variantPrice != null) {
      unitPrice = variantPrice;
    }
  }

  return {
    productId,
    name: product.name || 'Product',
    currency: product.priceData?.currency || 'USD',
    unitPrice: String(unitPrice),
    needsVariant: Boolean(needsVariant),
  };
}
