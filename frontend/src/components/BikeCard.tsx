import type { Bike } from "../types/bike";

interface BikeCardProps {
  bike: Bike;
}

export function BikeCard({ bike }: BikeCardProps) {
  const formattedPrice =
    bike.price !== null
      ? `${bike.price.toLocaleString("hu-HU")} Ft`
      : "Ár megegyezés szerint";

  return (
    <div className="bg-[#121f17] border border-emerald-900/30 rounded-xl p-5 hover:border-emerald-500/50 transition-all flex flex-col justify-between shadow-md hover:shadow-emerald-950/40">
      <div>
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

        <h3 className="font-semibold text-stone-100 text-sm md:text-base leading-snug line-clamp-2 mb-3">
          {bike.title}
        </h3>
      </div>

      <div className="pt-4 border-t border-emerald-900/30 flex items-center justify-between gap-3 mt-2">
        <span
          className={`text-sm md:text-base font-bold ${
            bike.price !== null ? "text-emerald-400" : "text-stone-400 text-xs"
          }`}
        >
          {formattedPrice}
        </span>

        <a
          href={bike.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs bg-emerald-800/60 hover:bg-emerald-600 text-emerald-100 hover:text-white font-medium px-3.5 py-1.5 rounded-lg border border-emerald-700/40 transition-colors"
        >
          Megnyitás
        </a>
      </div>
    </div>
  );
}