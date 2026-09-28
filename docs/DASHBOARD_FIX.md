# Fix blank dashboard — do this once

Your local project is linked to **OrderWhatsApp** only:

- App ID: `bded4014-20be-4629-800e-a78f0c368703`
- Folder: `Order-on-whatsapp-wix` (this repo)

The blank page happens when the site opens a **different** draft named “Order on WhatsApp”.

## 1. Use OrderWhatsApp on the site

1. Open [Custom Apps](https://manage.wix.com/studio/custom-apps/).
2. Click **OrderWhatsApp** (not the other “Order on WhatsApp” rows).
3. Optional: rename display name to **Order on WhatsApp** (⋯ menu / app settings).
4. Click **Test App** (or Install) and choose **Dev Sitex1940908119**.

On that site’s dashboard:

1. Go to **Apps** (or Manage Apps).
2. **Uninstall / remove** any other **Order on WhatsApp** installs that are not OrderWhatsApp.
3. Confirm only **OrderWhatsApp** (or the renamed name) remains.

## 2. Open the settings page via local CLI

Do **not** click Apps → Order on WhatsApp in the site sidebar for local preview until you release a version.

**Run this in your own Cursor/VS Code terminal** (interactive TTY — required so you can press keys):

```powershell
cd e:\wix-development\Order-on-whatsapp-wix
npm.cmd run dev
```

When you see the menu, press **`D`** (Dashboard). That loads [`src/dashboard/pages/page.tsx`](../src/dashboard/pages/page.tsx).

Canonical App ID (already in `wix.config.json`): `bded4014-20be-4629-800e-a78f0c368703` (**OrderWhatsApp**).

## 3. Permissions (OrderWhatsApp → Permissions)

Add:

- **Manage Orders**
- **Read Products**
- Read Site Properties (optional)

Wait a few minutes after saving, then reload the dashboard from **D**.

## 3b. CMS dependency (required to save settings)

Saving settings uses the app-owned collection `@fayyazaiman6/orderwhatsapp/settings`, auto-created when OrderWhatsApp is installed or updated (Data Collections extension).

On **Dev Sitex1940908119**:

1. In Dev Center → **OrderWhatsApp** → **Dependencies**, add **Wix CMS (Content Manager)**.
2. Release and **update/reinstall** the app on the dev site.
3. Restart `npm.cmd run dev`, press **D**, Save again.

You do **not** need to manually create `OrderWhatsAppSettings` anymore. Legacy manual collections are still read as a fallback until the namespaced collection is provisioned. If Save says storage is still setting up, wait a minute and try again — reinstall is a last resort.

## 4. Cleanup duplicates (optional)

See [`CLEANUP_DRAFTS.md`](CLEANUP_DRAFTS.md): keep **OrderWhatsApp**, delete the other “Order on WhatsApp” drafts, ignore `order-whats-app` folder.
