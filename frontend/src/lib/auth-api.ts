function normalizeBaseUrl(raw: string, name: string): string {
  const value = raw.trim().replace(/\/$/, "");
  try {
    new URL(value);
    return value;
  } catch {
    throw new Error(`Invalid ${name}: "${raw}"`);
  }
}

export function getFrontendBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_FRONTEND_URL ??
    process.env.FRONTEND_URL ??
    "http://localhost:3000";
  return normalizeBaseUrl(raw, "FRONTEND_URL");
}

export function getApiBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3001";
  return normalizeBaseUrl(raw, "BACKEND_URL");
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  if (
    init.body != null &&
    !headers.has("Content-Type") &&
    !(typeof FormData !== "undefined" && init.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, {
    ...init,
    credentials: "include",
    headers,
  });
}

export async function readAuthJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as { message?: string } & T;
  if (!res.ok) {
    const msg =
      typeof data.message === "string" ? data.message : "Request failed";
    throw new AuthApiError(msg, res.status);
  }
  return data as T;
}
