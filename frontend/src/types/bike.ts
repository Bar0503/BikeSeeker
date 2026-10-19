// Egyetlen kerekpar hirdetes adatmodellje
export interface Bike {
  title: string;
  price: number | null;
  location: string | null;
  url: string;
  source: string;
}

// Ar szerinti rendezesi iranyok tipusa
export type SortOption = "price_asc" | "price_desc";

// Lapozott backend valasz szerkezete a kerekpar listahoz
export interface BikeListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: Bike[];
}

// Kereseshez, szureshez es lapozashoz hasznalt lekerdezesi parameterek
export interface BikeQueryParams {
  query?: string;
  min_price?: number;
  max_price?: number;
  location?: string;
  sort_by?: SortOption;
  page?: number;
  page_size?: number;
}

// Scraper futtatasi modok: csak a legfrissebb oldal vagy a teljes hirdeteslista
export type ScrapeMode = "latest" | "all";

// Scraper szinkronizacio utani backend valasz szerkezete
export interface ScrapeResponse {
  mode: ScrapeMode;
  pages_scraped: number;
  new_added: number;
  updated: number;
  total_bikes: number;
}