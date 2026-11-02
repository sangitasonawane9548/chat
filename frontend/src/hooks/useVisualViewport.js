import { useState, useEffect, useRef } from 'react';

/**
 * useVisualViewport Hook
 * Accurately tracks mobile visual viewport height, keyboard open/close states,
 * and handles Chrome mobile & iOS Safari keyboard adjustments.
 */
export const useVisualViewport = () => {
  const [viewportState, setViewportState] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        viewportHeight: 800,
        isKeyboardOpen: false,
        keyboardHeight: 0,
        offsetTop: 0
      };
    }

    const vv = window.visualViewport;
    const initialHeight = vv ? Math.round(vv.height) : window.innerHeight;
    return {
      viewportHeight: initialHeight,
      isKeyboardOpen: false,
      keyboardHeight: 0,
      offsetTop: 0
    };
  });

  const baseHeightRef = useRef(typeof window !== 'undefined' ? window.innerHeight : 800);
  const prevWidthRef = useRef(typeof window !== 'undefined' ? window.innerWidth : 375);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Track the uncontracted baseline height (when keyboard is closed)
    const updateBaseHeight = () => {
      baseHeightRef.current = window.innerHeight;
      prevWidthRef.current = window.innerWidth;
      handleResize();
    };

    const handleResize = () => {
      const vv = window.visualViewport;
      const currentWidth = window.innerWidth;

      // If width changes significantly (e.g. phone orientation flipped), reset baseline
      if (Math.abs(currentWidth - prevWidthRef.current) > 40) {
        prevWidthRef.current = currentWidth;
        baseHeightRef.current = window.innerHeight;
      }

      if (!vv) {
        const height = window.innerHeight;
        setViewportState({
          viewportHeight: height,
          isKeyboardOpen: false,
          keyboardHeight: 0,
          offsetTop: 0
        });
        document.documentElement.style.setProperty('--visual-viewport-height', `${height}px`);
        return;
      }

      const currentHeight = Math.round(vv.height);
      const isMobile = window.innerWidth < 768;

      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl && (
          ['INPUT', 'TEXTAREA'].includes(activeEl.tagName) ||
          activeEl.isContentEditable ||
          activeEl.getAttribute('role') === 'textbox'
        );

      const heightDifference = Math.max(0, baseHeightRef.current - currentHeight);
      // Virtual keyboard open detection
      const isKeyboardOpen = isMobile && (heightDifference > 140 || (isInputFocused && heightDifference > 60));
      const keyboardHeight = isKeyboardOpen ? heightDifference : 0;

      setViewportState({
        viewportHeight: currentHeight,
        isKeyboardOpen,
        keyboardHeight,
        offsetTop: Math.round(vv.offsetTop || 0)
      });

      // Update CSS variables for stylesheet bindings
      document.documentElement.style.setProperty('--visual-viewport-height', `${currentHeight}px`);
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);

      // If keyboard is closed, update the baseline reference
      if (!isKeyboardOpen && currentHeight >= baseHeightRef.current) {
        baseHeightRef.current = currentHeight;
      }
    };

    const handleScroll = () => {
      const vv = window.visualViewport;
      if (!vv) return;

      // On iOS Safari, keep visual viewport aligned to top
      if (vv.offsetTop > 0 && window.innerWidth < 768) {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
      }
    };

    const handleFocusChange = () => {
      // Re-evaluate on next ticks as keyboard slides in/out
      requestAnimationFrame(handleResize);
      setTimeout(handleResize, 150);
      setTimeout(handleResize, 350);
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', handleResize);
      vv.addEventListener('scroll', handleScroll);
    }
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', updateBaseHeight);
    window.addEventListener('focusin', handleFocusChange);
    window.addEventListener('focusout', handleFocusChange);

    // Initial sync
    handleResize();

    return () => {
      if (vv) {
        vv.removeEventListener('resize', handleResize);
        vv.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', updateBaseHeight);
      window.removeEventListener('focusin', handleFocusChange);
      window.removeEventListener('focusout', handleFocusChange);
    };
  }, []);

  return viewportState;
};

export default useVisualViewport;
