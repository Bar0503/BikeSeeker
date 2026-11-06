import { useState } from "react";
import { createPortal } from "react-dom";
import type { Group, GroupCreate, GroupUpdate } from "../types/bike";

// Csoport kezelo komponens bemeneti parameterei
interface GroupManagerProps {
  readonly groups: readonly Group[];
  readonly selectedGroupId?: number;
  readonly onSelectGroup: (groupId: number | undefined) => void;
  readonly onCreateGroup: (data: GroupCreate) => Promise<void>;
  readonly onUpdateGroup: (id: number, data: GroupUpdate) => Promise<void>;
  readonly onDeleteGroup: (id: number) => Promise<void>;
  readonly onOpenCreateItem?: () => void;
}

// Csoportok CRUD vezerleset es listazasanak szureset vegzo komponens
export function GroupManager({
  groups,
  selectedGroupId,
  onSelectGroup,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onOpenCreateItem,
}: GroupManagerProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);

  const [formName, setFormName] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Uj csoport letrehozasa ablak megnyitasa
  const handleOpenCreate = (): void => {
    setFormName("");
    setFormDescription("");
    setErrorMessage(null);
    setIsCreateModalOpen(true);
  };

  // Meglevo csoport szerkesztese ablak megnyitasa
  const handleOpenEdit = (group: Group): void => {
    setEditingGroup(group);
    setFormName(group.name);
    setFormDescription(group.description ?? "");
    setErrorMessage(null);
  };

  // Uj csoport mentese
  const handleSubmitCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMessage("A csoport neve kötelező!");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onCreateGroup({
        name: formName.trim(),
        description: formDescription.trim() || null,
      });
      setIsCreateModalOpen(false);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Hiba történt a mentéskor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Meglevo csoport frissitese
  const handleSubmitUpdate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!editingGroup) {
      return;
    }
    if (!formName.trim()) {
      setErrorMessage("A csoport neve nem lehet üres!");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onUpdateGroup(editingGroup.id, {
        name: formName.trim(),
        description: formDescription.trim() || null,
      });
      setEditingGroup(null);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Hiba történt a módosításkor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Csoport vegleges torlese megerosites utan
  const handleConfirmDelete = async (id: number): Promise<void> => {
    setIsSubmitting(true);
    try {
      if (selectedGroupId === id) {
        onSelectGroup(undefined);
      }
      await onDeleteGroup(id);
      setDeletingGroupId(null);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Hiba történt a törlés során.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <div className="mb-6 bg-[#121f17] border border-emerald-900/30 rounded-2xl p-4 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Gyűjtemények és Csoportok
          </span>
          <span className="text-[11px] text-stone-400">({groups.length} db)</span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onOpenCreateItem && (
            <button
              type="button"
              onClick={onOpenCreateItem}
              className="text-xs bg-[#0a120d] hover:bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span>+</span>
              <span>Külső hirdetés mentése</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenCreate}
            className="text-xs bg-emerald-700/60 hover:bg-emerald-600 text-emerald-100 hover:text-white font-medium px-3 py-1.5 rounded-lg border border-emerald-600/50 transition-colors flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Új csoport</span>
          </button>
        </div>
      </div>

      {/* Csoportok vizszintesen gorgetheto fulei */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button
          type="button"
          onClick={() => onSelectGroup(undefined)}
          className={`text-xs px-3.5 py-1.5 rounded-xl border font-medium whitespace-nowrap transition-colors ${
            selectedGroupId === undefined
              ? "bg-emerald-600 text-stone-950 border-emerald-500 font-semibold shadow-sm shadow-emerald-950"
              : "bg-[#0a120d] text-stone-300 border-emerald-900/40 hover:border-emerald-600"
          }`}
        >
          Összes tétel
        </button>

        {groups.map((group) => {
          const isSelected = group.id === selectedGroupId;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              className={`text-xs px-3.5 py-1.5 rounded-xl border font-medium whitespace-nowrap flex items-center gap-2 transition-colors ${
                isSelected
                  ? "bg-emerald-600 text-stone-950 border-emerald-500 font-semibold shadow-sm shadow-emerald-950"
                  : "bg-[#0a120d] text-stone-300 border-emerald-900/40 hover:border-emerald-600"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5"
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
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? "bg-stone-950 text-emerald-300" : "bg-emerald-950 text-emerald-400"
                }`}
              >
                {group.item_count ?? group.items_count ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Aktualisan kivalasztott csoport reszletei*/}
      {activeGroup && (
        <div className="mt-3 pt-3 border-t border-emerald-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-emerald-400">
              Kiválasztott: 
            </span>
                <span>
                  {activeGroup.name}
                </span>
                {activeGroup.description && (
                    <span className="text-stone-400">
                      ({activeGroup.description})
                    </span>
            )}
        </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenEdit(activeGroup)}
              className="text-[11px] bg-[#0a120d] text-emerald-300 hover:text-emerald-200 border border-emerald-800/50 px-2.5 py-1 rounded-md transition-colors"
            >
              ✎ Szerkesztés
            </button>
            <button
              type="button"
              onClick={() => setDeletingGroupId(activeGroup.id)}
              className="text-[11px] bg-rose-950/40 text-rose-300 hover:text-rose-200 border border-rose-900/50 px-2.5 py-1 rounded-md transition-colors"
            >
              ✕ Törlés
            </button>
          </div>
        </div>
      )}

      {/* Uj csoport letrehozasa modalis ablak */}
      {isCreateModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <form
              onSubmit={handleSubmitCreate}
              className="bg-[#0e1711] border border-emerald-900/60 rounded-2xl max-w-md w-full p-6 text-stone-100 shadow-2xl space-y-4"
            >
              <h3 className="text-base font-bold text-stone-100">Új csoport létrehozása</h3>
              {errorMessage && (
                <div className="text-xs text-rose-300 bg-rose-950/50 border border-rose-900/60 p-2.5 rounded-lg">
                  {errorMessage}
                </div>
              )}
              <div>
                <label htmlFor="create-group-name" className="block text-xs text-stone-400 mb-1">
                  Csoport neve *
                </label>
                <input
                  id="create-group-name"
                  type="text"
                  required
                  placeholder="pl. Kiszemelt bringák"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label htmlFor="create-group-desc" className="block text-xs text-stone-400 mb-1">
                  Leírás (opcionális)
                </label>
                <input
                  id="create-group-desc"
                  type="text"
                  placeholder="Rövid leírás a projektről vagy célról..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
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
                  {isSubmitting ? "Mentés..." : "Létrehozás"}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Meglevo csoport szerkesztese modalis ablak */}
      {editingGroup &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <form
              onSubmit={handleSubmitUpdate}
              className="bg-[#0e1711] border border-emerald-900/60 rounded-2xl max-w-md w-full p-6 text-stone-100 shadow-2xl space-y-4"
            >
              <h3 className="text-base font-bold text-stone-100">Csoport szerkesztése</h3>
              {errorMessage && (
                <div className="text-xs text-rose-300 bg-rose-950/50 border border-rose-900/60 p-2.5 rounded-lg">
                  {errorMessage}
                </div>
              )}
              <div>
                <label htmlFor="edit-group-name" className="block text-xs text-stone-400 mb-1">
                  Csoport neve *
                </label>
                <input
                  id="edit-group-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label htmlFor="edit-group-desc" className="block text-xs text-stone-400 mb-1">
                  Leírás
                </label>
                <input
                  id="edit-group-desc"
                  type="text"
                  placeholder="Rövid leírás a projektről vagy célról..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
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
                  {isSubmitting ? "Mentés..." : "Frissítés"}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Csoport torlesenek jovahagyasa parbeszedpanel */}
      {deletingGroupId !== null &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0e1711] border border-rose-900/50 rounded-2xl max-w-sm w-full p-6 text-stone-100 shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-rose-300">Csoport törlése</h3>
              <p className="text-xs text-stone-300">
                Biztosan törlöd ezt a csoportot? A benne lévő kerékpárok és alkatrészek nem törlődnek az adatbázisból, csak a gyűjtemény szűnik meg.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingGroupId(null)}
                  disabled={isSubmitting}
                  className="text-xs text-stone-400 hover:text-stone-200 px-3 py-2"
                >
                  Mégse
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmDelete(deletingGroupId)}
                  disabled={isSubmitting}
                  className="text-xs font-semibold bg-rose-700 hover:bg-rose-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? "Törlés..." : "Igen, törlöm"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}