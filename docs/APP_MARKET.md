# App Market listing & submission (Phase 5)

## Listing copy

**Name:** Order on WhatsApp

**Tagline:** Let customers order from your Wix Store via WhatsApp in one tap.

**Short description:**  
Add an Order on WhatsApp button to your product pages and cart. Shoppers fill a quick form; a real order appears in Wix Stores and WhatsApp opens with the details ready to send.

**Full description:**

Order on WhatsApp helps Wix Stores merchants who sell over chat.

- Place a branded **Order on WhatsApp** button on product pages and the side cart  
- Collect name, phone, address, and notes in a simple popup  
- Create a matching order in your Wix Stores dashboard  
- Open WhatsApp with a prefilled message for the shopper to send  

Configure your WhatsApp number, button text, and color from the app dashboard. No WhatsApp Business API required for the MVP — we use the standard `wa.me` deep link (the shopper still taps Send).

**Site requirements:** Wix Stores; CMS bundled as an app dependency (settings collection auto-provisioned)

**Category:** Marketing / Sales / Stores  

## Screenshots to capture

1. Dashboard settings page with WhatsApp number filled in  
2. Product page with the Order on WhatsApp button  
3. Checkout popup form open  
4. Side cart with the button above cart actions  
5. Resulting order in Wix Stores Orders  
6. WhatsApp (mobile or Web) with prefilled message  

## Icon

Use [`src/assets/order-whatsapp/site-plugin-logo.svg`](../src/assets/order-whatsapp/site-plugin-logo.svg) as a base; export 256×256 PNG for the App Market.

## Pricing

Paid plan in Dev Center. The app enforces it:

- Unpaid (`isFree: true`): dashboard **Upgrade** button; settings locked; storefront button can show when configured, but order creation is blocked until upgrade.
- Paid or trial (`isFree: false`): full access.

## Testing checklist

- [ ] Unpaid install → dashboard Upgrade CTA; settings locked; order creation blocked
- [ ] Paid / trial → settings save and WhatsApp button work
- [ ] Mobile: WhatsApp app opens with prefilled text  
- [ ] Desktop: WhatsApp Web / desktop app opens  
- [ ] Product without variants → order creates  
- [ ] Product with required variants → button gated until selection  
- [ ] Side cart with multiple items → all items in order + message  
- [ ] Empty cart → button disabled  
- [ ] Missing WhatsApp number → button disabled / clear empty state in dashboard  
- [ ] Disabled toggle → button disabled on storefront  
- [ ] Invalid number validation on dashboard save  
- [ ] Failed order creation shows error in modal (network / API)  
- [ ] Order appears in Wix Stores with expected payment status  

## Permissions to declare

- Manage Orders — create WhatsApp orders  
- Read Products — product name/price/variants on product page  
- CMS / Data — app-owned settings collection (auto-provisioned on install)

## Submission steps

1. `npm run build`  
2. `npm run release` — create a version in Dev Center  
3. Complete listing assets and privacy policy URL  
4. Submit for Wix App Market review  
5. Budget buffer time for scope/UX feedback from review  

## Known product notes for reviewers

- `wa.me` prefills the chat; it does **not** auto-send (same as typical WooCommerce plugins).  
- One WhatsApp number per site in MVP.  
- Side cart slot height is limited; the form opens as a fixed overlay.
