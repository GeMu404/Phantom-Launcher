import { useState, useEffect } from 'react';

export const usePerformance = () => {
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        const handleVisibilityChange = () => {
            // Pause if document is hidden (minimized or switched tab)
            setIsPaused(document.hidden);
        };

        const handleBlur = () => {
            // Optional: Pause on blur (alt-tab) even if visible? 
            // For now, let's keep it running if visible but blurred (e.g. dual monitor), 
            // strictly pausing only when hidden or explicitly requested.
            // If user wants Aggressive mode, we can uncomment:
            // setIsPaused(true); 
        };

        const handleFocus = () => {
            // setIsPaused(false);
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("blur", handleBlur);
        window.addEventListener("focus", handleFocus);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("blur", handleBlur);
            window.removeEventListener("focus", handleFocus);
        };
    }, []);

    return { isPaused };
};
