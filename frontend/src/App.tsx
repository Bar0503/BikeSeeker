import { useEffect, useState } from "react";
import type { Bike, BikeListResponse, BikeQueryParams } from "./types/bike";
import { fetchBikes } from "./services/bikeService";
import { BikeCard } from "./components/BikeCard";
import { FilterBar } from "./components/FilterBar";
import { Pagination } from "./components/Pagination";

const DEFAULT_FILTERS: BikeQueryParams = {
  query: "",
  min_price: undefined,
  max_price: undefined,
  sort_by: undefined,
  page: 1,
  page_size: 12,
};

function App() {
  const [data, setData] = useState<BikeListResponse | null>(null);
  const [filters, setFilters] = useState<BikeQueryParams>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchBikes(filters)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [filters]);

  const handleFilterChange = (updated: Partial<BikeQueryParams>) => {
    setFilters((prev) => ({ ...prev, ...updated }));
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <div className="min-h-screen bg-[#0a120d] text-stone-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 border-b border-emerald-950/80 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Kerékpár keresőmotor
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-stone-50 tracking-tight">
              Bike<span className="text-emerald-400">Seeker</span>
            </h1>
            <p className="text-stone-400 text-sm mt-0.5">
              Használt kerékpár aggregáló és keresőmotor
            </p>
          </div>
          {data && (
            <div className="text-xs text-stone-400 bg-[#121f17] border border-emerald-900/30 px-3 py-1.5 rounded-lg self-start md:self-auto">
              Találatok: <span className="text-emerald-400 font-semibold">{data.total}</span> db
            </div>
          )}
        </header>

        {/* Szűrő és keresőpanel */}
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        {loading && (
          <div className="text-center py-20 text-emerald-300/70 text-sm animate-pulse">
            Adatok frissítése...
          </div>
        )}

        {error && (
          <div className="bg-rose-950/40 border border-rose-900/50 text-rose-300 p-5 rounded-xl text-center max-w-lg mx-auto my-10">
            <p className="font-semibold mb-1">Hiba történt</p>
            <p className="text-xs text-rose-400">{error}</p>
          </div>
        )}

        {!loading && !error && data && data.items.length === 0 && (
          <div className="text-center py-20 bg-[#121f17]/40 border border-emerald-900/30 rounded-2xl">
            <p className="text-stone-300 font-medium">Nincs a szűrésnek megfelelő találat.</p>
            <p className="text-xs text-stone-500 mt-1">Próbálj meg kevesebb feltételt megadni.</p>
          </div>
        )}

        {!loading && !error && data && data.items.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.items.map((bike: Bike) => (
                <BikeCard key={bike.url} bike={bike} />
              ))}
            </div>

            {/* Lapozó */}
            <Pagination
              currentPage={data.page}
              totalPages={data.total_pages}
              onPageChange={(newPage) => handleFilterChange({ page: newPage })}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default App;