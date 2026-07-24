import React from 'react';
import { Link } from 'react-router-dom';
import { LegalPageShell } from '../components/LegalPageShell';
import { useI18n } from '../i18n/I18nContext';

const cookieUseItems = [
  ['strictlyLabel', 'strictlyBody'],
  ['functionalLabel', 'functionalBody'],
  ['analyticsLabel', 'analyticsBody'],
];

const cookieRows = [
  ['sessionName', 'sessionPurpose', 'sessionDuration'],
  ['storageName', 'storagePurpose', 'storageDuration'],
  ['analyticsName', 'analyticsPurpose', 'analyticsDuration'],
];

export default function CookiePolicy() {
  const { t } = useI18n();
  return (
    <LegalPageShell title={t('legal.cookieTitle')} lastUpdated={new Date().toISOString().slice(0, 10)}>
      <section>
        <h2>{t('legal.cookies.whatTitle')}</h2>
        <p>
          {t('legal.cookies.whatBodyBeforeStrong')}
          <strong>{t('legal.cookies.whatStrong')}</strong>
          {t('legal.cookies.whatBodyAfterStrong')}
        </p>
        <p>{t('legal.cookies.firstVisit')}</p>
      </section>

      <section>
        <h2>{t('legal.cookies.whyTitle')}</h2>
        <p>{t('legal.cookies.whyIntro')}</p>
        <ul>
          {cookieUseItems.map(([labelKey, bodyKey]) => (
            <li key={labelKey}>
              <strong>{t(`legal.cookies.${labelKey}`)}</strong> {t(`legal.cookies.${bodyKey}`)}
            </li>
          ))}
        </ul>
        <p>{t('legal.cookies.nonEssential')}</p>
      </section>

      <section>
        <h2>{t('legal.cookies.typesTitle')}</h2>
        <table className="pp-legalTable">
          <thead>
            <tr>
              <th>{t('legal.cookies.tableName')}</th>
              <th>{t('legal.cookies.tablePurpose')}</th>
              <th>{t('legal.cookies.tableDuration')}</th>
            </tr>
          </thead>
          <tbody>
            {cookieRows.map(([nameKey, purposeKey, durationKey]) => (
              <tr key={nameKey}>
                <td>{t(`legal.cookies.${nameKey}`)}</td>
                <td>{t(`legal.cookies.${purposeKey}`)}</td>
                <td>{t(`legal.cookies.${durationKey}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="pp-subtle" style={{ marginTop: 12 }}>
          {t('legal.cookies.providerNote')}
        </p>
      </section>

      <section>
        <h2>{t('legal.cookies.legalBasisTitle')}</h2>
        <p>{t('legal.cookies.legalBasisBody')}</p>
      </section>

      <section>
        <h2>{t('legal.cookies.controlTitle')}</h2>
        <p>{t('legal.cookies.controlBody')}</p>
      </section>

      <section>
        <h2>{t('legal.cookies.furtherTitle')}</h2>
        <p>
          {t('legal.cookies.furtherBeforePrivacy')}{' '}
          <Link to="/privacy" className="pp-link" style={{ display: 'inline', padding: 0 }}>
            {t('legal.cookies.furtherPrivacyLink')}
          </Link>
          {t('legal.cookies.furtherAfterPrivacy')}
        </p>
      </section>
    </LegalPageShell>
  );
}
