import type { BikeListResponse, BikeQueryParams, ScrapeMode, ScrapeResponse } from "../types/bike";

// Alapertelmezett backend API eleresi utvonal kornyezeti valtozo tamogatassal
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";

// Hibauzenet kinyerese a backend JSON valaszabol vagy alapertelmezett uzenet visszaadasa
async function extractApiErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail.trim()) {
      return body.detail;
    }
  } catch {
    // Ha a valasz nem JSON formatumu, marad az alapertelmezett hibauzenet
  }
  return `${fallbackMessage} (${response.status}).`;
}

// Kerekparok lekerdezese a szerverrol szuresi, lapozasi es megszakitasi tamogatassal
export async function fetchBikes(
  params: BikeQueryParams = {},
  signal?: AbortSignal
): Promise<BikeListResponse> {
  const searchParams = new URLSearchParams();

  // Lekerdezesi parameterek tisztitasa es hozzaadasa az URL-hez
  if (params.query?.trim()) {
    searchParams.append("query", params.query.trim());
  }
  if (params.min_price !== undefined) {
    searchParams.append("min_price", params.min_price.toString());
  }
  if (params.max_price !== undefined) {
    searchParams.append("max_price", params.max_price.toString());
  }
  if (params.location?.trim()) {
    searchParams.append("location", params.location.trim());
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

  // Vegleges lekerdezesi URL osszeallitasa es keres kuldese
  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/bikes${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, { signal });

  // HTTP valasz statuszanak ellenorzese es felhasznalobarat hibadobas
  if (!response.ok) {
    const errorMessage = await extractApiErrorMessage(
      response,
      "Nem sikerült betölteni a kerékpárokat"
    );
    console.error(`Hiba a kerékpárok lekérésekor (${response.status}): ${errorMessage}`);
    throw new Error(errorMessage);
  }

  return (await response.json()) as BikeListResponse;
}

// Scrapeles inditasa a megadott modban (latest: 1. oldal, all: osszes oldal)
export async function triggerScrape(mode: ScrapeMode): Promise<ScrapeResponse> {
  const searchParams = new URLSearchParams({ mode });
  const response = await fetch(`${API_BASE_URL}/bikes/scrape?${searchParams.toString()}`, {
    method: "POST",
  });

  // Sikertelen szinkronizacio eseten hibauzenet naplozasa es tovabbitasa a feluletnek
  if (!response.ok) {
    const errorMessage = await extractApiErrorMessage(
      response,
      "Nem sikerült a hirdetések frissítése a szerverről"
    );
    console.error(`Hiba a hirdetések szinkronizálásakor (${response.status}): ${errorMessage}`);
    throw new Error(errorMessage);
  }

  return (await response.json()) as ScrapeResponse;
}