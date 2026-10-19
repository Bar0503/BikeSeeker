// egyetlen kerekpar hirdetes adatmodellje
export interface Bike {
  title: string;
  price: number | null;
  location: string | null;
  url: string;
  source: string;
}

export type SortOption = "price_asc" | "price_desc";

// lapozott backend valasz szerkezete
export interface BikeListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: Bike[];
}

// kereseshez es szureshez hasznalt lekerdezesi parameterek
export interface BikeQueryParams {
  query?: string;
  min_price?: number;
  max_price?: number;
  location?: string;
  sort_by?: SortOption;
  page?: number;
  page_size?: number;
}

export type ScrapeMode = "latest" | "all";

// scraper szinkronizacio eredmenye
export interface ScrapeResponse {
  mode: ScrapeMode;
  pages_scraped: number;
  new_added: number;
  updated: number;
  total_bikes: number;
}