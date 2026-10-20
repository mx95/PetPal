import en from '../i18n/locales/en';
import el from '../i18n/locales/el';
import ru from '../i18n/locales/ru';
import { alertText } from './alertText';

const { MESSAGES } = require('../../../tracker-tcp-server/src/alerts/messages');

const TYPES = ['zone_exit', 'zone_enter', 'battery_low', 'sos', 'offline'];
const catalogs = { en, el, ru };

function makeT(catalog) {
  return (key, params) => {
    let v = key.split('.').reduce((o, k) => (o == null ? o : o[k]), catalog);
    if (typeof v !== 'string') v = key;
    for (const [k, val] of Object.entries(params || {})) v = v.split(`{${k}}`).join(String(val));
    return v;
  };
}

describe('in-app alert text', () => {
  test.each(Object.keys(catalogs))('%s renders every alert type without unfilled placeholders', (lang) => {
    const t = makeT(catalogs[lang]);
    for (const type of TYPES) {
      const { title, body } = alertText(t, {
        type,
        petName: 'Rex',
        params: { radius: 200, battery: 15, hours: 4 },
      });
      expect(title).not.toMatch(/alerts\.|\{\w+\}/);
      expect(body).not.toMatch(/alerts\.|\{\w+\}/);
    }
  });

  test.each(Object.keys(catalogs))('%s in-app wording matches the push text sent by the server', (lang) => {
    for (const type of TYPES) {
      const server = MESSAGES[lang][type];
      expect(catalogs[lang].alerts[type].title).toBe(server.title);
    }
  });

  test('unknown types fall back to the generic alert', () => {
    const { title } = alertText(makeT(en), { type: 'mystery', petName: 'Rex', params: {} });
    expect(title).toBe('Pet alert');
  });
});
