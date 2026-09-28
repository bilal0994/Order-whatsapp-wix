import type {
  AppSettings,
  CheckoutCustomer,
  FormFieldConfig,
  FormFieldType,
  OrderLineItemInput,
} from '../types';

export const CORE_FORM_FIELD_IDS = ['name', 'phone', 'address', 'notes'] as const;
export type CoreFormFieldId = (typeof CORE_FORM_FIELD_IDS)[number];

export const DEFAULT_FORM_TITLE = 'Order on WhatsApp';
export const DEFAULT_FORM_SUBMIT_TEXT = 'Place order & open WhatsApp';

export const DEFAULT_MESSAGE_TEMPLATE = [
  'New WhatsApp order',
  'Order ID: {{orderId}}',
  '',
  'Items:',
  '{{items}}',
  '',
  'Customer: {{customerName}}',
  'Phone: {{phone}}',
  'Address: {{address}}',
  '{{notesLine}}',
  '{{customFields}}',
].join('\n');

export function defaultFormFields(): FormFieldConfig[] {
  return [
    { id: 'name', label: 'Full name', type: 'text', required: true },
    { id: 'phone', label: 'Phone', type: 'tel', required: true },
    { id: 'address', label: 'Address', type: 'text', required: true },
    { id: 'notes', label: 'Notes', type: 'textarea', required: false },
  ];
}

export function newFormFieldId(): string {
  return `field_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function isCoreFormFieldId(id: string): id is CoreFormFieldId {
  return (CORE_FORM_FIELD_IDS as readonly string[]).includes(id);
}

export function parseFormFields(raw: unknown): FormFieldConfig[] {
  let parsed: unknown = raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return defaultFormFields();
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return defaultFormFields();
  }

  const fields: FormFieldConfig[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id || '').trim();
    const label = String(row.label || '').trim();
    if (!id || !label) continue;
    const type = normalizeFieldType(row.type);
    const required = row.required === true;
    const options = Array.isArray(row.options)
      ? row.options.map(String).map((o) => o.trim()).filter(Boolean)
      : typeof row.options === 'string'
        ? row.options
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;
    fields.push({
      id,
      label,
      type,
      required,
      ...(type === 'select' ? { options: options?.length ? options : ['Option 1'] } : {}),
    });
  }

  return fields.length ? fields : defaultFormFields();
}

function normalizeFieldType(value: unknown): FormFieldType {
  if (value === 'textarea' || value === 'select' || value === 'tel') return value;
  return 'text';
}

export function emptyFormValues(fields: FormFieldConfig[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    values[field.id] = '';
  }
  return values;
}

/** Build CheckoutCustomer from dynamic form values. */
export function customerFromFormValues(
  fields: FormFieldConfig[],
  values: Record<string, string>
): CheckoutCustomer {
  const customFields: Record<string, string> = {};
  for (const field of fields) {
    if (isCoreFormFieldId(field.id)) continue;
    const v = (values[field.id] || '').trim();
    if (v) customFields[field.id] = v;
  }

  return {
    name: (values.name || '').trim(),
    phone: (values.phone || '').trim(),
    address: (values.address || '').trim(),
    notes: (values.notes || '').trim(),
    customFields: Object.keys(customFields).length ? customFields : undefined,
    customFieldLabels: Object.fromEntries(
      fields
        .filter((f) => !isCoreFormFieldId(f.id))
        .map((f) => [f.id, f.label])
    ),
  };
}

export function validateFormValues(
  fields: FormFieldConfig[],
  values: Record<string, string>
): string | null {
  for (const field of fields) {
    if (!field.required) continue;
    if (!(values[field.id] || '').trim()) {
      return `${field.label} is required.`;
    }
  }
  // Always require contact basics for Wix order creation when present in form.
  if (fields.some((f) => f.id === 'name') && !(values.name || '').trim()) {
    return 'Full name is required.';
  }
  if (fields.some((f) => f.id === 'phone') && !(values.phone || '').trim()) {
    return 'Phone is required.';
  }
  if (fields.some((f) => f.id === 'address') && !(values.address || '').trim()) {
    return 'Address is required.';
  }
  return null;
}

function formatItemsBlock(
  lineItems: OrderLineItemInput[],
  currency?: string
): string {
  return lineItems
    .map((item) => {
      const opts = item.options
        ? ` (${Object.entries(item.options)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')})`
        : '';
      const priceLabel = currency ? `${item.price} ${currency}` : item.price;
      return `• ${item.productName}${opts} × ${item.quantity} — ${priceLabel}`;
    })
    .join('\n');
}

function formatCustomFieldsBlock(customer: CheckoutCustomer): string {
  const entries = Object.entries(customer.customFields || {});
  if (!entries.length) return '';
  return entries
    .map(([id, value]) => {
      const label = customer.customFieldLabels?.[id] || id;
      return `${label}: ${value}`;
    })
    .join('\n');
}

/** Replace {{placeholders}} in the merchant message template. */
export function renderMessageTemplate(
  template: string,
  params: {
    orderId: string;
    customer: CheckoutCustomer;
    lineItems: OrderLineItemInput[];
    currency?: string;
    formFields?: FormFieldConfig[];
  }
): string {
  const { orderId, customer, lineItems, currency, formFields } = params;
  const notes = customer.notes?.trim() || '';
  const notesLine = notes ? `Notes: ${notes}` : '';
  const customBlock = formatCustomFieldsBlock(customer);

  const map: Record<string, string> = {
    orderId,
    customerName: customer.name,
    phone: customer.phone,
    address: customer.address,
    notes,
    notesLine,
    items: formatItemsBlock(lineItems, currency),
    customFields: customBlock,
  };

  // Per-field placeholders: {{field:name}}, {{field:<id>}}
  for (const field of formFields || []) {
    if (isCoreFormFieldId(field.id)) {
      map[`field:${field.id}`] =
        field.id === 'name'
          ? customer.name
          : field.id === 'phone'
            ? customer.phone
            : field.id === 'address'
              ? customer.address
              : notes;
    } else {
      map[`field:${field.id}`] = customer.customFields?.[field.id] || '';
    }
  }

  let out = (template || DEFAULT_MESSAGE_TEMPLATE).replace(
    /\{\{\s*([a-zA-Z0-9_:]+)\s*\}\}/g,
    (_, key: string) => (key in map ? map[key] : '')
  );

  // Drop empty leftover blank lines from optional blocks.
  out = out
    .split('\n')
    .filter((line, i, arr) => {
      if (line.trim() !== '') return true;
      const prev = arr[i - 1];
      const next = arr[i + 1];
      return prev !== undefined && next !== undefined && prev.trim() !== '' && next.trim() !== '';
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return out;
}

export function normalizeFormSettings(
  partial: Partial<AppSettings> | null | undefined
): Pick<
  AppSettings,
  'formTitle' | 'formSubmitText' | 'formFields' | 'messageTemplate'
> {
  return {
    formTitle: (partial?.formTitle || '').trim() || DEFAULT_FORM_TITLE,
    formSubmitText:
      (partial?.formSubmitText || '').trim() || DEFAULT_FORM_SUBMIT_TEXT,
    formFields: parseFormFields(partial?.formFields),
    messageTemplate:
      (partial?.messageTemplate || '').trim() || DEFAULT_MESSAGE_TEMPLATE,
  };
}
