import { useEffect, useState, type SyntheticEvent } from "react";
import {
  BIKE_CATEGORIES,
  PART_CATEGORIES,
  SOURCES,
  type Group,
  type Item,
  type ItemCategory,
  type ItemCreate,
  type ItemType,
  type ItemUpdate,
  type ScrapeSource,
} from "../types/bike";

// Uj tetel modalis ablak bemeneti parameterei
interface ItemEditModalProps {
  readonly isOpen: boolean;
  readonly item: Item | null;
  readonly groups: readonly Group[];
  readonly onClose: () => void;
  readonly onSave: (
    payload: ItemCreate | ItemUpdate,
    isEdit: boolean
  ) => Promise<void>;
}

export function ItemEditModal({
  isOpen,
  item,
  groups,
  onClose,
  onSave,
}: ItemEditModalProps) {
  // Urlap mezok allapotai
  const [title, setTitle] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [source, setSource] = useState<ScrapeSource>("bringakereso");
  const [itemType, setItemType] = useState<ItemType>("bike");
  const [category, setCategory] = useState<ItemCategory>("MTB");
  const [notes, setNotes] = useState<string>("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEdit = item !== null;

  // Mezok szinkronizalasa megnyitaskor
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(false);

    if (item) {
      setTitle(item.title);
      setPrice(item.price !== null ? item.price.toString() : "");
      setLocation(item.location ?? "");
      setUrl(item.url);
      setSource((item.source as ScrapeSource) || "bringakereso");
      setItemType(item.item_type);
      setCategory(item.category);
      setNotes(item.notes ?? "");
      setSelectedGroupIds(item.group_ids ? [...item.group_ids] : []);
    } else {
      setTitle("");
      setPrice("");
      setLocation("");
      setUrl("");
      setSource("bringakereso");
      setItemType("bike");
      setCategory("MTB");
      setNotes("");
      setSelectedGroupIds([]);
    }
  }, [isOpen, item]);

  if (!isOpen) {
    return null;
  }

  // Fotipus valtasakor az alapertelmezett kategoria igazitasa
  const handleItemTypeChange = (newType: ItemType): void => {
    setItemType(newType);
    setCategory(newType === "bike" ? "MTB" : "Villa");
  };

  // Csoport tagsag valtasa
  const handleToggleGroup = (groupId: number): void => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  // Urlap bekuldesenek kezelese es oldalujratoltes megakadalyozasa
  const handleSubmit = async (e: SyntheticEvent): Promise<void> => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("A hirdetés címe kötelező!");
      return;
    }

    const parsedPrice = price.trim() ? Math.max(0, parseInt(price, 10)) : null;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (isEdit) {
        const payload: ItemUpdate = {
          title: title.trim(),
          price: parsedPrice,
          location: location.trim() || null,
          item_type: itemType,
          category,
          notes: notes.trim() || null,
        };
        await onSave(payload, true);
      } else {
        const fullUrl = url.trim() || `https://bringakereso.hu/hirdetes/manual-${Date.now()}`;
        const payload: ItemCreate = {
          title: title.trim(),
          price: parsedPrice,
          location: location.trim() || null,
          url: fullUrl,
          source,
          item_type: itemType,
          category,
          notes: notes.trim() || null,
          group_ids: selectedGroupIds,
        };
        await onSave(payload, false);
      }
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Hiba történt a mentés során."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0e1711] border border-emerald-900/60 rounded-2xl max-w-xl w-full p-6 text-stone-100 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-3 border-b border-emerald-900/40">
          <h2 className="text-lg font-bold text-stone-100">
            {isEdit ? "Hirdetés és jegyzet szerkesztése" : "Külső hirdetés mentése a gyűjteménybe"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-stone-400 hover:text-stone-200 text-lg font-bold p-1"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="mt-3 bg-rose-950/50 border border-rose-900/70 text-rose-300 text-xs px-3 py-2 rounded-lg">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 mt-4 space-y-3.5">
          {/* Cím bevitele vagy modositasa */}
          <div>
            <label className="block text-[11px] font-medium text-emerald-300/80 mb-1">
              Hirdetés címe *
            </label>
            <input
              type="text"
              required
              placeholder="pl. Trek Remedy 8 2022 Enduro..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Fotipus es alkategoria valasztas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-emerald-300/80 mb-1">
                Főtípus
              </label>
              <select
                value={itemType}
                onChange={(e) => handleItemTypeChange(e.target.value as ItemType)}
                className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="bike">Kerékpár</option>
                <option value="part">Alkatrész</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-emerald-300/80 mb-1">
                Alkategória
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ItemCategory)}
                className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-emerald-500"
              >
                {itemType === "bike"
                  ? BIKE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))
                  : PART_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
              </select>
            </div>
          </div>

          {/* Ar es helyszin megadasa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-emerald-300/80 mb-1">
                Ár (Ft)
              </label>
              <input
                type="number"
                min={0}
                placeholder="pl. 240000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-emerald-300/80 mb-1">
                Helyszín
              </label>
              <input
                type="text"
                placeholder="pl. Budapest, Győr..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Piacter es eredeti URL beallitasa uj tetel eseten */}
          {!isEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-emerald-300/80 mb-1">
                  Forrás piactér
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as ScrapeSource)}
                  className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-emerald-500"
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-emerald-300/80 mb-1">
                  Eredeti URL
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Szemelyes feljegyzes*/}
          <div>
            <label className="block text-[11px] font-medium text-emerald-300/80 mb-1">
              {isEdit
                ? "Saját megjegyzés a hirdetéshez (pl. karcos becsúszó, 220e Ft-ra lealkudva, telefonon egyeztetve)"
                : "Egyedi megjegyzés (opcionális)"}
            </label>
            <input
              type="text"
              placeholder="Írj ide saját megjegyzést..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-emerald-500"
              autoFocus={isEdit}
            />
          </div>

          {!isEdit && groups.length > 0 && (
            <div>
              <span className="block text-[11px] font-medium text-emerald-300/80 mb-1.5">
                Csoportok hozzárendelése mentéskor:
              </span>
              <div className="flex flex-wrap gap-2">
                {groups.map((group) => {
                  const selected = selectedGroupIds.includes(group.id);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => handleToggleGroup(group.id)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1.5 ${
                        selected
                          ? "bg-emerald-600 text-stone-950 border-emerald-500 font-semibold"
                          : "bg-[#0a120d] text-stone-300 border-emerald-900/40 hover:border-emerald-600"
                      }`}
                    >
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      <span>{group.name}</span>
                      {selected && <span>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-emerald-900/40">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs text-stone-400 hover:text-stone-200 px-3 py-2"
            >
              Mégse
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-stone-950 px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {isSubmitting
                ? "Mentés folyamatban..."
                : isEdit
                ? "Módosítások mentése"
                : "Hirdetés mentése"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}