import type { BikeCategory, BikeQueryParams, ItemCategory, PartCategory, SortOption } from "../types/bike";

// Kategoriak felsorolasa a szuromezohoz
const BIKE_CATEGORIES: readonly BikeCategory[] = ["MTB", "Trail", "Enduro", "DH", "E-Bike"];
const PART_CATEGORIES: readonly PartCategory[] = [
  "Villa",
  "Váz",
  "Fék",
  "Váltó",
  "Kerékszett",
  "Hajtás",
];

// Engedelyezett oldalméretek es az alapertelmezett ertek
const DEFAULT_PAGE_SIZE = 12;
const PAGE_SIZE_OPTIONS: readonly number[] = [12, 20, 50, 100];

// Szurosav komponens bemeneti tulajdonsagai
interface FilterBarProps {
  readonly filters: BikeQueryParams;
  readonly onFilterChange: (updated: Partial<BikeQueryParams>) => void;
  readonly onReset: () => void;
}

// Ar bemenet validalasa
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
  // Szurofeltetel vagy egyedi oldalmeret ellenorzes
  const hasActiveFilters = Boolean(
    filters.query ||
      filters.category ||
      filters.min_price !== undefined ||
      filters.max_price !== undefined ||
      filters.location ||
      filters.sort_by ||
      (filters.page_size !== undefined && filters.page_size !== DEFAULT_PAGE_SIZE)
  );

  return (
    <div className="bg-[#121f17]/90 border border-emerald-900/30 rounded-2xl p-5 mb-8 shadow-xl backdrop-blur-sm">
      {/* Dinamikus rugalmas szurosav */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Szoveges kereses mezo */}
        <div className="w-64">
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

        {/* Kategoria valaszto mezo */}
        <div className="w-44">
          <label
            htmlFor="filter-category"
            className="block text-[11px] font-medium text-emerald-200/70 mb-1"
          >
            Kategória
          </label>
          <select
            id="filter-category"
            value={filters.category ?? ""}
            onChange={(e) =>
              onFilterChange({
                category: (e.target.value as ItemCategory) || undefined,
                page: 1,
              })
            }
            className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
          >
            <option value="">Összes kategória</option>
            <optgroup label="Kerékpárok">
              {BIKE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </optgroup>
            <optgroup label="Alkatrészek">
              {PART_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Helyszin mezo */}
        <div className="w-48">
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

        {/* Minimalis ar mezo */}
        <div className="w-32">
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

        {/* Maximalis ar mezo */}
        <div className="w-32">
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

        {/* Rendezes valaszto mezo*/}
        <div className="w-40">
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

        {/* Elemek szama oldalankent */}
        <div className="w-28">
          <label
            htmlFor="filter-page-size"
            className="block text-[11px] font-medium text-emerald-200/70 mb-1"
          >
            Találat / oldal
          </label>
          <select
            id="filter-page-size"
            value={filters.page_size ?? DEFAULT_PAGE_SIZE}
            onChange={(e) =>
              onFilterChange({
                page_size: Number(e.target.value),
                page: 1,
              })
            }
            className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} db
              </option>
            ))}
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