# Required Wix App permissions

Configure these on **OrderWhatsApp** only (App ID `bded4014-20be-4629-800e-a78f0c368703`):

1. Open [Custom Apps](https://manage.wix.com/studio/custom-apps/) → **OrderWhatsApp**.
2. Go to **Permissions** (or Develop → Permissions).
3. Add:

| Permission | Scope | Why |
|------------|-------|-----|
| **Catalog Read Limited** | `SCOPE.STORES.CATALOG_READ_LIMITED` | `catalogVersioning.getCatalogVersion()` — required for V1/V3 support |
| **Read Products** (V1) | `SCOPE.DC-STORES.READ-PRODUCTS` | Catalog V1 product reads |
| **Product Read** (V3) | `SCOPE.STORES.PRODUCT_READ` | Catalog V3 product reads |
| **Manage Orders** | `SCOPE.DC-STORES.MANAGE-ORDERS` | `orders.createOrder` from the backend web method |
| **Manage Your App** | `MANAGE-YOUR-APP` | `appInstances.getAppInstance()` — paid-plan check (`isFree`) |
| **Manage Data Collections** | (CMS) | Create/heal `@…/settings` + backup collections at runtime |
| **Read Data Items** | (CMS) | Load settings |
| **Write Data Items** | (CMS) | Save settings |
| **Read Site Properties** (optional) | — | Future: site name/currency in WhatsApp message |

4. Save. On a development site, wait a few minutes for permissions to apply (no new release required for dev).

## Paid plan (App Market)

The app is a full paywall. `getAppInstance().instance.isFree`:

- **true / unknown:** dashboard shows an **Upgrade** button; settings cannot be saved; `createWhatsAppOrder` is rejected.
- **false** (paid or trial): full access.

Development and production sites use the same paywall. Use a Wix free trial or paid plan for testing.

Pricing plans are configured in Dev Center. This app only enforces them.

## Catalog V1 + V3 (App Market)

Wix Stores sites use either Catalog V1 or Catalog V3 (not both). This app detects the version with `getCatalogVersion()` and routes product reads through `products` (V1) or `productsV3` (V3).

After releasing a build that includes dual support:

1. Open the app dashboard → App Market / distribution checklist.
2. Confirm the app is compatible with **both Catalog V1 and Catalog V3**.

New Apps Market listing requires that confirmation.

For settings storage, the app uses a **Data Collections extension** that auto-creates `@fayyazaiman6/orderwhatsapp/settings` on install. Bundle **Wix CMS** as an app dependency. Merchants do not create collections manually (see [SETUP.md](SETUP.md)).

Do **not** add these only on the leftover “Order on WhatsApp” drafts — those are not linked to this repo.
