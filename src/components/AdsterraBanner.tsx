import React, { useEffect, useRef } from 'react';

export function AdsterraBanner() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Adsterra scripts rely on appending and changing atOptions globally
    const container = containerRef.current;
    if (!container) return;

    // Set configuration variables
    (window as any).atOptions = {
      'key' : 'f7d739d48f41bd1629399cfb9ef1c5bb',
      'format' : 'iframe',
      'height' : 300,
      'width' : 160,
      'params' : {}
    };

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://www.highperformanceformat.com/f7d739d48f41bd1629399cfb9ef1c5bb/invoke.js';
    script.async = true;

    // Append script to container
    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-[#0A0A0A]/90 border border-white/5 rounded-2xl text-center space-y-3 shadow-[0_0_30px_rgba(212,175,55,0.02)] max-w-sm mx-auto">
      <div className="flex items-center gap-1.5 text-amber-500/80">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
        <span className="text-[8px] uppercase tracking-[0.25em] font-black font-sans">Sponsored Network Node</span>
      </div>
      
      {/* Script injection target container */}
      <div 
        ref={containerRef} 
        className="w-[160px] h-[300px] overflow-hidden bg-black/40 rounded-xl border border-white/5 shadow-inner flex items-[#ccc] justify-center items-center text-[10px] text-white/30 font-mono"
      >
        Loading Ad Stream...
      </div>

      <p className="text-[10px] text-white/40 max-w-[200px] leading-relaxed">
        Support our network protocols inside Pakistan. View sponsor cards to claim premium multiplier rates.
      </p>
    </div>
  );
}
