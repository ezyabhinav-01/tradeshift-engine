import { useEffect, useRef } from 'react';

function useTradingViewWidget(scriptUrl: string, config: any, height = 600) {
    const containerRef = useRef<HTMLDivElement | null>(null);


    useEffect(
        () => {
            if (!containerRef.current) return;
            
            const configString = JSON.stringify(config);
            const currentConfig = containerRef.current.dataset.config;
            
            // Only re-initialize if the config content or script URL has changed
            if (containerRef.current.dataset.loaded === "true" && currentConfig === configString) {
                return;
            }

            // Clear previous content
            containerRef.current.innerHTML = `<div class="tradingview-widget-container__widget" style="width: 100%; height:${height}px;"></div>`;

            const script = document.createElement("script");
            script.src = scriptUrl;
            script.async = true;
            script.innerHTML = configString;
            containerRef.current.appendChild(script);
            
            containerRef.current.dataset.loaded = "true";
            containerRef.current.dataset.config = configString;

            return () => {
                // NOTE: We don't clear the innerHTML here to prevent flickering when parent re-renders quickly.
                // The dataset check above will handle re-initialization only when necessary.
            };
        },
        [scriptUrl, config, height] 
    );

    return containerRef;
}

export default useTradingViewWidget;


//depending on the specific chart widget we wan't to load,we then return the containerRef which we just attach to this new chart