import { useEffect } from 'react';

let lockCount = 0;
let scrollY = 0;
let previous = {
  htmlOverflow: '',
  bodyOverflow: '',
  bodyPosition: '',
  bodyTop: '',
  bodyLeft: '',
  bodyRight: '',
  bodyWidth: '',
  bodyPaddingRight: '',
};

function lockBodyScroll() {
  lockCount += 1;
  if (lockCount !== 1) return;

  scrollY = window.scrollY;
  previous = {
    htmlOverflow: document.documentElement.style.overflow,
    bodyOverflow: document.body.style.overflow,
    bodyPosition: document.body.style.position,
    bodyTop: document.body.style.top,
    bodyLeft: document.body.style.left,
    bodyRight: document.body.style.right,
    bodyWidth: document.body.style.width,
    bodyPaddingRight: document.body.style.paddingRight,
  };

  const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  if (scrollbarGap > 0) {
    document.body.style.paddingRight = `${scrollbarGap}px`;
  }
}

function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount !== 0) return;

  document.documentElement.style.overflow = previous.htmlOverflow;
  document.body.style.overflow = previous.bodyOverflow;
  document.body.style.position = previous.bodyPosition;
  document.body.style.top = previous.bodyTop;
  document.body.style.left = previous.bodyLeft;
  document.body.style.right = previous.bodyRight;
  document.body.style.width = previous.bodyWidth;
  document.body.style.paddingRight = previous.bodyPaddingRight;
  window.scrollTo(0, scrollY);
}

export function useBodyScrollLock(locked = true) {
  useEffect(() => {
    if (!locked) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [locked]);
}
