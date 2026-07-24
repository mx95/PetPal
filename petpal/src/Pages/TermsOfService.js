import React from 'react';
import { Link } from 'react-router-dom';
import { LegalPageShell } from '../components/LegalPageShell';
import { BRAND } from '../config/brand';
import { useI18n } from '../i18n/I18nContext';

const brandParams = {
  legalName: BRAND.legalName,
  address: BRAND.address,
  contactEmail: BRAND.contactEmail,
};

export default function TermsOfService() {
  const { t } = useI18n();
  return (
    <LegalPageShell title={t('legal.termsTitle')} lastUpdated={new Date().toISOString().slice(0, 10)}>
      <section>
        <h2>{t('legal.terms.agreementTitle')}</h2>
        <p>
          {t('legal.terms.agreementBeforePrivacy', brandParams)}{' '}
          <Link to="/privacy" className="pp-link" style={{ display: 'inline', padding: 0 }}>
            {t('legal.terms.privacyLink')}
          </Link>{' '}
          {t('legal.terms.agreementBetweenPolicies')}{' '}
          <Link to="/cookies" className="pp-link" style={{ display: 'inline', padding: 0 }}>
            {t('legal.terms.cookiesLink')}
          </Link>
          {t('legal.terms.agreementAfterPolicies')}
        </p>
        <p>{t('legal.terms.agreementChanges')}</p>
      </section>

      <section>
        <h2>{t('legal.terms.eligibilityTitle')}</h2>
        <p>{t('legal.terms.eligibilityBody')}</p>
      </section>

      <section>
        <h2>{t('legal.terms.accountsTitle')}</h2>
        <p>
          {t('legal.terms.accountsBeforeEmail')}{' '}
          <a href={`mailto:${BRAND.contactEmail}`} className="pp-link" style={{ display: 'inline', padding: 0 }}>
            {BRAND.contactEmail}
          </a>{' '}
          {t('legal.terms.accountsAfterEmail')}
        </p>
      </section>

      <section>
        <h2>{t('legal.terms.licenceTitle')}</h2>
        <p>{t('legal.terms.licenceBody')}</p>
      </section>

      <section>
        <h2>{t('legal.terms.contentTitle')}</h2>
        <p>{t('legal.terms.contentBody')}</p>
      </section>

      <section>
        <h2>{t('legal.terms.thirdPartyTitle')}</h2>
        <p>{t('legal.terms.thirdPartyBody')}</p>
      </section>

      <section>
        <h2>{t('legal.terms.locationTitle')}</h2>
        <p>
          {t('legal.terms.locationBody')} <strong>{t('legal.terms.locationNoServices')}</strong>
        </p>
      </section>

      <section id="shop-payments">
        <h2>{t('legal.terms.shopTitle')}</h2>
        <p>
          {t('legal.terms.shopIntroBeforeGateway')}{' '}
          <strong>{t('legal.terms.shopGatewayLabel')}</strong> {t('legal.terms.shopIntroAfterGateway')}
        </p>
        <p>{t('legal.terms.shopCardBody')}</p>
        <p>
          {t('legal.terms.shopRenewalBeforeLink')}{' '}
          <Link to="/shop" className="pp-link" style={{ display: 'inline', padding: 0 }}>
            {t('legal.terms.shopSubscriptionsLink')}
          </Link>
          {t('legal.terms.shopRenewalAfterLink')}
        </p>
        <p>{t('legal.terms.shopShipping')}</p>
        <p>{t('legal.terms.shopCancel')}</p>
        <p>{t('legal.terms.shopConsumer')}</p>
        <p>{t('legal.terms.shopPricing')}</p>
      </section>

      <section>
        <h2>{t('legal.terms.disclaimersTitle')}</h2>
        <p>{t('legal.terms.disclaimersBody')}</p>
      </section>

      <section>
        <h2>{t('legal.terms.liabilityTitle')}</h2>
        <p>{t('legal.terms.liabilityBody1')}</p>
        <p>{t('legal.terms.liabilityBody2')}</p>
      </section>

      <section>
        <h2>{t('legal.terms.indemnityTitle')}</h2>
        <p>{t('legal.terms.indemnityBody')}</p>
      </section>

      <section>
        <h2>{t('legal.terms.governingTitle')}</h2>
        <p>
          {t('legal.terms.governingBeforeOdr')}{' '}
          <a
            href="https://ec.europa.eu/consumers/odr/"
            target="_blank"
            rel="noopener noreferrer"
            className="pp-link"
            style={{ display: 'inline', padding: 0 }}
          >
            https://ec.europa.eu/consumers/odr/
          </a>
          {t('legal.terms.governingAfterOdr')}
        </p>
      </section>

      <section>
        <h2>{t('legal.terms.contactTitle')}</h2>
        <p>
          {t('legal.terms.contactBeforeEmail')}{' '}
          <a href={`mailto:${BRAND.contactEmail}`} className="pp-link" style={{ display: 'inline', padding: 0 }}>
            {BRAND.contactEmail}
          </a>
          {t('legal.terms.contactAfterEmail')}
        </p>
      </section>
    </LegalPageShell>
  );
}
