import { app } from '@wix/astro/builders';

import dataCollections from './extensions/backend/data-collections/data-collections.extension';

export default app().use(dataCollections);
