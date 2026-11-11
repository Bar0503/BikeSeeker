import type {
  Group,
  GroupCreate,
  GroupUpdate,
  Item,
  ItemCreate,
  ItemListResponse,
  ItemQueryParams,
  ItemUpdate,
  LoginCredentials,
  ScrapeResponse,
  ScrapeWizardConfig,
  TokenResponse,
  User,
} from "../types/bike";

// Backend API eleresi utvonal es a helyi token tarolo kulcsa
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";
const TOKEN_STORAGE_KEY = "bikeseeker_jwt_token";

// Lejart munkamenet jelzese az alkalmazas fele bongeszo esemennyel
export const SESSION_EXPIRED_EVENT = "bikeseeker:session-expired";
export const SESSION_EXPIRED_MESSAGE = "A munkamenet lejárt. Kérlek, jelentkezz be újra.";

// JWT token lekerdezese a bongeszo helyi adattarabol
export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

// Uj JWT token elmentese
export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

// JWT token torlese kijelentkezeskor
export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

// Bejelentkezett allapot vizsgalata a token melete alapjan
export function isAuthenticated(): boolean {
  return Boolean(getStoredToken());
}

// Szerveroldali JSON hibauzenet kinyerese
async function extractApiErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail.trim()) {
      return body.detail;
    }
  } catch {
    // Nem JSON hibavalasz eseten marad az alapertelmezett szoveg
  }
  return `${fallbackMessage} (${response.status}).`;
}

// Kozponti fetch burkolo automatikus JWT Bearer fejleccel es lejarat kezelessel
async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { ...init, headers });

  // Lejart vagy ervenytelen token eseten toroljuk a helyi munkamenetet es jelzunk az alkalmazasnak
  if (response.status === 401) {
    clearStoredToken();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  return response;
}

// Felhasznaloi bejelentkezes JWT token generalassal
export async function login(credentials: LoginCredentials): Promise<TokenResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const errorMessage = await extractApiErrorMessage(response, "Sikertelen bejelentkezés");
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as TokenResponse;
  setStoredToken(data.access_token);
  return data;
}

// Bejelentkezett felhasznalo profiljanak es beallitasainak lekerese
export async function getCurrentUser(): Promise<User> {
  const response = await authFetch(`${API_BASE_URL}/auth/me`);
  if (!response.ok) {
    const errorMessage = await extractApiErrorMessage(
      response,
      "Nem sikerült betölteni a profiladatokat"
    );
    throw new Error(errorMessage);
  }
  return (await response.json()) as User;
}

// Scrape varazslo preferenciak perzisztens mentese a felhasznalohoz
export async function savePreferences(preferences: ScrapeWizardConfig): Promise<ScrapeWizardConfig> {
  const response = await authFetch(`${API_BASE_URL}/auth/preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preferences),
  });

  if (!response.ok) {
    const errorMessage = await extractApiErrorMessage(
      response,
      "Nem sikerült elmenteni a keresési beállításokat"
    );
    throw new Error(errorMessage);
  }

  return (await response.json()) as ScrapeWizardConfig;
}

// Kijelentkezes a helyi munkamenet torlesevel
export function logout(): void {
  clearStoredToken();
}

// Hirdetesek es alkatreszek lekerdezese osszetett szuressel es lapozassal
export async function fetchItems(
  params: ItemQueryParams = {},
  signal?: AbortSignal
): Promise<ItemListResponse> {
  const searchParams = new URLSearchParams();

  if (params.query?.trim()) searchParams.append("query", params.query.trim());
  if (params.item_type) searchParams.append("item_type", params.item_type);
  if (params.category) searchParams.append("category", params.category);
  if (params.group_id !== undefined) searchParams.append("group_id", params.group_id.toString());
  if (params.min_price !== undefined) searchParams.append("min_price", params.min_price.toString());
  if (params.max_price !== undefined) searchParams.append("max_price", params.max_price.toString());
  if (params.location?.trim()) searchParams.append("location", params.location.trim());
  if (params.sort_by) searchParams.append("sort_by", params.sort_by);
  if (params.page !== undefined) searchParams.append("page", params.page.toString());
  if (params.page_size !== undefined) searchParams.append("page_size", params.page_size.toString());

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/items${queryString ? `?${queryString}` : ""}`;

  const response = await authFetch(url, { signal });
  if (!response.ok) {
    const errorMessage = await extractApiErrorMessage(
      response,
      "Nem sikerült betölteni a hirdetéseket"
    );
    throw new Error(errorMessage);
  }

  return (await response.json()) as ItemListResponse;
}

// Uj hirdetes letrehozasa
export async function createItem(payload: ItemCreate): Promise<Item> {
  const response = await authFetch(`${API_BASE_URL}/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMessage = await extractApiErrorMessage(response, "Nem sikerült menteni a hirdetést");
    throw new Error(errorMessage);
  }

  return (await response.json()) as Item;
}

// Hirdetes adatainak vagy megjegyzesenek szerkesztese
export async function updateItem(id: number, payload: ItemUpdate): Promise<Item> {
  const response = await authFetch(`${API_BASE_URL}/items/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMessage = await extractApiErrorMessage(
      response,
      "Nem sikerült módosítani a hirdetést"
    );
    throw new Error(errorMessage);
  }

  return (await response.json()) as Item;
}

// Hirdetes vegleges torlese az adatbazisbol
export async function deleteItem(id: number): Promise<void> {
  const response = await authFetch(`${API_BASE_URL}/items/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorMessage = await extractApiErrorMessage(response, "Nem sikerült törölni a tételt");
    throw new Error(errorMessage);
  }
}

// Csoportok listazasa a bennuk levo elemek szamaval
export async function fetchGroups(signal?: AbortSignal): Promise<readonly Group[]> {
  const response = await authFetch(`${API_BASE_URL}/groups`, { signal });
  if (!response.ok) {
    const errorMessage = await extractApiErrorMessage(
      response,
      "Nem sikerült lekérni a csoportokat"
    );
    throw new Error(errorMessage);
  }

  return (await response.json()) as readonly Group[];
}

// Uj csoport letrehozasa
export async function createGroup(payload: GroupCreate): Promise<Group> {
  const response = await authFetch(`${API_BASE_URL}/groups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMessage = await extractApiErrorMessage(response, "Nem sikerült létrehozni a csoportot");
    throw new Error(errorMessage);
  }

  return (await response.json()) as Group;
}

// Meglevo csoport modositasa
export async function updateGroup(id: number, payload: GroupUpdate): Promise<Group> {
  const response = await authFetch(`${API_BASE_URL}/groups/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMessage = await extractApiErrorMessage(
      response,
      "Nem sikerült frissíteni a csoportot"
    );
    throw new Error(errorMessage);
  }

  return (await response.json()) as Group;
}

// Csoport torlese
export async function deleteGroup(id: number): Promise<void> {
  const response = await authFetch(`${API_BASE_URL}/groups/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorMessage = await extractApiErrorMessage(response, "Nem sikerült törölni a csoportot");
    throw new Error(errorMessage);
  }
}

// Hirdetes hozzarendelese csoporthoz kapcsolotablan keresztul
export async function addItemToGroup(groupId: number, itemId: number): Promise<void> {
  const response = await authFetch(`${API_BASE_URL}/groups/${groupId}/items/${itemId}`, {
    method: "POST",
  });

  if (!response.ok) {
    const errorMessage = await extractApiErrorMessage(
      response,
      "Nem sikerült hozzáadni a tételt a csoporthoz"
    );
    throw new Error(errorMessage);
  }
}

// Hirdetes eltavolitasa csoportbol
export async function removeItemFromGroup(groupId: number, itemId: number): Promise<void> {
  const response = await authFetch(`${API_BASE_URL}/groups/${groupId}/items/${itemId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorMessage = await extractApiErrorMessage(
      response,
      "Nem sikerült eltávolítani a tételt a csoportból"
    );
    throw new Error(errorMessage);
  }
}

// Célzott varazslo scrapeles inditasa kategoria es forras szuresekkel
export async function triggerWizardScrape(config: ScrapeWizardConfig): Promise<ScrapeResponse> {
  const response = await authFetch(`${API_BASE_URL}/items/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const errorMessage = await extractApiErrorMessage(
      response,
      "Nem sikerült elindítani a hirdetések letöltését"
    );
    throw new Error(errorMessage);
  }

  return (await response.json()) as ScrapeResponse;
}