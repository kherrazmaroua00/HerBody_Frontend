import { clearAccessToken, getAccessToken } from "@/lib/api/auth";

export const CYCLE_SYMPTOM_TYPES = [
  "cramps",
  "headache",
  "bloating",
  "fatigue",
  "acne",
  "nausea",
  "back_pain",
  "other",
] as const;

export type CycleSymptomType = (typeof CYCLE_SYMPTOM_TYPES)[number];

export type MenstrualCycle = {
  id: string | number;
  startDate: string;
  endDate: string;
  notes: string | null;
};

export type CreateMenstrualCycleInput = {
  startDate: string;
  endDate: string;
  notes?: string;
};

export type CycleSymptom = {
  id: string;
  cycleId: string | number;
  symptomType: string;
  severity: number;
  notes: string | null;
  recordedOn: string;
};

export type CreateCycleSymptomInput = {
  cycleId: string | number;
  symptomType: CycleSymptomType;
  severity: number;
  notes?: string;
  recordedOn: string;
};

type ApiRecord = Record<string, unknown>;
type CycleSymptomErrorKind =
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "bad_request"
  | "network"
  | "server";
export type CycleSymptomError = Error & { kind: CycleSymptomErrorKind };

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === "object" && value !== null;
}

function apiError(kind: CycleSymptomErrorKind, message: string): CycleSymptomError {
  return Object.assign(new Error(message), { kind });
}

function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
}

async function authorizedRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  if (!token) {
    throw apiError("unauthorized", "Please sign in to access cycle symptoms.");
  }
  const baseUrl = apiUrl();
  if (!baseUrl) {
    throw apiError("server", "API configuration is missing.");
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
    throw apiError("network", "Unable to reach the server. Check your connection and try again.");
  }

  if (response.status === 401) {
    clearAccessToken();
    throw apiError("unauthorized", "Your session has expired. Please sign in again.");
  }
  if (response.status === 404) {
    throw apiError("not_found", "The requested menstrual cycle or symptom could not be found.");
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
  const fallback = response.status === 409
    ? "A menstrual cycle with these dates already exists."
    : "The request could not be completed. Please try again.";
  const message = await responseMessage(
    response,
    fallback,
  );
  if (response.status === 409) {
    throw apiError("conflict", message || "A cycle with these dates already exists.");
  }
  if (response.status === 400 || response.status === 422) {
    throw apiError("bad_request", message);
  }
  throw apiError("server", message);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw apiError("server", "The server returned an invalid response.");
  }
}

function readList(payload: unknown, keys: string[], label: string): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) {
    throw apiError("server", `The server returned ${label} in an unsupported format.`);
  }
  if (Array.isArray(payload.data)) return payload.data;
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  if (isRecord(payload.data)) {
    for (const key of keys) {
      if (Array.isArray(payload.data[key])) return payload.data[key];
    }
  }
  throw apiError("server", `The server returned ${label} in an unsupported format.`);
}

function recordId(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

function parseMenstrualCycle(value: unknown): MenstrualCycle | null {
  if (!isRecord(value)) return null;
  const source = isRecord(value.cycle)
    ? value.cycle
    : isRecord(value.menstrualCycle)
      ? value.menstrualCycle
      : value;
  const id = recordId(source.id ?? source.cycleId ?? source.cycle_id);
  const startDate = source.startDate ?? source.start_date;
  const endDate = source.endDate ?? source.end_date;
  const notes = source.notes;

  if (id === null || typeof startDate !== "string" || typeof endDate !== "string") {
    return null;
  }
  return {
    id,
    startDate,
    endDate,
    notes: typeof notes === "string" && notes.trim() ? notes : null,
  };
}

function readMenstrualCycle(payload: unknown): MenstrualCycle {
  const root = isRecord(payload) ? payload : null;
  const data = root && isRecord(root.data) ? root.data : null;
  const candidate =
    data?.cycle ??
    root?.cycle ??
    data?.menstrualCycle ??
    root?.menstrualCycle ??
    data ??
    root;
  const cycle = parseMenstrualCycle(candidate);
  if (!cycle) {
    throw apiError("server", "The server returned a menstrual cycle in an unsupported format.");
  }
  return cycle;
}

function parseCycleSymptom(value: unknown): CycleSymptom | null {
  if (!isRecord(value)) return null;
  const source = isRecord(value.symptom) ? value.symptom : value;
  const id = recordId(source.id ?? source.symptomId ?? source.symptom_id);
  const cycleId = recordId(source.cycleId ?? source.cycle_id);
  const symptomType = source.symptomType ?? source.symptom_type;
  const severity = typeof source.severity === "number"
    ? source.severity
    : typeof source.severity === "string" && source.severity.trim()
      ? Number(source.severity)
      : Number.NaN;
  const recordedOn = source.recordedOn ?? source.recorded_on;
  const notes = source.notes;

  if (
    id === null ||
    cycleId === null ||
    typeof symptomType !== "string" ||
    !symptomType.trim() ||
    !Number.isInteger(severity) ||
    severity < 1 ||
    severity > 5 ||
    typeof recordedOn !== "string"
  ) {
    return null;
  }

  return {
    id: String(id),
    cycleId,
    symptomType,
    severity,
    notes: typeof notes === "string" && notes.trim() ? notes : null,
    recordedOn,
  };
}

function readCycleSymptom(payload: unknown): CycleSymptom {
  const root = isRecord(payload) ? payload : null;
  const data = root && isRecord(root.data) ? root.data : null;
  const candidate =
    data?.symptom ??
    root?.symptom ??
    data?.cycleSymptom ??
    root?.cycleSymptom ??
    data ??
    root;
  const symptom = parseCycleSymptom(candidate);
  if (!symptom) {
    throw apiError("server", "The server returned a symptom in an unsupported format.");
  }
  return symptom;
}

export async function getMenstrualCycles(): Promise<MenstrualCycle[]> {
  const response = await authorizedRequest("/api/menstrual-cycles", { method: "GET" });
  await ensureSuccess(response);
  const records = readList(
    await readJson(response),
    ["cycles", "menstrualCycles", "menstrual_cycles", "items"],
    "menstrual cycles",
  );
  const cycles = records.map(parseMenstrualCycle);
  if (cycles.some((cycle) => cycle === null)) {
    throw apiError("server", "The server returned cycles in an unsupported format.");
  }
  return cycles.filter((cycle): cycle is MenstrualCycle => cycle !== null);
}

export async function getMenstrualCycle(cycleId: string): Promise<MenstrualCycle> {
  const response = await authorizedRequest(
    `/api/menstrual-cycles/${encodeURIComponent(cycleId)}`,
    { method: "GET" },
  );
  await ensureSuccess(response);
  return readMenstrualCycle(await readJson(response));
}

export async function createMenstrualCycle(
  input: CreateMenstrualCycleInput,
): Promise<void> {
  const response = await authorizedRequest("/api/menstrual-cycles", {
    method: "POST",
    body: JSON.stringify({
      startDate: input.startDate,
      endDate: input.endDate,
      ...(input.notes ? { notes: input.notes } : {}),
    }),
  });
  await ensureSuccess(response);
}

export async function getCycleSymptoms(): Promise<CycleSymptom[]> {
  const response = await authorizedRequest("/api/cycle-symptoms", { method: "GET" });
  await ensureSuccess(response);
  const records = readList(
    await readJson(response),
    ["symptoms", "cycleSymptoms", "cycle_symptoms", "items"],
    "cycle symptoms",
  );
  const symptoms = records.map(parseCycleSymptom);
  if (symptoms.some((symptom) => symptom === null)) {
    throw apiError("server", "The server returned symptoms in an unsupported format.");
  }
  return symptoms.filter((symptom): symptom is CycleSymptom => symptom !== null);
}

export async function getCycleSymptom(symptomId: string): Promise<CycleSymptom> {
  const response = await authorizedRequest(
    `/api/cycle-symptoms/${encodeURIComponent(symptomId)}`,
    { method: "GET" },
  );
  await ensureSuccess(response);
  return readCycleSymptom(await readJson(response));
}

export async function createCycleSymptom(input: CreateCycleSymptomInput): Promise<void> {
  const response = await authorizedRequest("/api/cycle-symptoms", {
    method: "POST",
    body: JSON.stringify({
      cycleId: input.cycleId,
      symptomType: input.symptomType,
      severity: input.severity,
      ...(input.notes ? { notes: input.notes } : {}),
      recordedOn: input.recordedOn,
    }),
  });
  await ensureSuccess(response);
}
