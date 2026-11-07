import React, { useEffect, useState } from 'react';

/**
 * TurboSplashScreen Component
 * 
 * Minimal, Apple-style loading splash screen featuring an animated turbocharger logo.
 * Monochromatic palette (#004b93 navy / slate), clean vector SVG,
 * and a 3.6-second physics-inspired spool-up curve (dead stop -> rapid spool -> smooth deceleration).
 * 
 * Drop directly into any React / Next.js / Tailwind project.
 */
export default function TurboSplashScreen({ onFinish, duration = 3600 }) {
  const [fading, setFading] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Start smooth fade-out near end of duration
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, duration - 500);

    // Complete removal
    const finishTimer = setTimeout(() => {
      setVisible(false);
      if (onFinish) onFinish();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [duration, onFinish]);

  if (!visible) return null;

  return (
    <div
      onClick={() => {
        setFading(true);
        setTimeout(() => {
          setVisible(false);
          if (onFinish) onFinish();
        }, 400);
      }}
      className={`fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-white cursor-pointer select-none transition-opacity duration-500 ease-out ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <style>{`
        @keyframes turboSpool {
          0% {
            transform: rotate(0deg);
          }
          12% {
            transform: rotate(60deg);
          }
          28% {
            transform: rotate(720deg);
          }
          52% {
            transform: rotate(2160deg);
          }
          76% {
            transform: rotate(3240deg);
          }
          90% {
            transform: rotate(3560deg);
          }
          100% {
            transform: rotate(3600deg);
          }
        }

        .animate-turbo-spool {
          animation: turboSpool 3.6s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
        }

        @keyframes progressFill {
          0% { width: 0%; }
          30% { width: 45%; }
          70% { width: 85%; }
          100% { width: 100%; }
        }

        .animate-progress-fill {
          animation: progressFill 3.4s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
        }
      `}</style>

      <div className="flex flex-col items-center text-center px-6">
        {/* Turbocharger Vector Logo */}
        <div className="w-28 h-24 mb-5 flex items-center justify-center drop-shadow-md">
          <svg
            className="w-full h-full"
            viewBox="0 0 200 170"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Static Compressor Housing */}
            <g
              stroke="#004b93"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Outlet Snout & Flange */}
              <path d="M110 32 H170 V62 H110" />
              <path d="M170 26 V68" strokeWidth="8" />
              {/* Volute / Scroll Outer Casing */}
              <path d="M110 32 C55 32 20 65 20 108 C20 148 55 162 95 162 C135 162 165 140 170 115" />
              {/* Inner Swirl Details */}
              <path d="M38 128 C30 100 45 68 80 58" strokeWidth="5" />
              <path d="M152 88 C155 125 125 145 95 145 C70 145 52 135 48 120" strokeWidth="4.5" />
              {/* Central Turbine Intake Ring */}
              <circle cx="102" cy="98" r="32" strokeWidth="5" />
            </g>

            {/* Rotating Impeller / Turbine Wheel */}
            <g
              className="animate-turbo-spool"
              style={{ transformOrigin: '102px 98px' }}
            >
              {/* Central Hub */}
              <circle cx="102" cy="98" r="7.5" fill="#004b93" />
              <circle cx="102" cy="98" r="2.5" fill="#ffffff" />
              {/* 8 Aerodynamic Impeller Blades */}
              <path d="M102 98 Q108 80 102 68 Q96 80 102 98" fill="#004b93" />
              <path d="M102 98 Q108 80 102 68 Q96 80 102 98" fill="#004b93" transform="rotate(45 102 98)" />
              <path d="M102 98 Q108 80 102 68 Q96 80 102 98" fill="#004b93" transform="rotate(90 102 98)" />
              <path d="M102 98 Q108 80 102 68 Q96 80 102 98" fill="#004b93" transform="rotate(135 102 98)" />
              <path d="M102 98 Q108 80 102 68 Q96 80 102 98" fill="#004b93" transform="rotate(180 102 98)" />
              <path d="M102 98 Q108 80 102 68 Q96 80 102 98" fill="#004b93" transform="rotate(225 102 98)" />
              <path d="M102 98 Q108 80 102 68 Q96 80 102 98" fill="#004b93" transform="rotate(270 102 98)" />
              <path d="M102 98 Q108 80 102 68 Q96 80 102 98" fill="#004b93" transform="rotate(315 102 98)" />
            </g>
          </svg>
        </div>

        {/* Minimal Apple-Style Brand Typography */}
        <div className="text-[1.18rem] font-extrabold tracking-[0.2em] text-[#004b93] font-sans">
          M.K. TURBO
        </div>
        <div className="text-[0.72rem] font-semibold tracking-wider text-slate-500 mt-1 font-sans">
          Workshop &amp; Finance
        </div>

        {/* Minimalist Progress Track */}
        <div className="w-28 h-[3px] bg-slate-200 rounded-full mt-5 overflow-hidden">
          <div className="h-full bg-[#004b93] rounded-full animate-progress-fill" />
        </div>
      </div>
    </div>
  );
}
