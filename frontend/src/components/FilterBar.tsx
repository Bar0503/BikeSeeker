import type { BikeQueryParams, SortOption } from "../types/bike";

interface FilterBarProps {
  filters: BikeQueryParams;
  onFilterChange: (updated: Partial<BikeQueryParams>) => void;
  onReset: () => void;
}

export function FilterBar({ filters, onFilterChange, onReset }: FilterBarProps) {
  return (
    <div className="bg-[#121f17]/90 border border-emerald-900/30 rounded-2xl p-5 mb-8 shadow-xl backdrop-blur-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Szöveges keresés */}
        <div className="lg:col-span-2">
          <label className="block text-[11px] font-medium text-emerald-200/70 mb-1">
            Keresés típusra, márkára
          </label>
          <input
            type="text"
            placeholder="pl. Genesis, Trek, gravel..."
            value={filters.query || ""}
            onChange={(e) => onFilterChange({ query: e.target.value, page: 1 })}
            className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Minimális ár */}
        <div>
          <label className="block text-[11px] font-medium text-emerald-200/70 mb-1">
            Min. ár (Ft)
          </label>
          <input
            type="number"
            placeholder="0"
            value={filters.min_price ?? ""}
            onChange={(e) =>
              onFilterChange({
                min_price: e.target.value ? Number(e.target.value) : undefined,
                page: 1,
              })
            }
            className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Maximális ár */}
        <div>
          <label className="block text-[11px] font-medium text-emerald-200/70 mb-1">
            Max. ár (Ft)
          </label>
          <input
            type="number"
            placeholder="pl. 150000"
            value={filters.max_price ?? ""}
            onChange={(e) =>
              onFilterChange({
                max_price: e.target.value ? Number(e.target.value) : undefined,
                page: 1,
              })
            }
            className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Rendezés */}
        <div>
          <label className="block text-[11px] font-medium text-emerald-200/70 mb-1">
            Rendezés
          </label>
          <select
            value={filters.sort_by || ""}
            onChange={(e) =>
              onFilterChange({
                sort_by: (e.target.value as SortOption) || undefined,
                page: 1,
              })
            }
            className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
          >
            <option value="">Alapértelmezett</option>
            <option value="price_asc">Ár: növekvő</option>
            <option value="price_desc">Ár: csökkenő</option>
          </select>
        </div>
      </div>

      {/* Szűrők törlése gomb */}
      {(filters.query || filters.min_price || filters.max_price || filters.sort_by) && (
        <div className="mt-4 pt-3 border-t border-emerald-900/30 flex justify-end">
          <button
            onClick={onReset}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            Szűrők alaphelyzetbe állítása
          </button>
        </div>
      )}
    </div>
  );
}