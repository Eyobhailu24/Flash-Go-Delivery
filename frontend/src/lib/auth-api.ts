export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  return raw.replace(/\/$/, "");
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
  if (init.body != null && !headers.has("Content-Type")) {
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
