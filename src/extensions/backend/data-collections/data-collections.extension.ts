import { extensions } from '@wix/astro/builders';

import settingsCollection from './settings';

export default extensions.dataCollections({
  id: 'a8f3c2e1-9b4d-4a7e-8f6c-1d2e3f4a5b6c',
  name: 'Order on WhatsApp Settings',
  collections: [settingsCollection],
});
