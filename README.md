# Order on WhatsApp for Wix Stores

Wix App Market MVP: shoppers order from the Product Page or Side Cart via WhatsApp, while a real order is created in Wix Stores.

## Features (MVP)

- **Order on WhatsApp** site plugins on Product Page + Side Cart
- Popup checkout form (name, phone, address, notes)
- Creates an order via Wix eCommerce Orders API
- Opens `wa.me` with a prefilled order summary
- Dashboard settings: WhatsApp number, button text/color, enable toggle, default payment status

## Prerequisites

- Node.js ≥ 20.11 (see `.nvmrc`)
- Wix account + Dev Center access
- Test site with **Wix Stores** and **CMS** installed

## Setup

1. **App is linked** to **OrderWhatsApp** — App ID `bded4014-20be-4629-800e-a78f0c368703` in [`wix.config.json`](wix.config.json). See [`docs/SETUP.md`](docs/SETUP.md).

2. **Blank dashboard?** Follow [`docs/DASHBOARD_FIX.md`](docs/DASHBOARD_FIX.md): use OrderWhatsApp only, then `npm.cmd run dev` and press **`D`**.

3. **Permissions** on OrderWhatsApp — see [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md):

   - Manage Orders
   - Read Products
   - Read Site Properties (optional)

4. **Settings storage**: Auto-provisioned via the Data Collections extension (`@fayyazaiman6/orderwhatsapp/settings`). Bundle **CMS** as an app dependency. See [`docs/SETUP.md`](docs/SETUP.md).

5. Install and run:

   ```bash
   npm install
   npm run dev
   ```

## Project layout

```
src/
  dashboard/pages/          # Settings dashboard
  backend/
    settings.web.ts         # getSettings / saveSettings
    orders.web.ts           # createWhatsAppOrder
    data-collections/       # re-exports extension schema
  extensions/
    backend/data-collections/  # Data Collections extension (auto-provision on install)
  site/plugins/custom-elements/
    product-order-whatsapp/ # Product page plugin
    cart-order-whatsapp/    # Side cart plugin
  shared/                   # Modal, button, WhatsApp helpers
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run release` | Release an app version |
| `npm run typecheck` | TypeScript check |

## App Market

See [docs/APP_MARKET.md](docs/APP_MARKET.md) for listing copy, screenshots checklist, and submission notes.

## Out of scope (future)

Share button, status notifications, multi-number, Pay Now links, per-product rules.
