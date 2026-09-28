import React, { type FC } from 'react';
import { widget } from '@wix/editor';
import { SidePanel, WixDesignSystemProvider, Text } from '@wix/design-system';
import '@wix/design-system/styles.global.css';

const Panel: FC = () => {
  React.useEffect(() => {
    widget.setProp('display-name', 'Order on WhatsApp');
  }, []);

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <SidePanel.Field>
        <Text size="small">
          Appears in the side cart. For the full Cart page, also add the “Order on
          WhatsApp — Cart Page” widget in the Editor. Configure the button in the
          app dashboard.
        </Text>
      </SidePanel.Field>
    </WixDesignSystemProvider>
  );
};

export default Panel;
