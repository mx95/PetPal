import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PhotoGallery from '../components/media/PhotoGallery';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { useLostPet } from '../lostPet/LostPetContext';
import { canMarkLostPetFound } from '../lostPet/lostPetUtils';
import { formatWhen, mapsLink, shareListing, telHref } from '../media/photoUploadUtils';
import { lostPetSpeciesLabel } from '../lostPet/lostPetUtils';

export default function LostPetDetail() {
  const { alertId } = useParams();
  const { t } = useI18n();
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const { getAlertById, resolveAlert, reportAlert } = useLostPet();
  const [alert, setAlert] = useState(/** @type {import('../lostPet/lostPetTypes').LostPetAlert | null} */ (null));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const row = await getAlertById(alertId);
      if (!cancelled) {
        setAlert(row);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alertId, getAlertById]);

  if (loading) return <p className="pp-subtle">{t('common.loading')}</p>;
  if (!alert) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <p className="pp-error">{t('lostPet.notFound')}</p>
          <Link className="pp-link" to="/lost-pet">
            {t('lostPet.backToFeed')}
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = alert.ownerUid === uid;
  const isFound = alert.status === 'found';
  const mapUrl = mapsLink(alert.lastSeenLat, alert.lastSeenLng);
  const tel = telHref(alert.contactPhone);

  async function onMarkFound() {
    setBusy('found');
    try {
      await resolveAlert(alert.id);
      setAlert((prev) => (prev ? { ...prev, status: 'found' } : prev));
    } finally {
      setBusy('');
    }
  }

  async function onReport() {
    setBusy('report');
    try {
      await reportAlert(alert.id);
      setAlert((prev) => (prev ? { ...prev, status: 'reported' } : prev));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="pp-grid pp-lostPetDetail">
      <div className="pp-col-12">
        <Link className="pp-pageHeader__back" to="/lost-pet">
          ← {t('lostPet.backToFeed')}
        </Link>
      </div>
      <div className="pp-col-12">
        <PhotoGallery photos={alert.photos.length ? alert.photos : [{ url: alert.primaryPhotoUrl }]} />
      </div>
      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <span className={`pp-statusBadge pp-statusBadge--${isFound ? 'found' : 'lost'}`}>
            {isFound ? t('lostPet.statusFound') : t('lostPet.statusLost')}
          </span>
          <h1 className="pp-pageHeader__title">{alert.petName}</h1>
          <p className="pp-subtle">
            {[lostPetSpeciesLabel(alert.categoryId, t), alert.breed].filter(Boolean).join(' · ')}
          </p>
          <p style={{ marginTop: 12, lineHeight: 1.6 }}>{alert.description}</p>
          {alert.identifyingMarks ? (
            <p className="pp-subtle" style={{ marginTop: 10 }}>
              <strong>{t('lostPet.identifyingMarks')}:</strong> {alert.identifyingMarks}
            </p>
          ) : null}
          <div className="pp-detailBlock" style={{ marginTop: 16 }}>
            <h2 className="pp-sectionTitle">{t('lostPet.lastSeenSection')}</h2>
            <p>{alert.lastSeenText}</p>
            {alert.lastSeenAt ? <p className="pp-subtle">{formatWhen(alert.lastSeenAt)}</p> : null}
          </div>
          {alert.reward ? (
            <p style={{ marginTop: 12 }}>
              <strong>{t('lostPet.reward')}:</strong> {alert.reward}
            </p>
          ) : null}
          {alert.additionalInfo ? (
            <p className="pp-subtle" style={{ marginTop: 10 }}>
              {alert.additionalInfo}
            </p>
          ) : null}
          <div className="pp-photoFeedCard__actions" style={{ marginTop: 18 }}>
            {tel && !isFound ? (
              <a className="pp-btn pp-btnPrimary" href={tel}>
                {t('photos.call')}
              </a>
            ) : null}
            {mapUrl ? (
              <a className="pp-btn" href={mapUrl} target="_blank" rel="noreferrer">
                {t('lostPet.openLocation')}
              </a>
            ) : null}
            <button
              type="button"
              className="pp-btn pp-btnGhost"
              onClick={() =>
                shareListing({
                  title: t('lostPet.shareTitle', { name: alert.petName }),
                  url: window.location.href,
                })
              }
            >
              {t('photos.share')}
            </button>
            {isOwner && canMarkLostPetFound(alert, uid) ? (
              <button type="button" className="pp-btn" onClick={onMarkFound} disabled={busy === 'found'}>
                {busy === 'found' ? t('common.saving') : t('lostPet.markFound')}
              </button>
            ) : null}
            {!isOwner && alert.status === 'active' ? (
              <button type="button" className="pp-btn pp-btnGhost" onClick={onReport} disabled={busy === 'report'}>
                {t('lostPet.report')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
