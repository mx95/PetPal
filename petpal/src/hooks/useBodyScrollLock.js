import { useEffect } from 'react';

let lockCount = 0;
let savedPageScrollTop = 0;
let touchMoveHandler = null;

const SCROLLABLE_SEL =
  '.pp-modalForm, .pp-medModal__scroll, .pp-modalCard, .pp-photoAlign__circle, textarea, input, select';

function getPageScrollEl() {
  return document.querySelector('.pp-pageScroll');
}

function isInsideModalScrollable(target) {
  if (!(target instanceof Element)) return false;
  const scrollable = target.closest(SCROLLABLE_SEL);
  if (!scrollable) return false;
  // Allow native scroll only when the element (or an ancestor) can still scroll.
  let el = scrollable;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    const oy = style.overflowY;
    const canScrollY =
      (oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 1;
    if (canScrollY) return true;
    el = el.parentElement;
  }
  // Still inside the modal sheet — block chaining to the page behind.
  return Boolean(target.closest('.pp-modalWrap'));
}

function onTouchMove(e) {
  if (isInsideModalScrollable(e.target)) return;
  // Block background / rubber-band scroll while a modal is open.
  if (e.cancelable) e.preventDefault();
}

function applyLock() {
  const pageScroll = getPageScrollEl();
  if (pageScroll) {
    savedPageScrollTop = pageScroll.scrollTop;
    pageScroll.dataset.ppLockedScroll = String(savedPageScrollTop);
  } else {
    savedPageScrollTop = window.scrollY || window.pageYOffset || 0;
    document.body.dataset.ppLockedScroll = String(savedPageScrollTop);
  }
  document.documentElement.classList.add('pp-noScroll');
  document.body.classList.add('pp-noScroll');
  if (!touchMoveHandler) {
    touchMoveHandler = onTouchMove;
    document.addEventListener('touchmove', touchMoveHandler, { passive: false });
  }
}

function releaseLock() {
  if (touchMoveHandler) {
    document.removeEventListener('touchmove', touchMoveHandler);
    touchMoveHandler = null;
  }
  document.documentElement.classList.remove('pp-noScroll');
  document.body.classList.remove('pp-noScroll');
  const pageScroll = getPageScrollEl();
  if (pageScroll && pageScroll.dataset.ppLockedScroll != null) {
    const y = Number(pageScroll.dataset.ppLockedScroll) || 0;
    delete pageScroll.dataset.ppLockedScroll;
    pageScroll.scrollTop = y;
    return;
  }
  const y = Number(document.body.dataset.ppLockedScroll) || savedPageScrollTop || 0;
  delete document.body.dataset.ppLockedScroll;
  window.scrollTo(0, y);
}

/**
 * Lock background page scroll while a modal/sheet is open.
 * Works with the mobile dock (.pp-pageScroll) and plain document scrolling.
 */
export default function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    lockCount += 1;
    if (lockCount === 1) applyLock();
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) releaseLock();
    };
  }, [locked]);
}
