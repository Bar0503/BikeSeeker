// Lapozo komponens bemeneti tulajdonsagai
interface PaginationProps {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly onPageChange: (newPage: number) => void;
}

// Lapozo navigacio megjelenitese tobboldalas talalati lista eseten
export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  // Oldalvaltas ervenyesitese hatarertekek kozott
  const handlePageStep = (targetPage: number): void => {
    if (targetPage < 1 || targetPage > totalPages || targetPage === currentPage) {
      return;
    }
    onPageChange(targetPage);
  };

  return (
    <div className="flex items-center justify-center gap-3 mt-10">
      {/* Elozo oldalra lepes gombja */}
      <button
        type="button"
        onClick={() => handlePageStep(currentPage - 1)}
        disabled={currentPage <= 1}
        className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#121f17] border border-emerald-900/40 text-stone-300 hover:bg-emerald-900/30 hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        &larr; Előző
      </button>

      {/* Aktualis es osszes oldalszam kijelzese */}
      <span className="text-xs text-emerald-200/60">
        <strong className="text-emerald-400">{currentPage}</strong> / {totalPages} oldal
      </span>

      {/* Kovetkezo oldalra lepes gombja */}
      <button
        type="button"
        onClick={() => handlePageStep(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#121f17] border border-emerald-900/40 text-stone-300 hover:bg-emerald-900/30 hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Következő &rarr;
      </button>
    </div>
  );
}