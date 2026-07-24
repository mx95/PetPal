import React from 'react';
import { LegalPageShell } from '../components/LegalPageShell';
import { BRAND } from '../config/brand';
import { useI18n } from '../i18n/I18nContext';

const brandParams = {
  legalName: BRAND.legalName,
  address: BRAND.address,
  contactEmail: BRAND.contactEmail,
  privacyEmail: BRAND.privacyEmail,
};

const dataItems = [
  ['dataAccountLabel', 'dataAccountBody'],
  ['dataPetLabel', 'dataPetBody'],
  ['dataBookingsLabel', 'dataBookingsBody'],
  ['dataShopLabel', 'dataShopBody'],
  ['dataTechnicalLabel', 'dataTechnicalBody'],
  ['dataMapsLabel', 'dataMapsBody'],
  ['dataLeaderboardLabel', 'dataLeaderboardBody'],
];

const basisItems = [
  ['basisContractLabel', 'basisContractBody'],
  ['basisLegitimateLabel', 'basisLegitimateBody'],
  ['basisConsentLabel', 'basisConsentBody'],
  ['basisLegalLabel', 'basisLegalBody'],
];

const processorItems = [
  ['processorFirebaseLabel', 'processorFirebaseBody'],
  ['processorJccLabel', 'processorJccBody'],
  ['processorMapsLabel', 'processorMapsBody'],
  ['processorHostingLabel', 'processorHostingBody'],
];

const retentionItems = [
  ['retentionAccountLabel', 'retentionAccountBody'],
  ['retentionBookingsLabel', 'retentionBookingsBody'],
  ['retentionOrdersLabel', 'retentionOrdersBody'],
  ['retentionSecurityLabel', 'retentionSecurityBody'],
  ['retentionLocalLabel', 'retentionLocalBody'],
];

const rights = [
  'rightAccess',
  'rightRectification',
  'rightErasure',
  'rightRestriction',
  'rightPortability',
  'rightObject',
  'rightConsent',
];

function LabelledItem({ t, labelKey, bodyKey }) {
  return (
    <li>
      <strong>{t(`legal.privacy.${labelKey}`)}</strong> {t(`legal.privacy.${bodyKey}`, brandParams)}
    </li>
  );
}

export default function PrivacyPolicy() {
  const { t } = useI18n();
  return (
    <LegalPageShell title={t('legal.privacyTitle')} lastUpdated={new Date().toISOString().slice(0, 10)}>
      <section>
        <h2>{t('legal.privacy.whoTitle')}</h2>
        <p>
          <strong>{t('legal.privacy.controllerLabel')}</strong> {t('legal.privacy.controllerBody', brandParams)}
        </p>
        <p>
          <strong>{t('legal.privacy.generalContactLabel')}</strong>{' '}
          <a href={`mailto:${BRAND.contactEmail}`} className="pp-link">
            {BRAND.contactEmail}
          </a>
          <br />
          <strong>{t('legal.privacy.privacyContactLabel')}</strong>{' '}
          <a href={`mailto:${BRAND.privacyEmail}`} className="pp-link">
            {BRAND.privacyEmail}
          </a>
        </p>
      </section>

      <section>
        <h2>{t('legal.privacy.scopeTitle')}</h2>
        <p>{t('legal.privacy.scopeBody')}</p>
      </section>

      <section>
        <h2>{t('legal.privacy.dataTitle')}</h2>
        <p>{t('legal.privacy.dataIntro')}</p>
        <ul>
          {dataItems.map(([labelKey, bodyKey]) => (
            <LabelledItem key={labelKey} t={t} labelKey={labelKey} bodyKey={bodyKey} />
          ))}
        </ul>
        <p>{t('legal.privacy.dataSpecialCategories')}</p>
      </section>

      <section>
        <h2>{t('legal.privacy.basesTitle')}</h2>
        <p>{t('legal.privacy.basesIntro')}</p>
        <ul>
          {basisItems.map(([labelKey, bodyKey]) => (
            <LabelledItem key={labelKey} t={t} labelKey={labelKey} bodyKey={bodyKey} />
          ))}
        </ul>
      </section>

      <section>
        <h2>{t('legal.privacy.recipientsTitle')}</h2>
        <p>{t('legal.privacy.recipientsIntro')}</p>
        <ul>
          {processorItems.map(([labelKey, bodyKey]) => (
            <LabelledItem key={labelKey} t={t} labelKey={labelKey} bodyKey={bodyKey} />
          ))}
        </ul>
        <p>{t('legal.privacy.recipientsTransfers')}</p>
      </section>

      <section>
        <h2>{t('legal.privacy.paymentsTitle')}</h2>
        <p>{t('legal.privacy.paymentsBody1')}</p>
        <p>{t('legal.privacy.paymentsBody2')}</p>
      </section>

      <section>
        <h2>{t('legal.privacy.transfersTitle')}</h2>
        <p>{t('legal.privacy.transfersBody')}</p>
      </section>

      <section>
        <h2>{t('legal.privacy.retentionTitle')}</h2>
        <p>{t('legal.privacy.retentionIntro')}</p>
        <ul>
          {retentionItems.map(([labelKey, bodyKey]) => (
            <LabelledItem key={labelKey} t={t} labelKey={labelKey} bodyKey={bodyKey} />
          ))}
        </ul>
        <p>{t('legal.privacy.retentionMinimise')}</p>
      </section>

      <section>
        <h2>{t('legal.privacy.rightsTitle')}</h2>
        <p>{t('legal.privacy.rightsIntro')}</p>
        <ul>
          {rights.map((key) => (
            <li key={key}>{t(`legal.privacy.${key}`)}</li>
          ))}
          <li>
            {t('legal.privacy.rightComplaintBefore')}{' '}
            <a
              href="https://www.dataprotection.gov.cy/"
              target="_blank"
              rel="noopener noreferrer"
              className="pp-link"
              style={{ display: 'inline', padding: 0 }}
            >
              {t('legal.privacy.rightComplaintLink')}
            </a>
            {t('legal.privacy.rightComplaintAfter')}
          </li>
        </ul>
        <p>{t('legal.privacy.rightsContact')}</p>
      </section>

      <section>
        <h2>{t('legal.privacy.securityTitle')}</h2>
        <p>{t('legal.privacy.securityBody')}</p>
      </section>

      <section>
        <h2>{t('legal.privacy.childrenTitle')}</h2>
        <p>{t('legal.privacy.childrenBody')}</p>
      </section>

      <section>
        <h2>{t('legal.privacy.changesTitle')}</h2>
        <p>{t('legal.privacy.changesBody')}</p>
      </section>
    </LegalPageShell>
  );
}
