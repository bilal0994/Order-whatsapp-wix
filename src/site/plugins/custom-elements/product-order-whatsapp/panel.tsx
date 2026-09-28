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
          Button visibility, position (before/after Add to Cart), and Hide Add
          to Cart are controlled in the Order on WhatsApp app dashboard. Add
          this plugin once on the Product Page. The live button requires a paid
          plan.
        </Text>
      </SidePanel.Field>
    </WixDesignSystemProvider>
  );
};

export default Panel;
