import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useInbox } from '../inbox/InboxContext';
import MenuActionIcon from './MenuActionIcon';
import { useI18n } from '../i18n/I18nContext';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import ShopCartHeaderButton from './shop/ShopCartHeaderButton';
import UserAvatar from './UserAvatar';
import petpalLogo from '../logo.png';
import { BRAND } from '../config/brand';
import { MVP_NAV } from '../config/mvpNav';

function navItemClassName({ isActive }) {
  return [
    'pp-topNavLink group relative rounded-full px-4 py-2 text-sm font-extrabold text-slate-600 no-underline transition-all duration-300 hover:bg-white hover:text-petpal-ink hover:shadow-soft',
    isActive ? 'pp-topNavLink--active bg-petpal-soft text-petpal-lilac shadow-glow' : '',
  ]
    .filter(Boolean)
    .join(' ');
}


function accountMenuLinkClassName() {
  return 'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-petpal-ink no-underline transition hover:bg-petpal-soft';
}

export default function TopNav() {
  const { user, signOut } = useAuth();
  const { isApprovedCompany, isAdmin, profile } = useCompany();
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

  const primaryLinks = (
    <>
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
          {MVP_NAV.showBookings ? (
            <NavLink className={navItemClassName} to="/bookings">
              {t('nav.bookings')}
            </NavLink>
          ) : null}
          <NavLink className={navItemClassName} to="/nearby">
            {t('nav.nearby')}
          </NavLink>
          <NavLink className={navItemClassName} to="/tracking">
            {t('nav.tracking')}
          </NavLink>
        </>
      ) : null}
      {MVP_NAV.showShop ? (
        <NavLink className={navItemClassName} to="/shop">
          {t('nav.shop')}
        </NavLink>
      ) : null}
      {user ? (
        <>
          {isApprovedCompany && profile?.bookingEnabled ? (
            <NavLink className={navItemClassName} to="/provider">
              {t('nav.provider')}
            </NavLink>
          ) : null}
        </>
      ) : null}
    </>
  );

  return (
    <header className="pp-topNav sticky top-0 z-40 border-b border-white/70 bg-white/75 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link className="group flex min-w-0 items-center gap-3 no-underline" to={user ? '/dashboard' : '/'} aria-label={t('nav.home')}>
          <span className="pp-logoMark flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-soft transition-transform duration-300 group-hover:scale-105">
            <img className="h-10 w-10 rounded-2xl" src={petpalLogo} alt="" />
          </span>
          <span className="pp-topNavBrand min-w-0">
            <span className="pp-topNavBrand__name">{BRAND.appName}</span>
            <span className="pp-topNavBrand__tag">{BRAND.tagline}</span>
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex" aria-label="Primary">
          {primaryLinks}
        </nav>

        <div className="pp-topNavUtilityCluster">
          <ShopCartHeaderButton />
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
                <span className="pp-topNavAccountBtn__label">{t('nav.menu')}</span>
              </button>

              {accountMenuOpen ? (
                <div
                  className="absolute right-0 top-full mt-3 w-60 rounded-3xl border border-slate-200 bg-white p-2 shadow-lift animate-soft-pop"
                  role="menu"
                  aria-label={t('nav.menu')}
                >
                  <Link
                    className={`pp-menuItemWithBadge ${accountMenuLinkClassName()}`}
                    to="/inbox"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <span className="pp-menuItemWithBadge__iconWrap">
                      <MenuActionIcon tone="inbox" />
                      {unreadCount > 0 ? (
                        <span className="pp-notifyBadge" aria-label={t('nav.inboxUnread', { count: unreadCount })}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      ) : null}
                    </span>
                    <span>{t('nav.inbox')}</span>
                  </Link>
                  <Link
                    className={accountMenuLinkClassName()}
                    to="/pets"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <MenuActionIcon tone="pets" />
                    <span>{t('nav.myPets')}</span>
                  </Link>
                  <Link
                    className={accountMenuLinkClassName()}
                    to="/lost-pet"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <MenuActionIcon tone="lost" />
                    <span>{t('nav.lostPet')}</span>
                  </Link>
                  <Link
                    className={accountMenuLinkClassName()}
                    to="/shelters"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <MenuActionIcon tone="shelter" />
                    <span>{t('nav.shelters')}</span>
                  </Link>
                  <Link
                    className={accountMenuLinkClassName()}
                    to="/activity"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <MenuActionIcon tone="activity" />
                    <span>{t('nav.activity')}</span>
                  </Link>
                  {isAdmin ? (
                    <Link
                      className={accountMenuLinkClassName()}
                      to="/admin/bookings"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <MenuActionIcon tone="admin" />
                      <span>{t('nav.adminBookings')}</span>
                    </Link>
                  ) : null}
                  <Link
                    className={accountMenuLinkClassName()}
                    to="/profile"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <MenuActionIcon tone="profile" />
                    <span>{t('nav.profile')}</span>
                  </Link>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"
                    role="menuitem"
                    onClick={() => void handleSignOut()}
                  >
                    <MenuActionIcon tone="logout" />
                    <span>{t('nav.logout')}</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <NavLink
                className="hidden items-center justify-center rounded-full border border-slate-200 px-3 py-2 text-sm font-bold text-petpal-ink no-underline sm:inline-flex"
                to="/login"
              >
                {t('nav.login')}
              </NavLink>
              <NavLink
                className="inline-flex items-center justify-center rounded-full bg-petpal-ink px-4 py-2 text-sm font-black text-white no-underline shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                to="/login"
              >
                {t('nav.getStarted')}
              </NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

