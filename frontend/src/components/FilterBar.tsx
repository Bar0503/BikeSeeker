import type { BikeQueryParams, SortOption } from "../types/bike";

// Szurosav komponens bemeneti tulajdonsagai
interface FilterBarProps {
  readonly filters: BikeQueryParams;
  readonly onFilterChange: (updated: Partial<BikeQueryParams>) => void;
  readonly onReset: () => void;
}

// Ar bemenet validalasa: ures, ervenytelen vagy negativ ertekek kiszurese
function parsePriceInput(rawValue: string): number | undefined {
  if (!rawValue.trim()) {
    return undefined;
  }
  const parsed = Number(rawValue);
  if (Number.isNaN(parsed) || parsed < 0) {
    return undefined;
  }
  return Math.floor(parsed);
}

// Keresesi es szuresi vezerlopanel komponens
export function FilterBar({ filters, onFilterChange, onReset }: FilterBarProps) {
  // Ellenorizzuk, hogy van-e barmilyen aktiv szurofeltetel beallitva (a 0 Ft is ervenyes szuro)
  const hasActiveFilters = Boolean(
    filters.query ||
      filters.min_price !== undefined ||
      filters.max_price !== undefined ||
      filters.location ||
      filters.sort_by
  );

  return (
    <div className="bg-[#121f17]/90 border border-emerald-900/30 rounded-2xl p-5 mb-8 shadow-xl backdrop-blur-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Szoveges kereses mezo */}
        <div className="lg:col-span-2">
          <label
            htmlFor="filter-query"
            className="block text-[11px] font-medium text-emerald-200/70 mb-1"
          >
            Keresés típusra, márkára
          </label>
          <input
            id="filter-query"
            type="text"
            placeholder="pl. Genesis, Trek, Merida..."
            value={filters.query ?? ""}
            onChange={(e) => onFilterChange({ query: e.target.value, page: 1 })}
            className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Helyszin szuro mezo */}
        <div>
          <label
            htmlFor="filter-location"
            className="block text-[11px] font-medium text-emerald-200/70 mb-1"
          >
            Helyszín
          </label>
          <input
            id="filter-location"
            type="text"
            placeholder="pl. Budapest, Eger..."
            value={filters.location ?? ""}
            onChange={(e) => onFilterChange({ location: e.target.value, page: 1 })}
            className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Minimalis ar szuro mezo */}
        <div>
          <label
            htmlFor="filter-min-price"
            className="block text-[11px] font-medium text-emerald-200/70 mb-1"
          >
            Min. ár (Ft)
          </label>
          <input
            id="filter-min-price"
            type="number"
            min={0}
            placeholder="0"
            value={filters.min_price ?? ""}
            onChange={(e) =>
              onFilterChange({
                min_price: parsePriceInput(e.target.value),
                page: 1,
              })
            }
            className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Maximalis ar szuro mezo */}
        <div>
          <label
            htmlFor="filter-max-price"
            className="block text-[11px] font-medium text-emerald-200/70 mb-1"
          >
            Max. ár (Ft)
          </label>
          <input
            id="filter-max-price"
            type="number"
            min={0}
            placeholder="pl. 350000"
            value={filters.max_price ?? ""}
            onChange={(e) =>
              onFilterChange({
                max_price: parsePriceInput(e.target.value),
                page: 1,
              })
            }
            className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Rendezes kivalaszto legordulo menu */}
        <div>
          <label
            htmlFor="filter-sort"
            className="block text-[11px] font-medium text-emerald-200/70 mb-1"
          >
            Rendezés
          </label>
          <select
            id="filter-sort"
            value={filters.sort_by ?? ""}
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

      {/* Szurok alaphelyzetbe allitasa gomb, ha van aktiv szuro */}
      {hasActiveFilters && (
        <div className="mt-4 pt-3 border-t border-emerald-900/30 flex justify-end">
          <button
            type="button"
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