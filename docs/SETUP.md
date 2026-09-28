# One-time Dev Center linking

## App ID (linked)

This project is linked to **OrderWhatsApp** in Dev Center:

- **App ID:** `bded4014-20be-4629-800e-a78f0c368703`
- Config: [`wix.config.json`](../wix.config.json)

**Blank dashboard?** Follow [`DASHBOARD_FIX.md`](DASHBOARD_FIX.md) — you must use OrderWhatsApp and open the page with **`D`** from `npm.cmd run dev`, not a leftover “Order on WhatsApp” draft in the site sidebar.

Ignore folder `e:\wix-development\order-whats-app` (Inventory Countdown / Astro template). Keep developing in **Order-on-whatsapp-wix**.

## Permissions

See [PERMISSIONS.md](PERMISSIONS.md). On **OrderWhatsApp** only, add:

- Catalog Read Limited (`SCOPE.STORES.CATALOG_READ_LIMITED`)
- Read Products — Catalog V1 (`SCOPE.DC-STORES.READ-PRODUCTS`)
- Product Read — Catalog V3 (`SCOPE.STORES.PRODUCT_READ`)
- Manage Orders
- Manage Your App (paid-plan check)
- Read Site Properties (optional)

The app supports **both Catalog V1 and V3**. After release, confirm dual compatibility in the App Market checklist.

Until the merchant upgrades, the dashboard is locked (Upgrade button) and settings cannot be saved. Paid or trial (`isFree: false`) unlocks the app. Development and production sites use the same paywall — start a Wix free trial or paid plan to test.

## Settings storage (auto-provisioned)

Merchants **do not** create a CMS collection manually, and they do **not** need a `@fayyazaiman6` account.

Settings are stored in an **app-owned** collection:

**`@fayyazaiman6/orderwhatsapp/settings`**

- `@fayyazaiman6/orderwhatsapp` = **your app’s Dev Center namespace** (same on every site that installs OrderWhatsApp)
- Data is still **per site** — Evolution’s settings never mix with your Dev Site
- **Self-heal:** on every dashboard open (and Retry/Save), the app checks whether `@…/settings` exists for **this site** and recreates it with elevated Data Collections API if missing (fixes install-time CMS race — no reinstall)
- If primary create still fails, the app creates/uses backup `OowSettings` or legacy `OrderWhatsAppSettings`

This collection is normally created when OrderWhatsApp is installed or updated, via the **Data Collections extension**:

- Extension: [`src/extensions/backend/data-collections/data-collections.extension.ts`](../src/extensions/backend/data-collections/data-collections.extension.ts)
- Schema: [`src/extensions/backend/data-collections/settings.ts`](../src/extensions/backend/data-collections/settings.ts)
- Dev Center JSON reference: [`docs/data-collections-extension.json`](data-collections-extension.json)

### Dev Center (one-time)

1. **Dependencies:** add **Wix CMS (Content Manager)** as an app dependency (required — without it, the Data Collections extension cannot create collections at install).
2. **Extensions:** confirm the Data Collections extension is registered (from `src/extensions.ts` after release, or paste [`data-collections-extension.json`](data-collections-extension.json) in Dev Center → Develop → Extensions → Data Collections).
3. **Release** a new app version (`npm.cmd run build` → `npm.cmd run release`).
4. On each site: **update** OrderWhatsApp (reinstall only if update fails). Wait up to ~5 minutes for the collection to appear.
5. Open the app dashboard (preview URL or `npm.cmd run dev` → **`D`**) and **Save**.

If Save says storage is still setting up, click **Retry** (runtime self-heal creates `OowSettings` when the app collection is missing), then Save again — do **not** reinstall as the first step.

No manual field setup is required for new installs. Older sites that never got `@…/settings` are healed by **Retry/Save**, which creates the `OowSettings` backup collection.

### Affected merchants (Save / storage banner)

Tell them:

1. **Update** OrderWhatsApp to the latest version on their site.
2. Open **Apps → Order on WhatsApp**.
3. Click **Retry**, then **Save**.

The update + Retry creates an `OowSettings` backup collection when `@…/settings` was never provisioned (install race / pre-extension installs). Merchants do **not** create namespaces or CMS fields by hand.

## Show the button on the Product Page

1. Plugins are usually **auto-added** on install (`autoAddToSite`).
2. Open the **Editor** → Product Page → Plugins and confirm **Order on WhatsApp — Product** is present. Add it once only if missing.
3. In the app dashboard, under **Where to show the button**, choose **All products** or **Selected products only**.
4. Under **Product page layout**, choose **Before Add to Cart** or **After Add to Cart**, and optionally turn on **Hide Add to Cart**.
5. Keep **Enabled** on and a valid WhatsApp number saved.
6. **Publish** the site — required for shoppers to see the button.

For the cart button: side cart Plugins should include **Order on WhatsApp — Cart** (usually auto-added; add once if missing). It respects the same product selection for cart line items.

### “This is a Custom Element” on the published site

That placeholder means the live site cannot load your plugin code yet.

- **While developing:** keep `npm.cmd run dev` running and open the site from the CLI menu (Editor / Site preview). Do **not** judge the public published URL during local-only work — it only talks to a released app build.
- **For the real published site:** release the app, then publish the site:

```powershell
cd e:\wix-development\Order-on-whatsapp-wix
npm.cmd run build
npm.cmd run release
```

After release, update OrderWhatsApp on the site if prompted, then **Publish** the site again. The WhatsApp button should replace the placeholder.

## Verify

```powershell
cd e:\wix-development\Order-on-whatsapp-wix
npm.cmd run typecheck
npm.cmd run build
npm.cmd run release
```

Then update the app on the site, open the dashboard (`npm.cmd run dev` → **`D`**), Save, open Editor to confirm the plugin, and **Publish**.
