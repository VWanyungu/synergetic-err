const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiBody<T> {
  status: "success" | "fail" | "error";
  data: T | null;
  message: string;
}

// Backend messages meaning the access token itself is the problem (it answers 401 or 403).
// Other 401/403s (e.g. a bad reset link, "Not authorized") are not session problems.
const TOKEN_ERRORS = new Set([
  "Token not provided",
  "Expired or invalid token",
  "Token is blacklisted",
  "Session invalidated, please log in again",
]);

async function send<T>(path: string, method: string, body: unknown, token: string | null) {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "api-v": "v1",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => null)) as ApiBody<T> | null;
  return { res, json };
}

// One refresh at a time, so several parallel 403s don't each spend the refresh token.
let refreshing: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  refreshing ??= (async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return null;
    // /token wants the expired access token too (the server forgives only its clock).
    const { json } = await send<{ token: string }>("/token", "POST", { refreshToken }, localStorage.getItem("token")).catch(
      () => ({ json: null }),
    );
    if (json?.status !== "success" || !json.data?.token) return null;
    localStorage.setItem("token", json.data.token);
    return json.data.token;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function endSession(): never {
  ["token", "refreshToken", "email"].forEach((k) => localStorage.removeItem(k));
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- outside React, needs a hard redirect
  window.location.href = "/login?reason=expired";
  throw new ApiError(401, "Your session has ended");
}

/** The only place that calls fetch. Returns `data` on success, throws ApiError otherwise. */
export async function api<T = null>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? "GET";
  const token = typeof window === "undefined" ? null : localStorage.getItem("token");

  let { res, json } = await send<T>(path, method, init.body, token);

  if (token && [401, 403].includes(res.status) && TOKEN_ERRORS.has(json?.message ?? "")) {
    const fresh = await refreshAccessToken();
    if (!fresh) endSession();
    ({ res, json } = await send<T>(path, method, init.body, fresh));
    if (TOKEN_ERRORS.has(json?.message ?? "")) endSession();
  }

  if (!res.ok || json?.status !== "success") throw new ApiError(res.status, json?.message ?? res.statusText);
  return json.data as T;
}
