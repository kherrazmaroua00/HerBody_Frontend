import { clearAccessToken, getAccessToken } from "@/lib/api/auth";

export const DAILY_CHECKIN_MOODS = [
  "anxiety",
  "loneliness",
  "sadness",
  "desperate",
  "happiness",
  "gratitude",
  "anger",
  "injustice",
  "other",
] as const;

export type DailyCheckinMood = (typeof DAILY_CHECKIN_MOODS)[number];

export type DailyCheckin = {
  id: string;
  mood: DailyCheckinMood;
  note: string | null;
  checkinDate: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateDailyCheckinInput = {
  mood: DailyCheckinMood;
  note?: string;
};

type CheckinErrorKind =
  | "unauthorized"
  | "conflict"
  | "bad_request"
  | "not_found"
  | "network"
  | "server";

export type DailyCheckinError = Error & { kind: CheckinErrorKind };
type ApiRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === "object" && value !== null;
}

function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
}

function checkinError(kind: CheckinErrorKind, message: string): DailyCheckinError {
  return Object.assign(new Error(message), { kind });
}

async function authorizedRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  if (!token) {
    throw checkinError("unauthorized", "Please sign in to use daily check-ins.");
  }
  const baseUrl = apiUrl();
  if (!baseUrl) {
    throw checkinError("server", "API configuration is missing.");
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw checkinError("network", "Unable to reach the server. Check your connection and try again.");
  }

  if (response.status === 401) {
    clearAccessToken();
    throw checkinError("unauthorized", "Your session has expired. Please sign in again.");
  }
  if (response.status === 404) {
    throw checkinError("not_found", "This check-in could not be found.");
  }
  return response;
}

async function responseMessage(response: Response, fallback: string): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  if (!isRecord(payload)) return fallback;
  const message = payload.message ?? payload.error;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) {
    const messages = message.filter((item): item is string => typeof item === "string");
    if (messages.length) return messages.join(" ");
  }
  return fallback;
}

async function ensureSuccess(response: Response): Promise<void> {
  if (response.ok) return;
  const message = await responseMessage(response, "The request could not be completed. Please try again.");
  if (response.status === 409) throw checkinError("conflict", message);
  if (response.status === 400) throw checkinError("bad_request", message);
  throw checkinError("server", message);
}

function parseDailyCheckin(value: unknown): DailyCheckin | null {
  if (!isRecord(value)) return null;
  const idValue = value.id ?? value.checkinId ?? value.checkin_id;
  const moodValue = value.mood;
  const dateValue = value.checkinDate ?? value.checkin_date ?? value.date;
  const noteValue = value.note;

  if (
    (typeof idValue !== "number" && typeof idValue !== "string") ||
    typeof moodValue !== "string" ||
    !DAILY_CHECKIN_MOODS.includes(moodValue as DailyCheckinMood) ||
    typeof dateValue !== "string"
  ) {
    return null;
  }

  const createdAt = value.createdAt ?? value.created_at;
  const updatedAt = value.updatedAt ?? value.updated_at;
  return {
    id: String(idValue),
    mood: moodValue as DailyCheckinMood,
    note: typeof noteValue === "string" ? noteValue : null,
    checkinDate: dateValue,
    ...(typeof createdAt === "string" ? { createdAt } : {}),
    ...(typeof updatedAt === "string" ? { updatedAt } : {}),
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw checkinError("server", "The server returned an invalid response.");
  }
}

function readList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) {
    throw checkinError("server", "The server returned check-ins in an unsupported format.");
  }
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.checkins)) return payload.checkins;
  if (isRecord(payload.data) && Array.isArray(payload.data.checkins)) {
    return payload.data.checkins;
  }
  throw checkinError("server", "The server returned check-ins in an unsupported format.");
}

function readCheckin(payload: unknown): DailyCheckin {
  const root = isRecord(payload) ? payload : null;
  const data = root && isRecord(root.data) ? root.data : null;
  const candidate = data?.checkin ?? root?.checkin ?? data ?? root;
  const checkin = parseDailyCheckin(candidate);
  if (!checkin) {
    throw checkinError("server", "The server returned a check-in in an unsupported format.");
  }
  return checkin;
}

export async function createDailyCheckin(
  input: CreateDailyCheckinInput,
): Promise<void> {
  const response = await authorizedRequest("/api/check-ins", {
    method: "POST",
    body: JSON.stringify({
      mood: input.mood,
      ...(input.note ? { note: input.note } : {}),
    }),
  });
  await ensureSuccess(response);
}

export async function getDailyCheckins(): Promise<DailyCheckin[]> {
  const response = await authorizedRequest("/api/check-ins", { method: "GET" });
  await ensureSuccess(response);
  const records = readList(await readJson(response));
  const parsed = records.map(parseDailyCheckin);
  if (parsed.some((checkin) => checkin === null)) {
    throw checkinError("server", "The server returned check-ins in an unsupported format.");
  }
  return parsed.filter((checkin): checkin is DailyCheckin => checkin !== null);
}

export async function getDailyCheckin(checkinId: string): Promise<DailyCheckin> {
  const response = await authorizedRequest(
    `/api/check-ins/${encodeURIComponent(checkinId)}`,
    { method: "GET" },
  );
  await ensureSuccess(response);
  return readCheckin(await readJson(response));
}
