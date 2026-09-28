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
          Place this widget on your Cart page (near Checkout). Configure the
          button in the Order on WhatsApp app dashboard. The live button requires
          a paid plan.
        </Text>
      </SidePanel.Field>
    </WixDesignSystemProvider>
  );
};

export default Panel;
