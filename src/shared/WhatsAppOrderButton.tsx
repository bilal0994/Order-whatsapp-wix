import React, { type CSSProperties, type FC } from 'react';

type Props = {
  text: string;
  color: string;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
};

export const WhatsAppOrderButton: FC<Props> = ({
  text,
  color,
  disabled,
  loading,
  onClick,
}) => {
  const style: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    border: 'none',
    borderRadius: 8,
    padding: '10px 14px',
    background: disabled ? '#9aa0a6' : color || '#25D366',
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.75 : 1,
    fontFamily:
      'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  };

  return (
    <button
      type="button"
      style={style}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={text}
    >
      {loading ? 'Loading…' : text}
    </button>
  );
};
