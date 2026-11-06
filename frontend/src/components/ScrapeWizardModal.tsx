import { useEffect, useState } from "react";
import type {
  BikeCategory,
  ItemType,
  PartCategory,
  ScrapeSource,
  ScrapeWizardConfig,
} from "../types/bike";

// Modalis ablak bemeneti parameterei
interface ScrapeWizardModalProps {
  readonly isOpen: boolean;
  readonly initialConfig?: ScrapeWizardConfig | null;
  readonly onClose: () => void;
  readonly onSaveConfig: (config: ScrapeWizardConfig) => Promise<void>;
}

// Alapertelmezett konstans ertekek es felsorolasok
const AVAILABLE_BIKE_CATEGORIES: readonly BikeCategory[] = [
  "MTB",
  "Trail",
  "Enduro",
  "DH",
  "E-Bike",
];

const AVAILABLE_PART_CATEGORIES: readonly PartCategory[] = [
  "Villa",
  "Váz",
  "Fék",
  "Váltó",
  "Kerékszett",
  "Hajtás",
];

const AVAILABLE_SOURCES: readonly {
  readonly id: ScrapeSource;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    id: "bringakereso",
    label: "Bringakereső.hu",
    description: "Orszagos online kerekpar es alkatresz hirdetesek",
  },
  {
    id: "testbike",
    label: "TestBike Bolha",
    description: "Kozossegi kerekparos aprohirdetes piacter",
  },
  {
    id: "bikemag",
    label: "Bikemag Apró",
    description: "Magyarorszag egyik legrégebbi kerekparos bazara",
  },
];

const DEFAULT_WIZARD_CONFIG: ScrapeWizardConfig = {
  item_types: ["bike", "part"],
  bike_categories: [...AVAILABLE_BIKE_CATEGORIES],
  part_categories: [...AVAILABLE_PART_CATEGORIES],
  sources: ["bringakereso", "testbike"],
};

// Tobblepcsos scrape varazslo modalis komponens
export function ScrapeWizardModal({
  isOpen,
  initialConfig,
  onClose,
  onSaveConfig,
}: ScrapeWizardModalProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [itemTypes, setItemTypes] = useState<ItemType[]>(
    initialConfig?.item_types ? [...initialConfig.item_types] : [...DEFAULT_WIZARD_CONFIG.item_types]
  );
  const [bikeCategories, setBikeCategories] = useState<BikeCategory[]>(
    initialConfig?.bike_categories ? [...initialConfig.bike_categories] : [...DEFAULT_WIZARD_CONFIG.bike_categories]
  );
  const [partCategories, setPartCategories] = useState<PartCategory[]>(
    initialConfig?.part_categories ? [...initialConfig.part_categories] : [...DEFAULT_WIZARD_CONFIG.part_categories]
  );
  const [sources, setSources] = useState<ScrapeSource[]>(
    initialConfig?.sources ? [...initialConfig.sources] : [...DEFAULT_WIZARD_CONFIG.sources]
  );
  const [saveAsDefault, setSaveAsDefault] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Modalis megnyitasakor szinkronizaljuk az allapotot a mentett preferenciakkal
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setValidationError(null);
      setSubmitting(false);
      const baseConfig = initialConfig ?? DEFAULT_WIZARD_CONFIG;
      setItemTypes([...baseConfig.item_types]);
      setBikeCategories([...baseConfig.bike_categories]);
      setPartCategories([...baseConfig.part_categories]);
      setSources([...baseConfig.sources]);
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) {
    return null;
  }

  // Tipus kijelolesenek valtasa
  const handleToggleItemType = (type: ItemType): void => {
    setValidationError(null);
    setItemTypes((prev) => {
      const exists = prev.includes(type);
      if (exists) {
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  };

  // Kerekpar kategoria kijelolesenek valtasa
  const handleToggleBikeCategory = (category: BikeCategory): void => {
    setValidationError(null);
    setBikeCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  // Alkatresz kategoria kijelolesenek valtasa
  const handleTogglePartCategory = (category: PartCategory): void => {
    setValidationError(null);
    setPartCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  // Forras piacter kijelolesenek valtasa
  const handleToggleSource = (source: ScrapeSource): void => {
    setValidationError(null);
    setSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source]
    );
  };

  // Lepes leptetese elott ellenorizzuk a kotelezo mezoket
  const handleNextStep = (): void => {
    if (currentStep === 1) {
      if (itemTypes.length === 0) {
        setValidationError("Válassz legalább egy típust (Kerékpár és/vagy Alkatrész)!");
        return;
      }
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      const bikesSelected = itemTypes.includes("bike");
      const partsSelected = itemTypes.includes("part");

      if (bikesSelected && bikeCategories.length === 0) {
        setValidationError("Legalább egy kerékpár alkategóriát jelölj be!");
        return;
      }
      if (partsSelected && partCategories.length === 0) {
        setValidationError("Legalább egy alkatrész alkategóriát jelölj be!");
        return;
      }
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      if (sources.length === 0) {
        setValidationError("Legalább egy forrásoldalt ki kell választanod!");
        return;
      }
      setCurrentStep(4);
    }
  };

  // Elozo lepesre visszalepes
  const handlePrevStep = (): void => {
    setValidationError(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  // Scraper beallitasok perzisztens mentese a profilhoz
  const handleConfirmSave = async (): Promise<void> => {
    setSubmitting(true);
    setValidationError(null);
    try {
      const config: ScrapeWizardConfig = {
        item_types: itemTypes,
        bike_categories: itemTypes.includes("bike") ? bikeCategories : [],
        part_categories: itemTypes.includes("part") ? partCategories : [],
        sources,
      };
      await onSaveConfig(config);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Nem sikerült elmenteni a beállításokat.";
      setValidationError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const isBikeActive = itemTypes.includes("bike");
  const isPartActive = itemTypes.includes("part");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0e1711] border border-emerald-900/60 rounded-2xl max-w-2xl w-full p-6 text-stone-100 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modalis fejlec es lepesjelzo */}
        <div className="flex items-center justify-between pb-4 border-b border-emerald-900/40">
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-emerald-400 uppercase">
              Scrape Varázsló • {currentStep} / 4. lépés
            </div>
            <h2 className="text-xl font-bold text-stone-100 mt-0.5">
              {currentStep === 1 && "Fő típus kiválasztása"}
              {currentStep === 2 && "Kategóriák és alkategóriák"}
              {currentStep === 3 && "Forrás piacterek kijelölése"}
              {currentStep === 4 && "Összegzés és indítás"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-stone-400 hover:text-stone-200 text-lg font-bold p-1 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Lepesmutato folyamatjelzo csik */}
        <div className="w-full bg-[#0a120d] h-1.5 rounded-full my-4 overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${(currentStep / 4) * 100}%` }}
          />
        </div>

        {/* Validacios hibauzenet sav */}
        {validationError && (
          <div className="mb-4 bg-rose-950/50 border border-rose-900/70 text-rose-300 text-xs px-3.5 py-2.5 rounded-xl">
            {validationError}
          </div>
        )}

        {/* Dinamikus lepestartalom */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* 1. Lepes: Kerekpar vagy Alkatresz */}
          {currentStep === 1 && (
            <div className="space-y-3">
              <p className="text-xs text-stone-400">
                Válaszd ki, milyen típusú hirdetéseket szeretnél letölteni és feldolgozni a piacterekről.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleToggleItemType("bike")}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    isBikeActive
                      ? "bg-emerald-950/60 border-emerald-500 text-stone-100 shadow-md shadow-emerald-950/50"
                      : "bg-[#121f17] border-emerald-900/30 text-stone-400 hover:border-emerald-700/50"
                  }`}
                >
                  <div className="text-lg font-bold flex items-center justify-between mb-1">
                    <span>Kerékpárok</span>
                    <span className="text-xs">{isBikeActive ? "✓" : "+"}</span>
                  </div>
                  <p className="text-xs text-stone-400">
                    Teljes épített bringák (MTB, Trail, Enduro, DH, E-Bike).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleItemType("part")}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    isPartActive
                      ? "bg-emerald-950/60 border-emerald-500 text-stone-100 shadow-md shadow-emerald-950/50"
                      : "bg-[#121f17] border-emerald-900/30 text-stone-400 hover:border-emerald-700/50"
                  }`}
                >
                  <div className="text-lg font-bold flex items-center justify-between mb-1">
                    <span>Alkatrészek</span>
                    <span className="text-xs">{isPartActive ? "✓" : "+"}</span>
                  </div>
                  <p className="text-xs text-stone-400">
                    Fő alkatrészek (villák, vázak, fékek, váltók, kerékszettek).
                  </p>
                </button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setItemTypes(["bike", "part"]);
                    setValidationError(null);
                  }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium"
                >
                  Mindkét főkategória kijelölése egyszerre
                </button>
              </div>
            </div>
          )}

          {/* 2. Lepes: Alkategoriak kivalasztasa */}
          {currentStep === 2 && (
            <div className="space-y-5">
              {/* Kerekpar alkategoriak blokk */}
              {isBikeActive && (
                <div className="bg-[#121f17]/70 border border-emerald-900/30 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-emerald-300">
                      Kerékpár típusok:
                    </span>
                    <div className="space-x-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setBikeCategories([...AVAILABLE_BIKE_CATEGORIES])}
                        className="text-emerald-400 hover:underline"
                      >
                        Összes
                      </button>
                      <span className="text-stone-600">|</span>
                      <button
                        type="button"
                        onClick={() => setBikeCategories([])}
                        className="text-stone-400 hover:underline"
                      >
                        Egyik sem
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_BIKE_CATEGORIES.map((cat) => {
                      const active = bikeCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => handleToggleBikeCategory(cat)}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                            active
                              ? "bg-emerald-600 text-stone-950 border-emerald-500 font-semibold"
                              : "bg-[#0a120d] text-stone-300 border-emerald-900/40 hover:border-emerald-600"
                          }`}
                        >
                          {cat} {active && "✓"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Alkatresz alkategoriak blokk */}
              {isPartActive && (
                <div className="bg-[#121f17]/70 border border-emerald-900/30 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-emerald-300">
                      Alkatrész kategóriák:
                    </span>
                    <div className="space-x-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setPartCategories([...AVAILABLE_PART_CATEGORIES])}
                        className="text-emerald-400 hover:underline"
                      >
                        Összes
                      </button>
                      <span className="text-stone-600">|</span>
                      <button
                        type="button"
                        onClick={() => setPartCategories([])}
                        className="text-stone-400 hover:underline"
                      >
                        Egyik sem
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_PART_CATEGORIES.map((cat) => {
                      const active = partCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => handleTogglePartCategory(cat)}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                            active
                              ? "bg-emerald-600 text-stone-950 border-emerald-500 font-semibold"
                              : "bg-[#0a120d] text-stone-300 border-emerald-900/40 hover:border-emerald-600"
                          }`}
                        >
                          {cat} {active && "✓"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Lepes: Forrasoldalak kivalasztasa */}
          {currentStep === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-stone-400 mb-2">
                Jelöld ki a piactereket, amelyekről le szeretnéd kérdezni a legfrissebb hirdetéseket.
              </p>
              <div className="space-y-2">
                {AVAILABLE_SOURCES.map((source) => {
                  const active = sources.includes(source.id);
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => handleToggleSource(source.id)}
                      className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-colors ${
                        active
                          ? "bg-emerald-950/50 border-emerald-500 text-stone-100"
                          : "bg-[#121f17] border-emerald-900/30 text-stone-400 hover:border-emerald-700/50"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-semibold text-stone-100">
                          {source.label}
                        </div>
                        <div className="text-xs text-stone-400">
                          {source.description}
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold border ${
                          active
                            ? "bg-emerald-500 border-emerald-400 text-stone-950"
                            : "border-stone-600 text-transparent"
                        }`}
                      >
                        ✓
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Lepes: Osszegzes es mentes */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="bg-[#121f17]/70 border border-emerald-900/40 rounded-xl p-4 text-xs space-y-2.5">
                <div>
                  <span className="text-stone-400">Keresett főkategóriák: </span>
                  <strong className="text-emerald-300">
                    {itemTypes.map((t) => (t === "bike" ? "Kerékpár" : "Alkatrész")).join(", ")}
                  </strong>
                </div>
                {isBikeActive && (
                  <div>
                    <span className="text-stone-400">Kerékpár alkategóriák: </span>
                    <span className="text-stone-200 font-medium">
                      {bikeCategories.join(", ")}
                    </span>
                  </div>
                )}
                {isPartActive && (
                  <div>
                    <span className="text-stone-400">Alkatrész alkategóriák: </span>
                    <span className="text-stone-200 font-medium">
                      {partCategories.join(", ")}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-stone-400">Kijelölt piacterek: </span>
                  <span className="text-emerald-400 font-medium">
                    {sources.map((s) => s.toUpperCase()).join(", ")}
                  </span>
                </div>
              </div>

              {/* Preferenciak mentese opcio */}
              <label className="flex items-center gap-2.5 text-xs text-stone-300 bg-[#0a120d] p-3 rounded-xl border border-emerald-900/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveAsDefault}
                  onChange={(e) => setSaveAsDefault(e.target.checked)}
                  className="rounded border-emerald-700 text-emerald-500 focus:ring-emerald-500 bg-[#121f17]"
                />
                <span>
                  Beállítások mentése a fiókomban (legközelebb automatikusan ez jelenik meg)
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Also gomsor a lepesek kozotti navigaciohoz */}
        <div className="pt-4 mt-2 border-t border-emerald-900/40 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={submitting}
                className="text-xs bg-[#121f17] hover:bg-emerald-950/70 text-stone-300 px-4 py-2 rounded-lg border border-emerald-900/50 transition-colors"
              >
                ← Vissza
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-xs text-stone-400 hover:text-stone-200 px-3 py-2 transition-colors"
            >
              Mégse
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-stone-950 px-4 py-2 rounded-lg transition-colors"
              >
                Tovább →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={submitting}
                className="text-xs font-bold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-stone-950 px-5 py-2 rounded-lg transition-all shadow-md shadow-emerald-900/50 flex items-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                    Mentés folyamatban...
                  </>
                ) : (
                  "Scrape beállítások mentése"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}