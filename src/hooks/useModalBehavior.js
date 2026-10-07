import { useEffect } from 'react';

/**
 * Shared behavior for full-screen overlays (cart drawer, checkout modal):
 * closes on Escape and locks background scroll while open. Pass
 * `canClose: false` to suppress Escape during a step that shouldn't be
 * interrupted (e.g. mid-payment).
 */
export function useModalBehavior(isOpen, onClose, canClose = true) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && canClose) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, canClose]);
}
