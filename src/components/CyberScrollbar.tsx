import React, { useState, useEffect, useRef } from 'react';

interface CyberScrollbarProps {
    containerRef: React.RefObject<HTMLDivElement>;
    accentColor: string;
    top?: string;
    bottom?: string;
    right?: string;
    left?: string;
    width?: string;
}

const CyberScrollbar: React.FC<CyberScrollbarProps> = ({
    containerRef,
    accentColor,
    top = '110px',
    bottom = '20px',
    right = '6px',
    left,
    width = '24px'
}) => {
    const [scrollInfo, setScrollInfo] = useState({ top: 0, ratio: 1 }); // Default ratio 1 = hidden
    const isDragging = useRef(false);
    const startY = useRef(0);
    const startScrollTop = useRef(0);
    const trackRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const updateScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = el;

            // Strict hide condition: content fits in container
            if (scrollHeight <= clientHeight + 3) {
                setScrollInfo(prev => prev.ratio !== 1 ? { top: 0, ratio: 1 } : prev);
                return;
            }

            const ratio = clientHeight / scrollHeight;
            const topPos = (scrollTop / scrollHeight) * 100;
            const newRatio = Math.max(0.1, ratio);

            // Only update if something changed to avoid re-render loops
            setScrollInfo(prev => {
                if (prev.top === topPos && prev.ratio === newRatio) return prev;
                return { top: topPos, ratio: newRatio };
            });
        };

        el.addEventListener('scroll', updateScroll);

        const observer = new ResizeObserver(updateScroll);
        observer.observe(el);

        // Observe content children
        const observeChildren = () => {
            Array.from(el.children).forEach(child => observer.observe(child as Element));
        };

        const mutationObserver = new MutationObserver(() => {
            updateScroll();
            observeChildren();
        });

        mutationObserver.observe(el, { childList: true, subtree: true });
        observeChildren();

        // Immediate and delayed checks to catch layout settling
        updateScroll();
        const timers = [100, 300, 600, 1000].map(ms => setTimeout(updateScroll, ms));

        return () => {
            el.removeEventListener('scroll', updateScroll);
            observer.disconnect();
            mutationObserver.disconnect();
            timers.forEach(clearTimeout);
        };
    }, [containerRef]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const el = containerRef.current;
        const track = trackRef.current;
        if (!el || !track) return;

        isDragging.current = true;
        startY.current = e.clientY;
        startScrollTop.current = el.scrollTop;

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'default';
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current || !containerRef.current || !trackRef.current) return;

        const el = containerRef.current;
        const track = trackRef.current;
        const { scrollHeight } = el;

        const deltaY = e.clientY - startY.current;
        const trackHeight = track.clientHeight;

        const scrollFactor = scrollHeight / trackHeight;
        el.scrollTop = startScrollTop.current + (deltaY * scrollFactor);
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    };

    const handleTrackClick = (e: React.MouseEvent) => {
        if (e.target !== trackRef.current) return;
        const el = containerRef.current;
        const track = trackRef.current;
        if (!el || !track) return;

        const rect = track.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const percentage = clickY / track.clientHeight;
        el.scrollTop = (percentage * el.scrollHeight) - (el.clientHeight / 2);
    };

    if (scrollInfo.ratio >= 1) return null;

    return (
        <div
            ref={trackRef}
            className="absolute z-[100] cursor-default group"
            style={{ top, bottom, right, left, width }}
            onMouseDown={handleTrackClick}
        >
            <div
                className="absolute w-3.5 right-1 transition-all duration-75 cursor-default hover:brightness-125"
                onMouseDown={handleMouseDown}
                style={{
                    top: `${scrollInfo.top}%`,
                    height: `${scrollInfo.ratio * 100}%`,
                    background: accentColor,
                    clipPath: 'polygon(0 8px, 100% 0, 100% 100%, 0 calc(100% - 8px))',
                    boxShadow: `0 0 20px ${accentColor}44`
                }}
            >
                {/* Decorative lines */}
                <div className="absolute inset-y-1/2 left-0.5 right-0.5 h-[1px] bg-black/20" />
            </div>
        </div>
    );
};

export default CyberScrollbar;
