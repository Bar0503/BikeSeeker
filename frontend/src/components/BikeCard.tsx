import { useState } from "react";
import type { Group, Item } from "../types/bike";

// Kerekpar kartya bemeneti tulajdonsagai kibovitve csoportokkal es CRUD muveletekkel
interface BikeCardProps {
  readonly bike: Item;
  readonly groups: readonly Group[];
  readonly activeGroupId?: number;
  readonly onEdit: (item: Item) => void;
  readonly onToggleGroup: (
    groupId: number,
    itemId: number,
    isInGroup: boolean
  ) => Promise<void>;
  readonly onClearNotes: (id: number) => Promise<void>;
}

// Modul-szintu magyar szamformazo peldany az arak hatekony ezres tagolasahoz
const HUF_FORMATTER = new Intl.NumberFormat("hu-HU");

// Kulso hirdetes URL sema ellenorzese XSS tamadasok ellen
function isSafeHttpUrl(rawUrl: string): boolean {
  return rawUrl.startsWith("https://") || rawUrl.startsWith("http://");
}

// Egyetlen kerekpar hirdetes kartya megjelenitese
export function BikeCard({
  bike,
  groups,
  activeGroupId,
  onEdit,
  onToggleGroup,
  onClearNotes,
}: BikeCardProps) {
  const [isRemovingFromGroup, setIsRemovingFromGroup] = useState<boolean>(false);
  const [isClearingNotes, setIsClearingNotes] = useState<boolean>(false);
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState<boolean>(false);
  const [groupLoadingId, setGroupLoadingId] = useState<number | null>(null);

  // Megjegyzes torlese megerositessel
  const handleClearNotesClick = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    const confirmed = window.confirm("Biztosan törlöd a hirdetéshez tartozó saját jegyzetet?");
    if (!confirmed) {
      return;
    }
    setIsClearingNotes(true);
    try {
      await onClearNotes(bike.id);
    } finally {
      setIsClearingNotes(false);
    }
  };

  // Tetel eltavolitasa az aktiv csoportbol
  const handleRemoveFromCurrentGroup = async (): Promise<void> => {
    if (!activeGroupId) {
      return;
    }
    setIsRemovingFromGroup(true);
    try {
      await onToggleGroup(activeGroupId, bike.id, true);
    } finally {
      setIsRemovingFromGroup(false);
    }
  };

  const formattedPrice =
    bike.price !== null
      ? `${HUF_FORMATTER.format(bike.price)} Ft`
      : "Ár megegyezés szerint";

  const hasValidUrl = isSafeHttpUrl(bike.url);
  const assignedGroupIds = bike.group_ids ?? [];

  // Csoport tagsag ki- es bekapcsolasa
  const handleToggleGroupClick = async (groupId: number): Promise<void> => {
    const isIn = assignedGroupIds.includes(groupId);
    setGroupLoadingId(groupId);
    try {
      await onToggleGroup(groupId, bike.id, isIn);
    } finally {
      setGroupLoadingId(null);
    }
  };

  return (
    <div className="bg-[#121f17] border border-emerald-900/30 rounded-xl p-5 hover:border-emerald-500/50 transition-all flex flex-col justify-between shadow-md hover:shadow-emerald-950/40 relative">
      <div>
        {/* Kategoriak es forras cimkei */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              bike.item_type === "bike"
                ? "bg-emerald-950 text-emerald-300 border border-emerald-800/50"
                : "bg-teal-950 text-teal-300 border border-teal-800/50"
            }`}
          >
            {bike.item_type === "bike" ? "Kerékpár" : "Alkatrész"}
          </span>

          <span className="text-[10px] font-semibold bg-[#0a120d] text-stone-300 border border-emerald-900/40 px-2 py-0.5 rounded-full">
            {bike.category}
          </span>

          <span className="text-[10px] text-stone-500 ml-auto">
            {bike.source}
          </span>
        </div>

        {/* Helyszin megjelenitese */}
        {bike.location && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400/80 mb-2">
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

        {/* Hirdetes cime */}
        <h3 className="font-semibold text-stone-100 text-sm md:text-base leading-snug line-clamp-2 mb-2">
          {bike.title}
        </h3>

        {/* Szemelyes jegyzet doboz jobb felso ceruza es kuka funkciogombokkal */}
        {bike.notes && (
          <div className="bg-emerald-950/40 border border-emerald-800/40 text-emerald-200/90 rounded-lg p-2.5 mb-2.5 flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="block font-semibold text-emerald-400 text-[11px] mb-0.5">
                Személyes jegyzet:
              </span>
              <p className="italic text-stone-200 text-xs break-words">{bike.notes}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => onEdit(bike)}
                className="text-stone-400 hover:text-emerald-300 p-1 rounded hover:bg-emerald-900/40 transition-colors"
                title="Jegyzet szerkesztése"
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
              <button
                type="button"
                disabled={isClearingNotes}
                onClick={handleClearNotesClick}
                className="text-stone-400 hover:text-rose-400 p-1 rounded hover:bg-rose-950/40 transition-colors disabled:opacity-50"
                title="Jegyzet törlése"
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Hozzarendelt csoportok cimkei*/}
        {assignedGroupIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mb-2">
            {assignedGroupIds.map((groupId) => {
              const grp = groups.find((g) => g.id === groupId);
              return (
                <span
                  key={groupId}
                  className="text-[10px] bg-emerald-900/40 text-emerald-300 border border-emerald-800/50 px-1.5 py-0.5 rounded flex items-center gap-1"
                >
                  <svg
                    className="w-3 h-3 text-emerald-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>{grp?.name ?? `Csoport #${groupId}`}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Kartya also vezerlosavja */}
      <div className="pt-3 border-t border-emerald-900/30 flex flex-col gap-2 mt-2">
        <div className="flex items-center justify-between">
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
              className="text-xs bg-emerald-800/60 hover:bg-emerald-600 text-emerald-100 hover:text-white font-medium px-3 py-1.5 rounded-lg border border-emerald-700/40 transition-colors"
            >
              Megnyitás
            </a>
          )}
        </div>

        {/* CRUD muveleti gombsor */}
        <div className="flex items-center justify-between pt-2 border-t border-emerald-950">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsGroupDropdownOpen((prev) => !prev)}
              className="text-stone-400 hover:text-emerald-300 p-1.5 rounded-lg border border-emerald-900/50 hover:border-emerald-600/50 bg-[#0a120d] transition-colors flex items-center justify-center"
              title="Csoportok kezelése"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            {isGroupDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-44 bg-[#0a120d] border border-emerald-900/80 rounded-xl p-1.5 shadow-2xl z-20 space-y-1">
                <div className="text-[10px] font-semibold text-stone-400 px-2 py-1 border-b border-emerald-950">
                  Csoportok (N:M):
                </div>
                {groups.length === 0 ? (
                  <div className="text-[10px] text-stone-500 px-2 py-1">
                    Nincs még csoport
                  </div>
                ) : (
                  groups.map((group) => {
                    const isIn = assignedGroupIds.includes(group.id);
                    const isLoading = groupLoadingId === group.id;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleToggleGroupClick(group.id)}
                        className={`w-full text-left text-xs px-2 py-1 rounded flex items-center justify-between transition-colors ${
                          isIn
                            ? "bg-emerald-950/80 text-emerald-300 font-semibold"
                            : "hover:bg-emerald-900/30 text-stone-300"
                        }`}
                      >
                        <span className="truncate">{group.name}</span>
                        <span className="text-[10px]">
                          {isLoading ? "..." : isIn ? "✓" : "+"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onEdit(bike)}
              className="text-stone-400 hover:text-emerald-300 p-1.5 rounded-lg border border-emerald-900/50 hover:border-emerald-600/50 bg-[#0a120d] transition-colors flex items-center justify-center"
              title={bike.notes ? "Jegyzet megtekintése / szerkesztése" : "Jegyzet hozzáadása"}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <line x1="8" y1="9" x2="16" y2="9" />
                <line x1="8" y1="13" x2="13" y2="13" />
              </svg>
            </button>
            {activeGroupId !== undefined && (
              <button
                type="button"
                disabled={isRemovingFromGroup}
                onClick={handleRemoveFromCurrentGroup}
                className="text-[11px] bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 hover:text-rose-200 border border-rose-900/50 px-2 py-1 rounded transition-colors disabled:opacity-50"
                title="Eltávolítás ebből a csoportból"
              >
                {isRemovingFromGroup ? "..." : "✕"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}