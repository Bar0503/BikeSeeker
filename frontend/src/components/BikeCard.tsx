import type { Bike } from "../types/bike";

// Kerekpar kartya komponens bemeneti tulajdonsagai
interface BikeCardProps {
  readonly bike: Bike;
}

// Modul-szintu magyar szamformazo peldany az arak hatekony ezres tagolasahoz
const HUF_FORMATTER = new Intl.NumberFormat("hu-HU");

// Kulso hirdetes URL sema ellenorzese XSS tamadasok ellen
function isSafeHttpUrl(rawUrl: string): boolean {
  return rawUrl.startsWith("https://") || rawUrl.startsWith("http://");
}

// Egyetlen kerekpar hirdetes kartya megjelenitese
export function BikeCard({ bike }: BikeCardProps) {
  // Ar formazasa forintban vagy alapertelmezett szoveg megjelenitese, ha nincs megadva ar
  const formattedPrice =
    bike.price !== null
      ? `${HUF_FORMATTER.format(bike.price)} Ft`
      : "Ár megegyezés szerint";

  const hasValidUrl = isSafeHttpUrl(bike.url);

  return (
    <div className="bg-[#121f17] border border-emerald-900/30 rounded-xl p-5 hover:border-emerald-500/50 transition-all flex flex-col justify-between shadow-md hover:shadow-emerald-950/40">
      <div>
        {/* Helyszin es pozicio ikon megjelenitese, ha a hirdetes tartalmaz telepulesnevet */}
        {bike.location && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400/80 mb-2.5">
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="truncate">{bike.location}</span>
          </div>
        )}

        {/* Hirdetes cimenek megjelenitese maximum ket sorban */}
        <h3 className="font-semibold text-stone-100 text-sm md:text-base leading-snug line-clamp-2 mb-3">
          {bike.title}
        </h3>
      </div>

      {/* Kartya also savja a formazott arral es az eredeti hirdetesre mutato gombbal */}
      <div className="pt-4 border-t border-emerald-900/30 flex items-center justify-between gap-3 mt-2">
        <span
          className={`text-sm md:text-base font-bold ${
            bike.price !== null ? "text-emerald-400" : "text-stone-400 text-xs"
          }`}
        >
          {formattedPrice}
        </span>

        {hasValidUrl && (
          <a
            href={bike.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-emerald-800/60 hover:bg-emerald-600 text-emerald-100 hover:text-white font-medium px-3.5 py-1.5 rounded-lg border border-emerald-700/40 transition-colors"
          >
            Megnyitás
          </a>
        )}
      </div>
    </div>
  );
}