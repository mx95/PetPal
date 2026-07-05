import elDiscover from './translations/el-discover.mjs';
import elShop from './translations/el-shop.mjs';
import elMisc from './translations/el-misc.mjs';
import elTracking from './translations/el-tracking.mjs';
import elDocs from './translations/el-docs.mjs';

import ruDiscover from './translations/ru-discover.mjs';
import ruShop from './translations/ru-shop.mjs';
import ruMisc from './translations/ru-misc.mjs';
import ruTracking from './translations/ru-tracking.mjs';
import ruDocs from './translations/ru-docs.mjs';

function mergeMaps(...maps) {
  return Object.assign({}, ...maps);
}

export const elTranslations = mergeMaps(elDiscover, elShop, elMisc, elTracking, elDocs);
export const ruTranslations = mergeMaps(ruDiscover, ruShop, ruMisc, ruTracking, ruDocs);
