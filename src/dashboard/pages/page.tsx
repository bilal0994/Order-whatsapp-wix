import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Cell,
  FormField,
  Input,
  InputArea,
  Layout,
  Loader,
  Page,
  Text,
  ToggleSwitch,
  Dropdown,
  MultiSelectCheckbox,
} from '@wix/design-system';
import { dashboard } from '@wix/dashboard';
import {
  getSettings,
  ensureStorage,
  saveSettings,
} from '../../backend/settings.web';
import { getPlanStatus } from '../../backend/billing.web';
import type {
  AppSettings,
  ButtonPosition,
  FormFieldConfig,
  FormFieldType,
  PlanStatus,
  ProductVisibility,
  StorageHealth,
} from '../../types';
import {
  SUPPORT_WHATSAPP_MESSAGE,
  SUPPORT_WHATSAPP_NUMBER,
  type DefaultOrderStatus,
} from '../../consts';
import {
  buildWhatsAppUrl,
  defaultSettings,
  isValidWhatsAppNumber,
} from '../../shared/whatsapp';
import {
  DEFAULT_MESSAGE_TEMPLATE,
  isCoreFormFieldId,
  newFormFieldId,
} from '../../shared/formConfig';
import { extractErrorMessage } from '../../shared/errorMessage';
import { listProductsForSelect } from '../../shared/catalog';
import { withProviders } from '../withProviders';

const SUPPORT_WHATSAPP_URL = buildWhatsAppUrl(
  SUPPORT_WHATSAPP_NUMBER,
  SUPPORT_WHATSAPP_MESSAGE
);

const STATUS_OPTIONS: { id: DefaultOrderStatus; value: string }[] = [
  { id: 'NOT_PAID', value: 'Not paid (pending)' },
  { id: 'PAID', value: 'Paid' },
  { id: 'PARTIALLY_PAID', value: 'Partially paid' },
];

const VISIBILITY_OPTIONS: { id: ProductVisibility; value: string }[] = [
  { id: 'all', value: 'All products' },
  { id: 'selected', value: 'Selected products only' },
];

const POSITION_OPTIONS: { id: ButtonPosition; value: string }[] = [
  { id: 'before-add-to-cart', value: 'Before Add to Cart' },
  { id: 'after-add-to-cart', value: 'After Add to Cart' },
];

const FIELD_TYPE_OPTIONS: { id: FormFieldType; value: string }[] = [
  { id: 'text', value: 'Text' },
  { id: 'tel', value: 'Phone' },
  { id: 'textarea', value: 'Long text' },
  { id: 'select', value: 'Dropdown (options)' },
];

function mapSaveToastMessage(rawMessage: string): string {
  if (rawMessage.includes('Upgrade to a paid plan')) return rawMessage;
  if (rawMessage.includes('WDE0110') || rawMessage.includes('CMS app is not installed')) {
    return 'Wix CMS is not installed on this site. Add CMS (Content Manager), then try Save again.';
  }
  if (
    rawMessage.includes('still setting up') ||
    rawMessage.includes('WDE0025') ||
    rawMessage.toLowerCase().includes('does not exist')
  ) {
    return 'Settings storage is still setting up. Wait about a minute, then try Save again.';
  }
  if (
    rawMessage.includes('WDE0027') ||
    rawMessage.toLowerCase().includes('does not have permissions')
  ) {
    return 'Settings storage permissions are not ready yet. Wait a minute and try Save again.';
  }
  if (
    rawMessage.includes('buttonPosition') ||
    rawMessage.includes('hideAddToCart') ||
    rawMessage.includes('selectedProductIds') ||
    rawMessage.toLowerCase().includes('unknown field') ||
    rawMessage.toLowerCase().includes('do not match')
  ) {
    return 'Settings collection fields do not match this app version. Wait for the latest update to finish installing, then try Save again.';
  }
  if (rawMessage.includes('"code": 403') || /\b403\b/.test(rawMessage)) {
    return `Permission denied saving settings. ${rawMessage.slice(0, 140)}`;
  }
  // Show real write errors (do not replace with generic CMS text).
  if (
    rawMessage.startsWith('Save write failed') ||
    rawMessage.startsWith('Write to ') ||
    rawMessage.includes('Unable to handle the request')
  ) {
    return rawMessage.slice(0, 280);
  }
  return rawMessage || 'Failed to save settings.';
}

function editorUrlForSite(siteId?: string): string | undefined {
  if (!siteId) return undefined;
  return `https://manage.wix.com/studio/${siteId}/editor`;
}

function SettingsPage() {
  const { showToast } = dashboard;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingStorage, setCheckingStorage] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings());
  const [productOptions, setProductOptions] = useState<
    { id: string; value: string }[]
  >([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [storage, setStorage] = useState<StorageHealth | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const refreshStorageHealth = useCallback(async (opts?: { quiet?: boolean }) => {
    setCheckingStorage(true);
    try {
      // Cap wait so Retry never sticks on "Checking…" if a CMS call hangs.
      const health = await Promise.race([
        ensureStorage(),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 25000);
        }),
      ]);
      if (!health) {
        setStorage({
          ready: false,
          primaryOk: false,
          legacyOk: false,
          cmsMissing: false,
          detail:
            'Storage check timed out. Confirm Manage Data Collections permission, then Retry.',
        });
        if (!opts?.quiet) {
          showToast({
            message:
              'Storage check timed out. Add Manage Data Collections on the app, then Retry.',
            type: 'error',
          });
        }
        return null;
      }
      setStorage(health);
      if (!opts?.quiet) {
        if (health.ready) {
          showToast({
            message: 'Settings storage is ready. You can Save now.',
            type: 'success',
          });
        } else if (health.cmsMissing) {
          showToast({
            message:
              'Wix CMS is not installed on this site. Add CMS (Content Manager), then Retry.',
            type: 'error',
          });
        } else {
          const bits = [
            health.primaryDetail ? `app:${health.primaryDetail.slice(0, 60)}` : '',
            health.backupDetail ? `backup:${health.backupDetail.slice(0, 60)}` : '',
            health.legacyDetail ? `legacy:${health.legacyDetail.slice(0, 60)}` : '',
          ].filter(Boolean);
          showToast({
            message:
              (health.detail ||
                'Storage still not ready. Wait a minute and Retry again.') +
              (bits.length ? ` (${bits.join('; ')})` : ''),
            type: 'warning',
          });
        }
      }
      return health;
    } catch {
      setStorage({
        ready: false,
        primaryOk: false,
        legacyOk: false,
        cmsMissing: false,
        detail: 'Could not check settings storage. Try Save again in a minute.',
      });
      if (!opts?.quiet) {
        showToast({
          message: 'Could not set up settings storage. Try Retry again.',
          type: 'error',
        });
      }
      return null;
    } finally {
      setCheckingStorage(false);
    }
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    // Self-heal on every dashboard open: recreate missing app collection for this site.
    Promise.all([
      getSettings(),
      getPlanStatus(),
      ensureStorage().catch(() => null),
    ])
      .then(([data, planStatus, health]) => {
        if (cancelled) return;
        setSettings(data);
        setPlan(planStatus);
        if (health) setStorage(health);
      })
      .catch(() => {
        if (!cancelled) {
          showToast({
            message: 'Could not load settings. Showing defaults.',
            type: 'warning',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    setProductsLoading(true);
    listProductsForSelect(100)
      .then((options) => {
        if (!cancelled) setProductOptions(options);
      })
      .catch(() => {
        if (!cancelled) {
          setProductOptions([]);
          showToast({
            message:
              'Could not load products. Check Catalog Read Limited + Read Products (V1) and Product Read (V3) on OrderWhatsApp.',
            type: 'warning',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const onSave = useCallback(async () => {
    if (!plan?.isPaid) {
      showToast({
        message: 'Upgrade to a paid plan to use Order on WhatsApp.',
        type: 'error',
      });
      return;
    }
    if (settings.enabled && !isValidWhatsAppNumber(settings.whatsappNumber)) {
      showToast({
        message: 'Enter a valid WhatsApp number with country code before enabling.',
        type: 'error',
      });
      return;
    }
    if (!settings.buttonText.trim()) {
      showToast({ message: 'Button text is required.', type: 'error' });
      return;
    }
    if (
      settings.productVisibility === 'selected' &&
      settings.selectedProductIds.length === 0
    ) {
      showToast({
        message: 'Select at least one product, or choose “All products”.',
        type: 'error',
      });
      return;
    }

    setSaving(true);
    try {
      const result = await saveSettings(settings);
      if (!result.ok) {
        showToast({
          message: result.error.slice(0, 280),
          type: 'error',
        });
        return;
      }
      setSettings(result.settings);
      setJustSaved(true);
      setStorage((prev) =>
        prev
          ? { ...prev, ready: true, detail: '' }
          : {
              ready: true,
              primaryOk: true,
              legacyOk: false,
              cmsMissing: false,
              detail: '',
            }
      );
      showToast({ message: 'Settings saved.', type: 'success' });
    } catch (error) {
      const rawMessage = extractErrorMessage(error);
      showToast({
        message: mapSaveToastMessage(rawMessage).slice(0, 280),
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  }, [settings, showToast, plan]);

  if (loading) {
    return (
      <Page height="100vh">
        <Page.Content>
          <Box align="center" verticalAlign="middle" height="40vh">
            <Loader size="medium" />
          </Box>
        </Page.Content>
      </Page>
    );
  }

  const missingNumber = !settings.whatsappNumber.trim();
  const locked = !plan?.isPaid;
  const upgradeUrl =
    plan?.upgradeUrl ||
    'https://www.wix.com/apps/upgrade/bded4014-20be-4629-800e-a78f0c368703';
  const editorUrl = editorUrlForSite(plan?.siteId);
  const showGoLive =
    !locked &&
    (justSaved ||
      (isValidWhatsAppNumber(settings.whatsappNumber) && settings.enabled));
  const storageNotReady = Boolean(storage && !storage.ready && !locked);

  return (
    <Page height="100vh">
      <Page.Header
        title="Order on WhatsApp"
        subtitle="Let shoppers place orders from your store via WhatsApp."
        actionsBar={
          locked ? (
            <Button as="a" href={upgradeUrl} target="_blank">
              Upgrade
            </Button>
          ) : (
            <Button onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )
        }
      />
      <Page.Content>
        <Layout>
          <Cell span={8}>
            {locked && (
              <Box marginBottom="SP4">
                <Card>
                  <Card.Content>
                    <Box direction="vertical" gap="12px">
                      <Text>
                        Upgrade to a paid plan to use Order on WhatsApp. Settings,
                        the storefront button, and order creation stay locked until
                        you subscribe.
                      </Text>
                      <Box>
                        <Button as="a" href={upgradeUrl} target="_blank">
                          Upgrade
                        </Button>
                      </Box>
                    </Box>
                  </Card.Content>
                </Card>
              </Box>
            )}

            {storageNotReady && (
              <Box marginBottom="SP4">
                <Card>
                  <Card.Content>
                    <Box direction="vertical" gap="12px">
                      <Text>
                        {storage?.cmsMissing
                          ? 'Wix CMS is not installed on this site. Add CMS (Content Manager), then click Retry.'
                          : storage?.detail ||
                            'Settings storage is still setting up — click Retry to create it, then Save.'}
                      </Text>
                      <Box>
                        <Button
                          onClick={() => void refreshStorageHealth()}
                          disabled={checkingStorage}
                          priority="secondary"
                        >
                          {checkingStorage ? 'Checking…' : 'Retry'}
                        </Button>
                      </Box>
                    </Box>
                  </Card.Content>
                </Card>
              </Box>
            )}

            {missingNumber && !locked && (
              <Box marginBottom="SP4">
                <Card>
                  <Card.Content>
                    <Text>
                      Add your WhatsApp number (with country code) to finish setup.
                      Until then, the storefront button stays disabled.
                    </Text>
                  </Card.Content>
                </Card>
              </Box>
            )}

            {showGoLive && (
              <Box marginBottom="SP4">
                <Card>
                  <Card.Header title="Go live" />
                  <Card.Divider />
                  <Card.Content>
                    <Box direction="vertical" gap="8px">
                      <Text>
                        1. Product and side-cart plugins are usually auto-added
                        when you install the app.
                      </Text>
                      <Text>
                        2. Open the Editor → Cart page → Add Elements → Apps →
                        add “Order on WhatsApp — Cart Page” near Checkout (Wix
                        has no auto slot for the full Cart page).
                      </Text>
                      <Text>
                        3. Publish the site — required for the button to appear
                        for shoppers.
                      </Text>
                      {editorUrl && (
                        <Box marginTop="SP2">
                          <Button as="a" href={editorUrl} target="_blank" priority="secondary">
                            Open Editor
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </Card.Content>
                </Card>
              </Box>
            )}

            <Box marginBottom="SP4">
              <Card>
                <Card.Header title="Need help?" />
                <Card.Divider />
                <Card.Content>
                  <Box direction="vertical" gap="12px">
                    <Text>
                      Questions about setup or the storefront button? Chat with
                      support on WhatsApp.
                    </Text>
                    <Box>
                      <Button
                        as="a"
                        href={SUPPORT_WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        priority="secondary"
                      >
                        Contact Support Now
                      </Button>
                    </Box>
                  </Box>
                </Card.Content>
              </Card>
            </Box>

            <Card>
              <Card.Header title="WhatsApp" />
              <Card.Divider />
              <Card.Content>
                <Layout gap="24px">
                  <Cell span={12}>
                    <FormField
                      label="WhatsApp number"
                      required
                      infoContent="Include country code. Example: +15551234567"
                    >
                      <Input
                        value={settings.whatsappNumber}
                        placeholder="+15551234567"
                        disabled={locked}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            whatsappNumber: e.target.value,
                          }))
                        }
                      />
                    </FormField>
                  </Cell>
                  <Cell span={12}>
                    <FormField label="Enable Order on WhatsApp" labelPlacement="left" labelWidth="1fr">
                      <ToggleSwitch
                        checked={settings.enabled}
                        disabled={locked}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            enabled: e.target.checked,
                          }))
                        }
                      />
                    </FormField>
                  </Cell>
                </Layout>
              </Card.Content>
            </Card>

            <Box marginTop="SP4">
              <Card>
                <Card.Header
                  title="Where to show the button"
                  subtitle="Choose product pages and/or cart. Plugins are usually auto-added on install. Publish the site after saving."
                />
                <Card.Divider />
                <Card.Content>
                  <Layout gap="24px">
                    <Cell span={12}>
                      <FormField
                        label="Show on product pages"
                        labelPlacement="left"
                        labelWidth="1fr"
                      >
                        <ToggleSwitch
                          checked={settings.showOnProductPages !== false}
                          disabled={locked}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              showOnProductPages: e.target.checked,
                            }))
                          }
                        />
                      </FormField>
                    </Cell>
                    <Cell span={12}>
                      <FormField
                        label="Show on cart"
                        labelPlacement="left"
                        labelWidth="1fr"
                        infoContent="Shows the button in the side cart (auto). For the full Cart page, add the Cart Page widget in the Editor once. Sends all eligible cart items to WhatsApp."
                      >
                        <ToggleSwitch
                          checked={settings.showOnCart !== false}
                          disabled={locked}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              showOnCart: e.target.checked,
                            }))
                          }
                        />
                      </FormField>
                    </Cell>
                    <Cell span={12}>
                      <FormField label="Show on">
                        <Dropdown
                          selectedId={settings.productVisibility}
                          options={VISIBILITY_OPTIONS}
                          disabled={locked || settings.showOnProductPages === false}
                          onSelect={(option) => {
                            if (option?.id) {
                              setSettings((s) => ({
                                ...s,
                                productVisibility: option.id as ProductVisibility,
                              }));
                            }
                          }}
                        />
                      </FormField>
                    </Cell>
                    {settings.productVisibility === 'selected' &&
                      settings.showOnProductPages !== false && (
                      <Cell span={12}>
                        <FormField
                          label="Products"
                          required
                          infoContent="Select the products that should show the Order on WhatsApp button."
                        >
                          {productsLoading ? (
                            <Loader size="tiny" />
                          ) : (
                            <MultiSelectCheckbox
                              placeholder="Select products"
                              options={productOptions}
                              selectedOptions={settings.selectedProductIds}
                              enableSearch
                              disabled={locked}
                              emptyStateMessage="No products found"
                              onSelect={(id) => {
                                const productId = String(id);
                                setSettings((s) => ({
                                  ...s,
                                  selectedProductIds: s.selectedProductIds.includes(
                                    productId
                                  )
                                    ? s.selectedProductIds
                                    : [...s.selectedProductIds, productId],
                                }));
                              }}
                              onDeselect={(id) => {
                                const productId = String(id);
                                setSettings((s) => ({
                                  ...s,
                                  selectedProductIds: s.selectedProductIds.filter(
                                    (x) => x !== productId
                                  ),
                                }));
                              }}
                            />
                          )}
                        </FormField>
                      </Cell>
                    )}
                  </Layout>
                </Card.Content>
              </Card>
            </Box>

            <Box marginTop="SP4">
              <Card>
                <Card.Header title="Button appearance" />
                <Card.Divider />
                <Card.Content>
                  <Layout gap="24px">
                    <Cell span={12}>
                      <FormField label="Button text" required>
                        <Input
                          value={settings.buttonText}
                          disabled={locked}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              buttonText: e.target.value,
                            }))
                          }
                        />
                      </FormField>
                    </Cell>
                    <Cell span={12}>
                      <FormField
                        label="Button color"
                        infoContent="Hex color, e.g. #25D366"
                      >
                        <Box gap="12px" verticalAlign="middle">
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 4,
                              backgroundColor: settings.buttonColor || '#25D366',
                              border: '1px solid #ccc',
                              flex: 'none',
                            }}
                          />
                          <Input
                            value={settings.buttonColor}
                            placeholder="#25D366"
                            disabled={locked}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                buttonColor: e.target.value,
                              }))
                            }
                          />
                        </Box>
                      </FormField>
                    </Cell>
                  </Layout>
                </Card.Content>
              </Card>
            </Box>

            <Box marginTop="SP4">
              <Card>
                <Card.Header
                  title="Product page layout"
                  subtitle="Controls where the WhatsApp button appears relative to Add to Cart, and whether the native cart buttons stay visible."
                />
                <Card.Divider />
                <Card.Content>
                  <Layout gap="24px">
                    <Cell span={12}>
                      <FormField
                        label="Button position"
                        infoContent="Moves the WhatsApp button before or after the Add to Cart button on the product page."
                      >
                        <Dropdown
                          selectedId={settings.buttonPosition}
                          options={POSITION_OPTIONS}
                          disabled={locked}
                          onSelect={(option) => {
                            if (option?.id) {
                              setSettings((s) => ({
                                ...s,
                                buttonPosition: option.id as ButtonPosition,
                              }));
                            }
                          }}
                        />
                      </FormField>
                    </Cell>
                    <Cell span={12}>
                      <FormField
                        label="Hide Add to Cart"
                        labelPlacement="left"
                        labelWidth="1fr"
                        infoContent="Hides Add to Cart and Buy Now so shoppers only see Order on WhatsApp."
                      >
                        <ToggleSwitch
                          checked={settings.hideAddToCart}
                          disabled={locked}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              hideAddToCart: e.target.checked,
                            }))
                          }
                        />
                      </FormField>
                    </Cell>
                  </Layout>
                </Card.Content>
              </Card>
            </Box>

            <Box marginTop="SP4">
              <Card>
                <Card.Header
                  title="WhatsApp form settings"
                  subtitle="Customize the checkout popup fields, submit button, and the WhatsApp message shoppers send."
                />
                <Card.Divider />
                <Card.Content>
                  <Layout gap="24px">
                    <Cell span={12}>
                      <FormField label="Form title">
                        <Input
                          value={settings.formTitle}
                          disabled={locked}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              formTitle: e.target.value,
                            }))
                          }
                        />
                      </FormField>
                    </Cell>
                    <Cell span={12}>
                      <FormField label="Submit button text">
                        <Input
                          value={settings.formSubmitText}
                          disabled={locked}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              formSubmitText: e.target.value,
                            }))
                          }
                        />
                      </FormField>
                    </Cell>
                    <Cell span={12}>
                      <Text size="small" secondary>
                        Form fields (name, phone, and address are required for
                        Wix orders — you can rename them but not remove them)
                      </Text>
                    </Cell>
                    {(settings.formFields || []).map((field, index) => (
                      <Cell key={field.id} span={12}>
                        <Box
                          direction="vertical"
                          gap="12px"
                        >
                          <div
                            style={{
                              border: '1px solid #e5e7eb',
                              borderRadius: 8,
                              padding: 12,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 12,
                            }}
                          >
                          <FormField label={`Field label`}>
                            <Input
                              value={field.label}
                              disabled={locked}
                              onChange={(e) => {
                                const label = e.target.value;
                                setSettings((s) => ({
                                  ...s,
                                  formFields: s.formFields.map((f, i) =>
                                    i === index ? { ...f, label } : f
                                  ),
                                }));
                              }}
                            />
                          </FormField>
                          <FormField label="Type">
                            <Dropdown
                              selectedId={field.type}
                              options={FIELD_TYPE_OPTIONS}
                              disabled={locked || isCoreFormFieldId(field.id)}
                              onSelect={(option) => {
                                if (!option?.id) return;
                                const type = option.id as FormFieldType;
                                setSettings((s) => ({
                                  ...s,
                                  formFields: s.formFields.map((f, i) =>
                                    i === index
                                      ? {
                                          ...f,
                                          type,
                                          options:
                                            type === 'select'
                                              ? f.options?.length
                                                ? f.options
                                                : ['Option 1', 'Option 2']
                                              : undefined,
                                        }
                                      : f
                                  ),
                                }));
                              }}
                            />
                          </FormField>
                          {field.type === 'select' && (
                            <FormField
                              label="Options"
                              infoContent="Comma-separated list, e.g. Pickup, Delivery"
                            >
                              <Input
                                value={(field.options || []).join(', ')}
                                disabled={locked}
                                onChange={(e) => {
                                  const options = e.target.value
                                    .split(',')
                                    .map((o) => o.trim())
                                    .filter(Boolean);
                                  setSettings((s) => ({
                                    ...s,
                                    formFields: s.formFields.map((f, i) =>
                                      i === index ? { ...f, options } : f
                                    ),
                                  }));
                                }}
                              />
                            </FormField>
                          )}
                          <FormField
                            label="Required"
                            labelPlacement="left"
                            labelWidth="1fr"
                          >
                            <ToggleSwitch
                              checked={field.required}
                              disabled={
                                locked ||
                                field.id === 'name' ||
                                field.id === 'phone' ||
                                field.id === 'address'
                              }
                              onChange={(e) => {
                                const required = e.target.checked;
                                setSettings((s) => ({
                                  ...s,
                                  formFields: s.formFields.map((f, i) =>
                                    i === index ? { ...f, required } : f
                                  ),
                                }));
                              }}
                            />
                          </FormField>
                          {!isCoreFormFieldId(field.id) && (
                            <Box>
                              <Button
                                size="small"
                                priority="secondary"
                                disabled={locked}
                                onClick={() =>
                                  setSettings((s) => ({
                                    ...s,
                                    formFields: s.formFields.filter(
                                      (_, i) => i !== index
                                    ),
                                  }))
                                }
                              >
                                Remove field
                              </Button>
                            </Box>
                          )}
                          </div>
                        </Box>
                      </Cell>
                    ))}
                    <Cell span={12}>
                      <Button
                        priority="secondary"
                        disabled={locked}
                        onClick={() => {
                          const next: FormFieldConfig = {
                            id: newFormFieldId(),
                            label: 'New field',
                            type: 'text',
                            required: false,
                          };
                          setSettings((s) => ({
                            ...s,
                            formFields: [...(s.formFields || []), next],
                          }));
                        }}
                      >
                        Add field
                      </Button>
                    </Cell>
                    <Cell span={12}>
                      <FormField
                        label="WhatsApp order message"
                        infoContent="Use placeholders: {{orderId}}, {{items}}, {{customerName}}, {{phone}}, {{address}}, {{notes}}, {{notesLine}}, {{customFields}}, or {{field:fieldId}}"
                      >
                        <InputArea
                          value={settings.messageTemplate}
                          disabled={locked}
                          rows={8}
                          maxHeight="280px"
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              messageTemplate: e.target.value,
                            }))
                          }
                        />
                      </FormField>
                      <Box marginTop="SP2">
                        <Button
                          size="tiny"
                          priority="secondary"
                          disabled={locked}
                          onClick={() =>
                            setSettings((s) => ({
                              ...s,
                              messageTemplate: DEFAULT_MESSAGE_TEMPLATE,
                            }))
                          }
                        >
                          Reset message to default
                        </Button>
                      </Box>
                    </Cell>
                  </Layout>
                </Card.Content>
              </Card>
            </Box>

            <Box marginTop="SP4">
              <Card>
                <Card.Header title="Orders" />
                <Card.Divider />
                <Card.Content>
                  <FormField
                    label="Default payment status"
                    infoContent="New WhatsApp orders appear in Wix Stores with this payment status."
                  >
                    <Dropdown
                      selectedId={settings.defaultOrderStatus}
                      options={STATUS_OPTIONS}
                      disabled={locked}
                      onSelect={(option) => {
                        if (option?.id) {
                          setSettings((s) => ({
                            ...s,
                            defaultOrderStatus: option.id as DefaultOrderStatus,
                          }));
                        }
                      }}
                    />
                  </FormField>
                </Card.Content>
              </Card>
            </Box>
          </Cell>
        </Layout>
      </Page.Content>
    </Page>
  );
}

export default withProviders(SettingsPage);
