import React, { useEffect, useCallback } from 'react';

/**
 * ScrollIndicator is now a pure logic component.
 * It mounts on any scrollable container and broadcasts its scroll status
 * to the `ModularFrame` which handles the beautiful SVG rendering.
 */
interface ScrollIndicatorProps {
    scrollRef: React.RefObject<HTMLElement | null>;
    color?: string; // Kept for backwards compatibility but unused visually here
    width?: number; // Unused
}

const ScrollIndicator: React.FC<ScrollIndicatorProps> = ({ scrollRef }) => {
    const update = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;

        // Use rAF to throttle scroll updates
        window.requestAnimationFrame(() => {
            const el = scrollRef.current;
            if (!el) return;

            const { scrollTop, scrollHeight, clientHeight } = el;
            const canScroll = scrollHeight > clientHeight + 2;

            let progress = 0;
            if (canScroll) {
                progress = scrollTop / (scrollHeight - clientHeight);
            }

            window.dispatchEvent(new CustomEvent('phantom-scroll', {
                detail: { show: canScroll, progress }
            }));
        });
    }, [scrollRef]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        el.addEventListener('scroll', update, { passive: true });

        const ro = new ResizeObserver(update);
        ro.observe(el);

        const mo = new MutationObserver(update);
        mo.observe(el, { childList: true, subtree: true });

        const updateScrollPosition = (e: any) => {
            if (!el) return;
            // Only apply scroll drag if this container is visibly rendered
            if (el.offsetParent === null) return;
            const p = e.detail;
            el.scrollTop = p * (el.scrollHeight - el.clientHeight);
        };

        window.addEventListener('phantom-scroll-set', updateScrollPosition);

        return () => {
            el.removeEventListener('scroll', update);
            window.removeEventListener('phantom-scroll-set', updateScrollPosition);
            ro.disconnect();
            mo.disconnect();
            // Optional: reset scroll on unmount so frame clears the thumb
            window.dispatchEvent(new CustomEvent('phantom-scroll', {
                detail: { show: false, progress: 0 }
            }));
        };
    }, [scrollRef, update]);

    // No longer renders a DOM rectangle, the UI is handled by ModularFrame's SVG!
    return null;
};

export default ScrollIndicator;
