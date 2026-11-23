const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
const ACCESS_TOKEN_KEY = "herbody_access_token";

type ApiRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === "object" && value !== null;
}

function getAccessTokenPayload(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const data = isRecord(payload.data) ? payload.data : null;
  const candidates = [
    payload.accessToken,
    payload.token,
    data?.accessToken,
    data?.token,
  ];
  return candidates.find((value): value is string => typeof value === "string" && value.length > 0) ?? null;
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

export async function login(email: string, password: string): Promise<void> {
  if (!API_URL) throw new Error("API configuration is missing.");

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("Unable to reach the server. Check your connection and try again.");
  }
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) throw new Error("Invalid email or password.");
    if (response.status === 403) throw new Error("Please verify your email before signing in.");
    throw new Error("Unable to sign in. Please try again.");
  }

  const accessToken = getAccessTokenPayload(payload);
  if (!accessToken) throw new Error("Sign-in succeeded, but no access token was returned.");
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}
