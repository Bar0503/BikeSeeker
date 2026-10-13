export interface Bike {
  title: string;
  price: number | null;
  location: string | null;
  url: string;
  source: string;
}

export type SortOption = "price_asc" | "price_desc";

export interface BikeListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: Bike[];
}

export interface BikeQueryParams {
  query?: string;
  min_price?: number;
  max_price?: number;
  location?: string;
  sort_by?: SortOption;
  page?: number;
  page_size?: number;
}