import React, { type FC, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import type { CheckoutCustomer, FormFieldConfig } from '../types';
import {
  DEFAULT_FORM_SUBMIT_TEXT,
  DEFAULT_FORM_TITLE,
  customerFromFormValues,
  defaultFormFields,
  emptyFormValues,
  validateFormValues,
} from './formConfig';

type Props = {
  open: boolean;
  title?: string;
  submitText?: string;
  fields?: FormFieldConfig[];
  submitting?: boolean;
  error?: string | null;
  summary?: string;
  onClose: () => void;
  onSubmit: (customer: CheckoutCustomer) => void;
};

export const CheckoutModal: FC<Props> = ({
  open,
  title = DEFAULT_FORM_TITLE,
  submitText = DEFAULT_FORM_SUBMIT_TEXT,
  fields,
  submitting,
  error,
  summary,
  onClose,
  onSubmit,
}) => {
  const formFields =
    fields && fields.length > 0 ? fields : defaultFormFields();
  const [values, setValues] = useState<Record<string, string>>(() =>
    emptyFormValues(formFields)
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, submitting, onClose]);

  useEffect(() => {
    if (open) {
      setValues(emptyFormValues(formFields));
      setLocalError(null);
    }
    // Reset when opening; field list identity from settings is stable enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !mounted) return null;

  const update =
    (id: string) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      setValues((prev) => ({ ...prev, [id]: e.target.value }));
      setLocalError(null);
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validateFormValues(formFields, values);
    if (invalid) {
      setLocalError(invalid);
      return;
    }
    onSubmit(customerFromFormValues(formFields, values));
  };

  const displayError = localError || error;

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 2147483646,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        boxSizing: 'border-box',
        fontFamily:
          'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      }}
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 440,
          maxHeight: 'min(90vh, 640px)',
          overflow: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
          padding: 24,
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            style={{
              border: 'none',
              background: '#f3f4f6',
              width: 32,
              height: 32,
              borderRadius: 999,
              fontSize: 20,
              cursor: submitting ? 'not-allowed' : 'pointer',
              lineHeight: 1,
              color: '#374151',
            }}
          >
            ×
          </button>
        </div>

        {summary && (
          <p
            style={{
              margin: '0 0 18px',
              fontSize: 13,
              color: '#4b5563',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              padding: '10px 12px',
              borderRadius: 10,
            }}
          >
            {summary}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          {formFields.map((field) => {
            const label = `${field.label}${field.required ? ' *' : ''}`;
            if (field.type === 'textarea') {
              return (
                <label key={field.id} style={labelStyle}>
                  {label}
                  <textarea
                    style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                    value={values[field.id] || ''}
                    onChange={update(field.id)}
                    required={field.required}
                  />
                </label>
              );
            }
            if (field.type === 'select') {
              const options = field.options?.length
                ? field.options
                : ['Option 1'];
              return (
                <label key={field.id} style={labelStyle}>
                  {label}
                  <select
                    style={inputStyle}
                    value={values[field.id] || ''}
                    onChange={update(field.id)}
                    required={field.required}
                  >
                    <option value="">Select…</option>
                    {options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }
            return (
              <label key={field.id} style={labelStyle}>
                {label}
                <input
                  style={inputStyle}
                  type={field.type === 'tel' ? 'tel' : 'text'}
                  value={values[field.id] || ''}
                  onChange={update(field.id)}
                  required={field.required}
                  autoComplete={
                    field.id === 'name'
                      ? 'name'
                      : field.id === 'phone'
                        ? 'tel'
                        : field.id === 'address'
                          ? 'street-address'
                          : undefined
                  }
                />
              </label>
            );
          })}

          {displayError && (
            <p style={{ color: '#b00020', fontSize: 13, margin: '0 0 12px' }}>
              {displayError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 10,
              padding: '12px 16px',
              background: '#25D366',
              color: '#fff',
              fontWeight: 600,
              fontSize: 15,
              cursor: submitting ? 'wait' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Placing order…' : submitText}
          </button>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 12,
  color: '#222',
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  boxSizing: 'border-box',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  background: '#fff',
};
