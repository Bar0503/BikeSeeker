import { useEffect } from "react";

interface SplashScreenProps {
  readonly onFinish: () => void;
  readonly username?: string;
}

export function SplashScreen({ onFinish, username }: SplashScreenProps) {
  // Splash animacio idozitese es automatikus lezarasa 2.4 masodperc utan
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2400);

    return () => {
      clearTimeout(timer);
    };
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 bg-[#070d09] flex flex-col items-center justify-center p-6 select-none overflow-hidden">
      <div className="animate-splash flex flex-col items-center text-center">
        {/* Kerekpar ikon*/}
        <div className="w-20 h-20 mb-5 rounded-2xl bg-[#121f17] border border-emerald-600/40 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.35)]">
          <svg
            className="w-11 h-11 text-emerald-400 animate-pulse"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="5.5" cy="17" r="3.5" />
            <circle cx="18.5" cy="17" r="3.5" />
            <path d="M5.5 17l3.5-7.5 3 7.5H5.5z" />
            <path d="M9 9.5h6l-3 7.5" />
            <path d="M18.5 17L15 9.5l-.5-2h2.5" />
            <path d="M9 9.5L8.5 8h2.5" />
          </svg>
        </div>

        {/* Kozepen megjeleno animalt BikeSeeker felirat */}
        <h1 className="text-4xl md:text-5xl font-black text-stone-100 tracking-tight mb-2">
          Bike<span className="text-emerald-400">Seeker</span>
        </h1>

        <p className="text-sm md:text-base font-medium text-emerald-300/80">
          Kerékpár & Alkatrész Aggregátor Motor
        </p>

        {username && (
          <span className="mt-4 text-xs text-stone-400 bg-emerald-950/40 border border-emerald-900/40 px-3 py-1 rounded-full">
            Üdvözlünk, <strong className="text-emerald-300 font-semibold">{username}</strong>!
          </span>
        )}
      </div>
    </div>
  );
}