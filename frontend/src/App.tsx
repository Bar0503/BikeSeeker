import { useCallback, useEffect, useState } from "react";
import type {
  Group,
  GroupCreate,
  GroupUpdate,
  Item,
  ItemCreate,
  ItemListResponse,
  ItemQueryParams,
  ItemType,
  ItemUpdate,
  ScrapeWizardConfig,
  User,
} from "./types/bike";
import {
  addItemToGroup,
  createGroup,
  createItem,
  deleteGroup,
  deleteItem,
  fetchGroups,
  fetchItems,
  getCurrentUser,
  isAuthenticated,
  logout,
  removeItemFromGroup,
  savePreferences,
  triggerWizardScrape,
  updateGroup,
  updateItem,
} from "./services/bikeService";
import { BikeCard } from "./components/BikeCard";
import { FilterBar } from "./components/FilterBar";
import { Pagination } from "./components/Pagination";
import { GroupManager } from "./components/GroupManager";
import { LoginScreen } from "./components/LoginScreen";
import { SplashScreen } from "./components/SplashScreen";
import { ScrapeWizardModal } from "./components/ScrapeWizardModal";
import { ItemEditModal } from "./components/ItemEditModal";

const DEFAULT_PAGE_SIZE = 12;

const DEFAULT_FILTERS: Readonly<ItemQueryParams> = {
  query: "",
  item_type: undefined,
  category: undefined,
  group_id: undefined,
  min_price: undefined,
  max_price: undefined,
  location: "",
  sort_by: undefined,
  page: 1,
  page_size: DEFAULT_PAGE_SIZE,
};

function App() {
  // Autentikacios es splash allapotok
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuth, setIsAuth] = useState<boolean>(isAuthenticated());
  const [showSplash, setShowSplash] = useState<boolean>(false);

  // Adat- es szuroallapotok
  const [data, setData] = useState<ItemListResponse | null>(null);
  const [groups, setGroups] = useState<readonly Group[]>([]);
  const [filters, setFilters] = useState<ItemQueryParams>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState<boolean>(false);
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Modalis ablakok allapotai
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);

  // Felhasznalo profiljanak betoltese inditaskor
  useEffect(() => {
    if (isAuth) {
      getCurrentUser()
        .then((user) => setCurrentUser(user))
        .catch(() => {
          setIsAuth(false);
        });
    }
  }, [isAuth]);

  // Csoportok lekerese a szerverrol
  const reloadGroups = useCallback(async (): Promise<void> => {
    try {
      const fetched = await fetchGroups();
      setGroups(fetched);
    } catch (err: unknown) {
      console.error("Csoportok betöltési hiba:", err);
    }
  }, []);

  // Hirdetesek es alkatreszek betoltese
  const loadItems = useCallback(
    (currentFilters: ItemQueryParams, signal?: AbortSignal): void => {
      setLoading(true);
      fetchItems(currentFilters, signal)
        .then((res) => {
          setData(res);
          setError(null);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          const message =
            err instanceof Error
              ? err.message
              : "Váratlan hiba történt a tételek betöltésekor.";
          setError(message);
        })
        .finally(() => {
          if (!signal?.aborted) {
            setLoading(false);
          }
        });
    },
    []
  );

  // Kezdo csoportlista lekerese bejelentkezeskor
  useEffect(() => {
    if (isAuth && !showSplash) {
      reloadGroups();
    }
  }, [isAuth, showSplash, reloadGroups]);

  // Szurok es lapozas valtozasakor hirdetesek ujratoltese
  useEffect(() => {
    if (!isAuth || showSplash) {
      return;
    }
    const controller = new AbortController();
    loadItems(filters, controller.signal);

    return () => {
      controller.abort();
    };
  }, [filters, isAuth, showSplash, loadItems]);

  // Sikeres bejelentkezes utan splash animacio inditasa
  const handleLoginSuccess = (user: User): void => {
    setCurrentUser(user);
    setIsAuth(true);
    setShowSplash(true);
  };

  // Kijelentkezes kezelese
  const handleLogout = (): void => {
    logout();
    setIsAuth(false);
    setCurrentUser(null);
    setData(null);
    setGroups([]);
  };

  // Szurok reszleges frissitese
  const handleFilterChange = (updated: Partial<ItemQueryParams>): void => {
    setFilters((prev) => ({ ...prev, ...updated }));
  };

  // Szurok visszaallitasa
  const handleResetFilters = (): void => {
    setFilters((prev) => ({
      ...DEFAULT_FILTERS,
      item_type: prev.item_type,
    }));
  };

  // Felso nagy kategoria valto
  const handleMainTypeSwitch = (type: ItemType | undefined): void => {
    setFilters((prev) => ({
      ...prev,
      item_type: type,
      category: undefined,
      page: 1,
    }));
  };

  // Csoport kivalasztasa listaszureshez
  const handleSelectGroup = (groupId: number | undefined): void => {
    setFilters((prev) => ({
      ...prev,
      group_id: groupId,
      page: 1,
    }));
  };

  // Uj csoport letrehozasa
  const handleCreateGroup = async (payload: GroupCreate): Promise<void> => {
    await createGroup(payload);
    await reloadGroups();
  };

  // Meglevo csoport modositasa
  const handleUpdateGroup = async (id: number, payload: GroupUpdate): Promise<void> => {
    await updateGroup(id, payload);
    await reloadGroups();
  };

  // Csoport torlese
  const handleDeleteGroup = async (id: number): Promise<void> => {
    await deleteGroup(id);
    if (filters.group_id === id) {
      setFilters((prev) => ({ ...prev, group_id: undefined, page: 1 }));
    }
    await reloadGroups();
  };

  // Hirdetes letrehozasa vagy szerkesztese
  const handleSaveItem = async (
    payload: ItemCreate | ItemUpdate,
    isEdit: boolean
  ): Promise<void> => {
    if (isEdit && editingItem) {
      await updateItem(editingItem.id, payload as ItemUpdate);
    } else {
      await createItem(payload as ItemCreate);
    }
    loadItems(filters);
    reloadGroups();
  };

  // Hirdetes torlese es lista ujratoltese
  const handleDeleteItem = async (id: number): Promise<void> => {
    await deleteItem(id);
    loadItems(filters);
    reloadGroups();
  };

  // Hirdetes csoport tagsaganak kapcsolasa
  const handleToggleGroupForItem = async (
    groupId: number,
    itemId: number,
    isInGroup: boolean
  ): Promise<void> => {
    if (isInGroup) {
      await removeItemFromGroup(groupId, itemId);
    } else {
      await addItemToGroup(groupId, itemId);
    }
    loadItems(filters);
    reloadGroups();
  };

  // Hirdeteshez tartozo egyedi jegyzet torlese es lista ujratoltese
  const handleClearNotes = async (itemId: number): Promise<void> => {
    await updateItem(itemId, { notes: null });
    loadItems(filters);
  };

  // Kozponti scrapeles vegrehajto fuggveny
  const executeScrape = async (config: ScrapeWizardConfig): Promise<void> => {
    setIsScraping(true);
    setError(null);
    setSyncMessage(null);
    try {
      const result = await triggerWizardScrape(config);
      const totalInDb =
        (result as { total_items?: number; total_bikes?: number }).total_items ??
        result.total_bikes ??
        (data ? data.total + result.new_added : 0);

      setSyncMessage(
        `Scrapelés kész: +${result.new_added} új tétel letöltve, ${result.updated} frissítve (Összesen: ${totalInDb} db az adatbázisban)`
      );
      loadItems(filters);
      reloadGroups();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Hiba történt a keresés futtatásakor.";
      setError(message);
    } finally {
      setIsScraping(false);
    }
  };

  // Eles scraping inditasa a kozponti zold gombbal
  const handleRunHeroScrape = async (): Promise<void> => {
    if (isScraping) {
      return;
    }
    const configToUse: ScrapeWizardConfig = currentUser?.scrape_preferences ?? {
      item_types: ["bike", "part"],
      bike_categories: ["MTB", "Trail", "Enduro", "DH", "E-Bike"],
      part_categories: ["Villa", "Váz", "Fék", "Váltó", "Kerékszett", "Hajtás"],
      sources: ["bringakereso", "testbike"],
    };
    await executeScrape(configToUse);
  };

  // Scrape varazslo beallitasainak mentese a felhasznaloi profilba
  const handleSaveWizardConfig = async (
    config: ScrapeWizardConfig,
    saveToProfile: boolean
  ): Promise<void> => {
    try {
      if (saveToProfile) {
        await savePreferences(config);
        setCurrentUser((prev) => (prev ? { ...prev, scrape_preferences: config } : prev));
        setSyncMessage("A Scrape Varázsló beállításai sikeresen elmentve!");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Hiba történt a beállítások mentésekor.";
      setError(message);
    }
  };

  // 1. Allapot: Belepesi kepernyo
  if (!isAuth) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // 2. Allapot: Splash animacio
  if (showSplash) {
    return (
      <SplashScreen
        username={currentUser?.username}
        onFinish={() => setShowSplash(false)}
      />
    );
  }

  // 3. Allapot: Fo felulet
  return (
    <div className="min-h-screen bg-[#0a120d] text-stone-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Oldal fejlec */}
        <header className="mb-6 border-b border-emerald-950/80 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Kerékpár & Alkatrész Aggregátor
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-stone-50 tracking-tight">
              Bike<span className="text-emerald-400">Seeker</span>
            </h1>
            <p className="text-stone-400 text-xs mt-0.5">
              Bejelentkezve:{" "}
              <strong className="text-emerald-300">
                {currentUser?.username ?? "admin"}
              </strong>
            </p>
          </div>

          {/* Felső navigációs váltók és akciógombok */}
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            <div className="bg-[#121f17] border border-emerald-900/40 rounded-xl p-1 flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleMainTypeSwitch(undefined)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  filters.item_type === undefined
                    ? "bg-emerald-600 text-stone-950 font-bold"
                    : "text-stone-400 hover:text-stone-200"
                }`}
              >
                Mind
              </button>
              <button
                type="button"
                onClick={() => handleMainTypeSwitch("bike")}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  filters.item_type === "bike"
                    ? "bg-emerald-600 text-stone-950 font-bold"
                    : "text-stone-400 hover:text-stone-200"
                }`}
              >
                Kerékpárok
              </button>
              <button
                type="button"
                onClick={() => handleMainTypeSwitch("part")}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  filters.item_type === "part"
                    ? "bg-emerald-600 text-stone-950 font-bold"
                    : "text-stone-400 hover:text-stone-200"
                }`}
              >
                Alkatrészek
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsWizardOpen(true)}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-stone-950 px-4 py-2 rounded-lg transition-colors shadow-md shadow-emerald-950"
            >
              Scrape Beállítások
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="text-xs text-stone-400 hover:text-rose-400 px-2 py-2 transition-colors"
            >
              Kilépés
            </button>
          </div>
        </header>

        {/* Központi Hero Scrape Hívógomb */}
        <div className="mb-8 p-6 bg-gradient-to-r from-[#121f17] via-[#0e1711] to-[#121f17] border border-emerald-900/50 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div>
            <h2 className="text-lg font-bold text-stone-100 flex items-center gap-2">
              <span>Friss piactéri adatok letöltése</span>
            </h2>
            <p className="text-xs text-stone-400 mt-1 max-w-xl">
              Válaszd ki, hogy komplett kerékpárokat (MTB, Trail, Enduro, DH, E-Bike)
              vagy alkatrészeket (villa, váz, fék stb.) szeretnél letölteni a kijelölt piacokról.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunHeroScrape}
            disabled={isScraping}
            className="whitespace-nowrap bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-stone-950 font-bold px-6 py-3 rounded-xl shadow-lg shadow-emerald-900/40 text-sm transition-transform active:scale-95 cursor-pointer flex items-center gap-2"
          >
            {isScraping ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                <span>Keresés fut...</span>
              </>
            ) : (
              <>
                <span>Scrape indítása</span>
              </>
            )}
          </button>
        </div>

        {/* Sikeres ertesitesi sav */}
        {syncMessage && (
          <div className="mb-6 bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 px-4 py-3 rounded-xl text-xs flex items-center justify-between">
            <span>{syncMessage}</span>
            <button
              type="button"
              onClick={() => setSyncMessage(null)}
              className="text-emerald-400 hover:text-emerald-200 font-semibold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/*Csoportok CRUD kezelője */}
        <GroupManager
          groups={groups}
          selectedGroupId={filters.group_id}
          onSelectGroup={handleSelectGroup}
          onCreateGroup={handleCreateGroup}
          onUpdateGroup={handleUpdateGroup}
          onDeleteGroup={handleDeleteGroup}
          onOpenCreateItem={() => {
            setEditingItem(null);
            setIsItemModalOpen(true);
          }}
        />

        {/* Szuro es keresopanel */}
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        {/* Betoltesi allapot */}
        {loading && (
          <div className="text-center py-20 text-emerald-300/70 text-sm animate-pulse">
            Tételek frissítése az adatbázisból...
          </div>
        )}

        {/* Hiba uzenet */}
        {error && (
          <div className="bg-rose-950/40 border border-rose-900/50 text-rose-300 p-5 rounded-xl text-center max-w-lg mx-auto my-10">
            <p className="font-semibold mb-1">Hiba történt</p>
            <p className="text-xs text-rose-400">{error}</p>
          </div>
        )}

        {/* Ures talalat */}
        {!loading && !error && data && data.items.length === 0 && (
          <div className="text-center py-20 bg-[#121f17]/40 border border-emerald-900/30 rounded-2xl">
            <p className="text-stone-300 font-medium">
              Nincs a szűrésnek megfelelő találat az adatbázisban.
            </p>
            <p className="text-xs text-stone-500 mt-1">
              Próbálj más szűrőt, vagy indíts egy új scrapelést a fenti gombbal!
            </p>
          </div>
        )}

        {/*Hirdetes kartyak racsa es a lapozo */}
        {!loading && !error && data && data.items.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.items.map((item: Item) => (
                <BikeCard
                  key={item.id}
                  bike={item}
                  groups={groups}
                  activeGroupId={filters.group_id}
                  onEdit={(it) => {
                    setEditingItem(it);
                    setIsItemModalOpen(true);
                  }}
                  onDelete={handleDeleteItem}
                  onToggleGroup={handleToggleGroupForItem}
                  onClearNotes={handleClearNotes}
                />
              ))}
            </div>

            <Pagination
              currentPage={data.page}
              totalPages={data.total_pages}
              onPageChange={(newPage) => handleFilterChange({ page: newPage })}
            />
          </>
        )}
      </div>

      {/* Scrape Varazslo modalis ablak */}
      <ScrapeWizardModal
        isOpen={isWizardOpen}
        initialConfig={currentUser?.scrape_preferences}
        onClose={() => setIsWizardOpen(false)}
        onSaveConfig={handleSaveWizardConfig}
      />

      {/* Tetel letrehozasa es szerkesztese modalis ablak */}
      <ItemEditModal
        isOpen={isItemModalOpen}
        item={editingItem}
        groups={groups}
        onClose={() => {
          setIsItemModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
      />
    </div>
  );
}

export default App;