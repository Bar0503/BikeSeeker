// Hitelesitett felhasznalo modellje a mentett beallitasokkal
export interface User {
  readonly id: number;
  readonly username: string;
  readonly scrape_preferences?: ScrapeWizardConfig | null;
}

// Bejelentkezesi adatok tipusa
export interface LoginCredentials {
  readonly username: string;
  readonly password: string;
}

// Backendrol erkezo JWT token valasz szerkezete
export interface TokenResponse {
  readonly access_token: string;
  readonly token_type: string;
  readonly user: User;
}

// Alapelem tipusok
export type ItemType = "bike" | "part";

// Kerekpar alkategoriak felsorolasa
export type BikeCategory = "MTB" | "Trail" | "Enduro" | "DH" | "E-Bike";

// Alkatresz alkategoriak felsorolasa
export type PartCategory =
  | "Villa"
  | "Váz"
  | "Fék"
  | "Váltó"
  | "Kerékszett"
  | "Hajtás";

// Kerekpar alkategoriak kozponti konstans listaja
export const BIKE_CATEGORIES: readonly BikeCategory[] = [
  "MTB",
  "Trail",
  "Enduro",
  "DH",
  "E-Bike",
];

// Alkatresz alkategoriak kozponti konstans listaja
export const PART_CATEGORIES: readonly PartCategory[] = [
  "Villa",
  "Váz",
  "Fék",
  "Váltó",
  "Kerékszett",
  "Hajtás",
];

// Egysegesitett kategoria tipus
export type ItemCategory = BikeCategory | PartCategory;

// Tamogatott forrasoldalak piacterei
export type ScrapeSource = "bringakereso" | "testbike" | "bikemag";

// Tamogatott forrasoldalak kozponti listaja
export const SOURCES: readonly ScrapeSource[] = ["bringakereso", "testbike", "bikemag"];

// Scrape varazslo konfiguracios adatmodellje
export interface ScrapeWizardConfig {
  readonly item_types: readonly ItemType[];
  readonly bike_categories: readonly BikeCategory[];
  readonly part_categories: readonly PartCategory[];
  readonly sources: readonly ScrapeSource[];
}

// Csoportok modellje
export interface Group {
  readonly id: number;
  readonly name: string;
  readonly description: string | null;
  readonly created_at: string;
  readonly item_count: number;
}

export interface GroupCreate {
  readonly name: string;
  readonly description?: string | null;
}

export interface GroupUpdate {
  readonly name?: string;
  readonly description?: string | null;
}

// Hirdetesek es tettelek modellje
export interface Item {
  readonly id: number;
  readonly title: string;
  readonly price: number | null;
  readonly location: string | null;
  readonly url: string;
  readonly source: string;
  readonly item_type: ItemType;
  readonly category: ItemCategory;
  readonly notes?: string | null;
  readonly group_ids?: readonly number[];
}

export interface ItemCreate {
  readonly title: string;
  readonly price?: number | null;
  readonly location?: string | null;
  readonly url: string;
  readonly source: string;
  readonly item_type: ItemType;
  readonly category: ItemCategory;
  readonly notes?: string | null;
  readonly group_ids?: readonly number[];
}

export interface ItemUpdate {
  readonly title?: string;
  readonly price?: number | null;
  readonly location?: string | null;
  readonly item_type?: ItemType;
  readonly category?: ItemCategory;
  readonly notes?: string | null;
}

// Rendezesi iranyok
export type SortOption = "price_asc" | "price_desc";

// Osszetett lekerdezesi parameterek szureshez es lapozashoz
export interface ItemQueryParams {
  readonly query?: string;
  readonly item_type?: ItemType;
  readonly category?: ItemCategory;
  readonly group_id?: number;
  readonly min_price?: number;
  readonly max_price?: number;
  readonly location?: string;
  readonly sort_by?: SortOption;
  readonly page?: number;
  readonly page_size?: number;
}

// Lapozott lista valaszmodell
export interface ItemListResponse {
  readonly total: number;
  readonly page: number;
  readonly page_size: number;
  readonly total_pages: number;
  readonly items: readonly Item[];
}

// Scraper futtatasi modok es valasz
export type ScrapeMode = "latest" | "all";

export interface ScrapeResponse {
  readonly mode: ScrapeMode;
  readonly pages_scraped: number;
  readonly new_added: number;
  readonly updated: number;
  readonly total_items: number;
}