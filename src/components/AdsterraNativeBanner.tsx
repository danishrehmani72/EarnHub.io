import React, { useEffect, useRef } from 'react';

export function AdsterraNativeBanner() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create the script element as specified by the Adsterra ad code
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://pl29767266.effectivecpmnetwork.com/7a21d11d25705955653d267013cc4d19/invoke.js';
    script.async = true;
    script.setAttribute('data-cfasync', 'false');

    // Append script to container
    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="w-full bg-[#0A0A0A]/90 border border-white/5 rounded-2xl p-4 sm:p-6 text-center space-y-4 shadow-[0_0_35px_rgba(255,255,255,0.01)] mx-auto overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.04] pb-2 mb-2">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-[8px] uppercase tracking-[0.25em] font-black font-sans">Sponsored Network Recommendations</span>
        </div>
        <span className="text-[8px] uppercase font-bold tracking-wider text-white/30 font-mono">AD TIER 4:1</span>
      </div>

      {/* Target injection container for Adsterra native banner */}
      <div className="w-full flex justify-center items-center overflow-x-auto select-none min-h-[90px] bg-black/30 rounded-xl p-2 border border-white/[0.02]">
        <div ref={containerRef} className="w-full">
          <div id="container-7a21d11d25705955653d267013cc4d19" className="w-full min-h-[80px]"></div>
        </div>
      </div>

      <p className="text-[10px] text-white/40 leading-relaxed max-w-2xl mx-auto">
        Please interact with our global community recommended nodes to support sustainable cloud bandwidth allocations.
      </p>
    </div>
  );
}
