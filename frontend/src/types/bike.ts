// Egyetlen kerekpar hirdetes adatmodellje
export interface Bike {
  readonly title: string;
  readonly price: number | null;
  readonly location: string | null;
  readonly url: string;
  readonly source: string;
}

// Ar szerinti rendezesi iranyok tipusa
export type SortOption = "price_asc" | "price_desc";

// Lapozott backend valasz szerkezete a kerekpar listahoz
export interface BikeListResponse {
  readonly total: number;
  readonly page: number;
  readonly page_size: number;
  readonly total_pages: number;
  readonly items: readonly Bike[];
}

// Kereseshez, szureshez es lapozashoz hasznalt lekerdezesi parameterek
export interface BikeQueryParams {
  readonly query?: string;
  readonly min_price?: number;
  readonly max_price?: number;
  readonly location?: string;
  readonly sort_by?: SortOption;
  readonly page?: number;
  readonly page_size?: number;
}

// Scraper futtatasi modok: csak a legfrissebb oldal vagy a teljes hirdeteslista
export type ScrapeMode = "latest" | "all";

// Scraper szinkronizacio utani backend valasz szerkezete
export interface ScrapeResponse {
  readonly mode: ScrapeMode;
  readonly pages_scraped: number;
  readonly new_added: number;
  readonly updated: number;
  readonly total_bikes: number;
}