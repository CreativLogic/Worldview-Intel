/**
 * Nominatim geocoding HTTP wrapper (Phase 22 Wave 2 -- 22-02).
 *
 * Wraps the public OpenStreetMap Nominatim /search endpoint. The query is the
 * only user-controlled value and is injected exclusively via URLSearchParams
 * (no string concatenation into the URL) to prevent SSRF / parameter injection.
 * The base URL and header values are hardcoded constants.
 *
 * `fetchGeocode` returns the RAW Nominatim items; callers normalize them via
 * `normalizeNominatimResult` to the public `NominatimResult` shape (D-06).
 * Nominatim returns boundingbox as ["south_lat","north_lat","west_lon","east_lon"]
 * (strings); the normalizer remaps to [west, south, east, north] numbers.
 */

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "WorldWideView-MCP/1.3 (contact@worldwideview.app)";
const REQUEST_TIMEOUT_MS = 8_000;

/** Raw Nominatim /search response item shape. */
export interface RawNominatimItem {
    lat?: string;
    lon?: string;
    name?: string;
    type?: string;
    addresstype?: string;
    display_name?: string;
    boundingbox?: [string, string, string, string];
    importance?: number;
    namedetails?: Record<string, string> | null;
    address?: { country?: string } | null;
}

/** Public, normalized geocode result (D-06). */
export interface NominatimResult {
    lat: number;
    lng: number;
    name: string;
    name_en: string;
    type: string;
    addresstype: string;
    country: string;
    display_name: string;
    /** [west, south, east, north] */
    bbox: [number, number, number, number];
    importance: number;
}

export interface FetchGeocodeArgs {
    query: string;
    limit: number;
}

/** Normalize a raw Nominatim item to the public NominatimResult shape (D-06). */
export function normalizeNominatimResult(r: RawNominatimItem): NominatimResult {
    const bb = r.boundingbox ?? ["0", "0", "0", "0"];
    return {
        lat: parseFloat(r.lat ?? "0"),
        lng: parseFloat(r.lon ?? "0"),
        name: r.name ?? "",
        name_en: r.namedetails?.["name:en"] ?? r.name ?? "",
        type: r.type ?? "",
        addresstype: r.addresstype ?? "",
        country: r.address?.country ?? "",
        display_name: r.display_name ?? "",
        // Nominatim order [S, N, W, E] -> [W, S, E, N]
        bbox: [parseFloat(bb[2]), parseFloat(bb[0]), parseFloat(bb[3]), parseFloat(bb[1])],
        importance: r.importance ?? 0,
    };
}

/**
 * Geocode a free-text query via Nominatim. Returns the RAW response items.
 *
 * @throws on network failure / timeout (AbortSignal.timeout) or non-OK status.
 */
export async function fetchGeocode({ query, limit }: FetchGeocodeArgs): Promise<RawNominatimItem[]> {
    const url = new URL(NOMINATIM_SEARCH_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("namedetails", "1");

    const res = await fetch(url, {
        headers: {
            "User-Agent": USER_AGENT,
            "Accept-Language": "en",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
        throw new Error(`Nominatim returned HTTP ${res.status}`);
    }

    const raw = (await res.json()) as RawNominatimItem[];
    return Array.isArray(raw) ? raw : [];
}
