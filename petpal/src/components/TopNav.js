import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useInbox } from '../inbox/InboxContext';
import { useI18n } from '../i18n/I18nContext';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import UserAvatar from './UserAvatar';
import petpalLogo from '../logo.png';
import { MVP_NAV } from '../config/mvpNav';

function navItemClassName({ isActive }) {
  return [
    'pp-topNavLink group relative rounded-full px-4 py-2 text-sm font-extrabold text-slate-600 no-underline transition-all duration-300 hover:bg-white hover:text-petpal-ink hover:shadow-soft',
    isActive ? 'pp-topNavLink--active bg-petpal-soft text-petpal-lilac shadow-glow' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export default function TopNav() {
  const { user, signOut } = useAuth();
  const { isApprovedCompany, profile } = useCompany();
  const { unreadCount } = useInbox();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = 'light';
    try {
      localStorage.setItem('petpal_theme', 'light');
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;

    const handleClickOutside = (event) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [accountMenuOpen]);

  const handleSignOut = async () => {
    setAccountMenuOpen(false);
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <header className="pp-topNav sticky top-0 z-40 border-b border-white/70 bg-white/75 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link className="group flex items-center gap-3 no-underline" to="/" aria-label={t('nav.home')}>
          <span className="pp-logoMark flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-soft transition-transform duration-300 group-hover:scale-105">
            <img className="h-10 w-10 rounded-2xl" src={petpalLogo} alt="" />
          </span>
          <span className="hidden sm:block">
            <span className="block text-lg font-black tracking-[-0.04em] text-petpal-ink">PetPal</span>
            <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-petpal-muted">Care hub</span>
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex" aria-label="Primary">
          {user ? (
            <>
              {MVP_NAV.showPremium ? (
                <NavLink className={navItemClassName} to="/premium/lost">
                  {t('nav.premium')}
                </NavLink>
              ) : null}
              {MVP_NAV.showCommunity ? (
                <NavLink className={navItemClassName} to="/community">
                  {t('nav.community')}
                </NavLink>
              ) : null}
              <NavLink className={navItemClassName} to="/pets">
                {t('nav.myPets')}
              </NavLink>
              <NavLink className={navItemClassName} to="/nearby">
                {t('nav.nearby')}
              </NavLink>
              <NavLink className={navItemClassName} to="/tracking">
                {t('nav.tracking')}
              </NavLink>
              {MVP_NAV.showShop ? (
                <NavLink className={navItemClassName} to="/shop">
                  {t('nav.shop')}
                </NavLink>
              ) : null}
              {MVP_NAV.showBookings ? (
                <NavLink className={navItemClassName} to="/bookings">
                  {t('nav.bookings')}
                </NavLink>
              ) : null}
              {isApprovedCompany && profile?.bookingEnabled ? (
                <NavLink className={navItemClassName} to="/provider">
                  {t('nav.provider')}
                </NavLink>
              ) : null}
            </>
          ) : null}
        </nav>

        <div className="pp-topNavUtilityCluster">
          <LanguageSwitcher />
          {user ? (
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                className="pp-topNavAccountBtn"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
              >
                <UserAvatar user={user} size={32} className="pp-navProfileAvatar" />
                <span className="pp-topNavAccountBtn__label">{t('nav.profile')}</span>
              </button>

              {accountMenuOpen ? (
                <div className="absolute right-0 top-full mt-3 w-60 rounded-3xl border border-slate-200 bg-white p-2 shadow-lift animate-soft-pop" role="menu" aria-label={t('nav.profile')}>
                  {MVP_NAV.showShop ? (
                    <Link className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-petpal-ink no-underline transition hover:bg-petpal-soft" to="/shop" role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                      <span aria-hidden>🛒</span>
                      <span>{t('nav.shop')}</span>
                    </Link>
                  ) : null}
                  <Link
                    className="pp-menuItemWithBadge flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-petpal-ink no-underline transition hover:bg-petpal-soft"
                    to="/inbox"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <span className="pp-menuItemWithBadge__iconWrap" aria-hidden>
                      <span className="pp-menuItemWithBadge__icon">📬</span>
                      {unreadCount > 0 ? (
                        <span className="pp-notifyBadge" aria-label={t('nav.inboxUnread', { count: unreadCount })}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      ) : null}
                    </span>
                    <span>{t('nav.inbox')}</span>
                  </Link>
                  <Link className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-petpal-ink no-underline transition hover:bg-petpal-soft" to="/profile" role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                    <span aria-hidden>👤</span>
                    <span>{t('nav.profile')}</span>
                  </Link>
                  {MVP_NAV.showDashboard ? (
                    <Link className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-petpal-ink no-underline transition hover:bg-petpal-soft" to="/dashboard" role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                      <span aria-hidden>📊</span>
                      <span>{t('nav.dashboard')}</span>
                    </Link>
                  ) : null}
                  {MVP_NAV.showLeaderboard ? (
                    <Link className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-petpal-ink no-underline transition hover:bg-petpal-soft" to="/leaderboard" role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                      <span aria-hidden>🏆</span>
                      <span>{t('nav.leaderboard')}</span>
                    </Link>
                  ) : null}
                  <Link className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-petpal-ink no-underline transition hover:bg-petpal-soft" to="/docs" role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                    <span aria-hidden>📖</span>
                    <span>{t('nav.docs')}</span>
                  </Link>
                  <Link className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-petpal-ink no-underline transition hover:bg-petpal-soft" to="/provider?demoBusiness=example_vet" role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                    <span aria-hidden>🏪</span>
                    <span>Business demos</span>
                  </Link>
                  <Link className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-petpal-ink no-underline transition hover:bg-petpal-soft" to="/pets" role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                    <span aria-hidden>🐾</span>
                    <span>{t('nav.myPets')}</span>
                  </Link>
                  <button type="button" className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-red-600 transition hover:bg-red-50" role="menuitem" onClick={handleSignOut}>
                    <span aria-hidden>↩️</span>
                    <span>{t('nav.logout')}</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <NavLink
              className="hidden items-center justify-center rounded-full bg-petpal-ink px-4 py-2 text-sm font-black text-white no-underline shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift sm:inline-flex"
              to="/login"
            >
              Get Started
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}

