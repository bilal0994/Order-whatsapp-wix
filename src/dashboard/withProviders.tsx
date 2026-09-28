import React, { type ComponentType } from 'react';
import { WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';

export function withProviders<P extends object>(Component: ComponentType<P>) {
  return function Wrapped(props: P) {
    return (
      <WixDesignSystemProvider features={{ newColorsBranding: true }}>
        <Component {...props} />
      </WixDesignSystemProvider>
    );
  };
}
