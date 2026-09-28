import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'settings';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'Order on WhatsApp Settings',
  displayField: 'whatsappNumber',
  fields: [
    { key: 'singletonKey', displayName: 'Singleton Key', type: 'TEXT' },
    { key: 'whatsappNumber', displayName: 'WhatsApp Number', type: 'TEXT' },
    { key: 'buttonText', displayName: 'Button Text', type: 'TEXT' },
    { key: 'buttonColor', displayName: 'Button Color', type: 'TEXT' },
    { key: 'enabled', displayName: 'Enabled', type: 'BOOLEAN' },
    { key: 'defaultOrderStatus', displayName: 'Default Order Status', type: 'TEXT' },
    { key: 'productVisibility', displayName: 'Product Visibility', type: 'TEXT' },
    { key: 'selectedProductIds', displayName: 'Selected Product IDs', type: 'TEXT' },
    { key: 'buttonPosition', displayName: 'Button Position', type: 'TEXT' },
    { key: 'hideAddToCart', displayName: 'Hide Add to Cart', type: 'BOOLEAN' },
    { key: 'showOnProductPages', displayName: 'Show on Product Pages', type: 'BOOLEAN' },
    { key: 'showOnCart', displayName: 'Show on Cart', type: 'BOOLEAN' },
    { key: 'formTitle', displayName: 'Form Title', type: 'TEXT' },
    { key: 'formSubmitText', displayName: 'Form Submit Text', type: 'TEXT' },
    { key: 'formFields', displayName: 'Form Fields', type: 'TEXT' },
    { key: 'messageTemplate', displayName: 'Message Template', type: 'TEXT' },
  ],
  dataPermissions: {
    itemRead: 'PRIVILEGED',
    itemInsert: 'PRIVILEGED',
    itemUpdate: 'PRIVILEGED',
    itemRemove: 'PRIVILEGED',
  },
  indexes: [],
  initialData: [
    {
      fields: {
        singletonKey: 'default',
        whatsappNumber: '',
        buttonText: 'Order on WhatsApp',
        buttonColor: '#25D366',
        enabled: true,
        defaultOrderStatus: 'NOT_PAID',
        productVisibility: 'all',
        selectedProductIds: '[]',
        buttonPosition: 'after-add-to-cart',
        hideAddToCart: false,
        showOnProductPages: true,
        showOnCart: true,
        formTitle: 'Order on WhatsApp',
        formSubmitText: 'Place order & open WhatsApp',
        formFields:
          '[{"id":"name","label":"Full name","type":"text","required":true},{"id":"phone","label":"Phone","type":"tel","required":true},{"id":"address","label":"Address","type":"text","required":true},{"id":"notes","label":"Notes","type":"textarea","required":false}]',
        messageTemplate:
          'New WhatsApp order\nOrder ID: {{orderId}}\n\nItems:\n{{items}}\n\nCustomer: {{customerName}}\nPhone: {{phone}}\nAddress: {{address}}\n{{notesLine}}\n{{customFields}}',
      },
    },
  ],
} satisfies DataCollection;
