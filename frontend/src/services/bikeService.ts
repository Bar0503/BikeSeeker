import type { BikeListResponse, BikeQueryParams, ScrapeMode, ScrapeResponse } from "../types/bike";

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";

// kerekparok lekerdezese szuresi es lapozasi parameterekkel
export async function fetchBikes(params: BikeQueryParams = {}): Promise<BikeListResponse> {
  const searchParams = new URLSearchParams();

  if (params.query) {
    searchParams.append("query", params.query);
  }
  if (params.min_price !== undefined) {
    searchParams.append("min_price", params.min_price.toString());
  }
  if (params.max_price !== undefined) {
    searchParams.append("max_price", params.max_price.toString());
  }
  if (params.location) {
    searchParams.append("location", params.location);
  }
  if (params.sort_by) {
    searchParams.append("sort_by", params.sort_by);
  }
  if (params.page !== undefined) {
    searchParams.append("page", params.page.toString());
  }
  if (params.page_size !== undefined) {
    searchParams.append("page_size", params.page_size.toString());
  }

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/bikes${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Nem sikerult betolteni a kerekparokat (${response.status}).`);
  }

  return (await response.json()) as BikeListResponse;
}

// scrapeles inditasa a megadott modban (latest: 1. oldal, all: osszes oldal)
export async function triggerScrape(mode: ScrapeMode): Promise<ScrapeResponse> {
  const searchParams = new URLSearchParams({ mode });
  const response = await fetch(`${API_BASE_URL}/bikes/scrape?${searchParams.toString()}`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Nem sikerult a hirdetesek frissitese (${response.status}).`);
  }

  return (await response.json()) as ScrapeResponse;
}