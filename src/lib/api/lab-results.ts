import { clearAccessToken, getAccessToken } from "@/lib/api/auth";
import {
  getMedicalDocument,
  getMedicalDocuments,
  type MedicalDocument,
  type MedicalDocumentDetails,
} from "@/lib/api/medical-documents";

/* ==========================================================================
 * View models used by the Lab Results UI (not the raw backend shapes).
 * This module is the only place that translates backend responses.
 * ========================================================================== */

/** Colour family of a status. */
export type StatusTone = "normal" | "watch" | "out" | "unknown";

export interface ResultStatus {
  tone: StatusTone;
  /** Wording shown to the user. */
  label: string;
}

export interface ReferenceInterval {
  unit: string | null;
  referenceLow: number | null;
  referenceHigh: number | null;
  referenceRangeText: string | null;
}

export interface LabMeasurement extends ReferenceInterval {
  /** Unique per measurement. */
  id: string;
  biomarkerId: string;
  biomarkerName: string;
  category: string | null;
  valueText: string;
  valueNumeric: number | null;
  measuredAt: string | null;
  status: ResultStatus;
  /** Laboratory critical flag sent by the backend: true, false, or null when not provided. */
  criticalFlag: boolean | null;
  /** Source report, when the response identifies it. */
  documentId: string | null;
}

export interface OrganGroup {
  /** The backend's organ identifier. */
  organKey: string;
  label: string;
  measurements: LabMeasurement[];
}

export type CandidateState = "pending" | "confirmed" | "rejected";

export interface LabCandidate extends ReferenceInterval {
  id: string;
  state: CandidateState;
  biomarkerName: string;
  valueText: string;
  valueNumeric: number | null;
  measuredAt: string | null;
  category: string | null;
}

export interface ReportReview {
  documentId: string;
  candidates: LabCandidate[];
}

export type LabReport = MedicalDocument;
export type LabReportDetails = MedicalDocumentDetails;

/* ==========================================================================
 * PATCH contract (Swagger: PATCH /api/lab-results/reports/{id}/candidates/{id})
 * ========================================================================== */

export const LAB_CATEGORIES = [
  "vitamin",
  "mineral",
  "hormone",
  "blood_count",
  "metabolic",
  "lipid",
  "liver",
  "kidney",
  "inflammation",
  "electrolyte",
  "other",
] as const;
export type LabCategory = (typeof LAB_CATEGORIES)[number];

export const FIELD_LIMITS = {
  biomarkerName: 120,
  valueText: 100,
  unit: 50,
  referenceRangeText: 150,
} as const;

export interface CandidateEdit {
  biomarkerName: string;
  valueText: string;
  category?: LabCategory;
  valueNumeric: number | null;
  unit: string | null;
  referenceLow: number | null;
  referenceHigh: number | null;
  referenceRangeText: string | null;
  measuredAt: string | null;
}

/** Form state of the candidate editor (all strings, as typed). */
export interface CandidateDraft {
  biomarkerName: string;
  valueText: string;
  valueNumeric: string;
  unit: string;
  referenceLow: string;
  referenceHigh: string;
  referenceRangeText: string;
  measuredAt: string;
  category: string;
}

export function isLabCategory(value: unknown): value is LabCategory {
  return typeof value === "string" && (LAB_CATEGORIES as readonly string[]).includes(value);
}

/** "blood_count" -> "Blood count". */
export function categoryLabel(value: string): string {
  const words = value.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** First 10 characters of an ISO date/timestamp, or "" when it is not a date. */
export function toDateInput(value: string | null): string {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? match[1] : "";
}

const numberText = (value: number | null) => (value === null ? "" : String(value));

export function toDraft(candidate: LabCandidate): CandidateDraft {
  const category = candidate.category?.trim().toLowerCase() ?? "";
  return {
    biomarkerName: candidate.biomarkerName,
    valueText: candidate.valueText,
    valueNumeric: numberText(candidate.valueNumeric),
    unit: candidate.unit ?? "",
    referenceLow: numberText(candidate.referenceLow),
    referenceHigh: numberText(candidate.referenceHigh),
    referenceRangeText: candidate.referenceRangeText ?? "",
    measuredAt: toDateInput(candidate.measuredAt),
    category: isLabCategory(category) ? category : "",
  };
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Validates the editor and builds the PATCH body. Cleared optional fields are
 * sent as null so a wrong extracted value can be removed on the server.
 */
export function buildCandidateEdit(draft: CandidateDraft): { edit: CandidateEdit } | { error: string } {
  const biomarkerName = draft.biomarkerName.trim();
  const valueText = draft.valueText.trim();
  const unit = draft.unit.trim();
  const rangeText = draft.referenceRangeText.trim();
  if (!biomarkerName) return { error: "Biomarker name is required." };
  if (!valueText) return { error: "Value is required." };
  const tooLong = (
    [
      ["biomarkerName", biomarkerName, "Biomarker name"],
      ["valueText", valueText, "Value"],
      ["unit", unit, "Unit"],
      ["referenceRangeText", rangeText, "Reference range text"],
    ] as const
  ).find(([key, value]) => value.length > FIELD_LIMITS[key]);
  if (tooLong) return { error: `${tooLong[2]} must be at most ${FIELD_LIMITS[tooLong[0]]} characters.` };

  const numbers: Record<"valueNumeric" | "referenceLow" | "referenceHigh", number | null> = {
    valueNumeric: null,
    referenceLow: null,
    referenceHigh: null,
  };
  const labels = { valueNumeric: "Numeric value", referenceLow: "Reference low", referenceHigh: "Reference high" };
  for (const key of Object.keys(numbers) as (keyof typeof numbers)[]) {
    const raw = draft[key].trim().replace(",", ".");
    if (!raw) continue;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return { error: `${labels[key]} must be a number.` };
    numbers[key] = parsed;
  }
  if (numbers.referenceLow !== null && numbers.referenceHigh !== null && numbers.referenceLow > numbers.referenceHigh) {
    return { error: "Reference low cannot be greater than reference high." };
  }

  const measuredAt = draft.measuredAt.trim();
  if (measuredAt && !isValidDate(measuredAt)) return { error: "Measured at must be a valid date (YYYY-MM-DD)." };

  const category = draft.category.trim();
  if (category && !isLabCategory(category)) return { error: "Choose a category from the list." };

  return {
    edit: {
      biomarkerName,
      valueText,
      ...(category ? { category: category as LabCategory } : {}),
      ...numbers,
      unit: unit || null,
      referenceRangeText: rangeText || null,
      measuredAt: measuredAt || null,
    },
  };
}

/* ==========================================================================
 * Requests
 * ========================================================================== */

type LabResultsErrorKind = "unauthorized" | "not_found" | "network" | "server";
export type LabResultsError = Error & { kind: LabResultsErrorKind };

function labError(kind: LabResultsErrorKind, message: string): LabResultsError {
  return Object.assign(new Error(message), { kind });
}

export function isLabResultsError(error: unknown, kind?: LabResultsErrorKind): error is LabResultsError {
  return error instanceof Error && "kind" in error && (kind === undefined || (error as LabResultsError).kind === kind);
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
}

function serverMessage(json: unknown): string {
  if (!isRecord(json)) return "";
  const message = json.message ?? json.error;
  if (Array.isArray(message)) return message.filter((item) => typeof item === "string").join(" ");
  return typeof message === "string" ? message : "";
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: object;
  signal?: AbortSignal;
}

async function labRequest(path: string, options: RequestOptions = {}): Promise<unknown> {
  const token = getAccessToken();
  if (!token) throw labError("unauthorized", "Please sign in to see your lab results.");
  if (!baseUrl()) throw labError("server", "API configuration is missing.");

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (options.body) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw labError("network", "Unable to reach the server. Check your connection and try again.");
  }

  const text = await response.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }

  if (response.status === 401) {
    // Skip if a newer login replaced the token while this request was running.
    if (getAccessToken() === token) clearAccessToken();
    throw labError("unauthorized", "Your session has expired. Please sign in again.");
  }
  if (response.status === 404) {
    throw labError("not_found", serverMessage(json) || "Not found.");
  }
  if (!response.ok || (isRecord(json) && json.success === false)) {
    throw labError("server", serverMessage(json) || `The request could not be completed (${response.status}).`);
  }
  return json;
}

/* ==========================================================================
 * Reading responses
 * Field names are read in camelCase or snake_case, optionally wrapped in
 * { success, data }. Malformed items are skipped; the request only fails when
 * nothing usable came back.
 * ========================================================================== */

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mismatch(what: string, received: unknown): LabResultsError {
  const shape = Array.isArray(received)
    ? `a list of ${received.length}`
    : isRecord(received) ? `fields: ${Object.keys(received).join(", ") || "none"}` : typeof received;
  return labError("server", `Unexpected response: ${what} not found (received ${shape}).`);
}

function unwrap(response: unknown): unknown {
  return isRecord(response) && "data" in response ? response.data : response;
}

const snake = (name: string) => name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/** First field among `names` (each tried in camelCase and snake_case) that has a value. */
function pick(source: Raw, ...names: string[]): unknown {
  for (const name of names) {
    for (const key of [name, snake(name)]) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

/** true/false from a boolean, 1/0 or "true"/"false"/"yes"/"no"; anything else is null. */
function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === 0) return value === 1;
  if (typeof value === "string") {
    const word = value.trim().toLowerCase();
    if (["true", "yes", "1"].includes(word)) return true;
    if (["false", "no", "0"].includes(word)) return false;
  }
  return null;
}

/** Like pick, but keeps `false` (pick also skips null and ""). */
function pickFlag(source: Raw, ...names: string[]): boolean | null {
  for (const name of names) {
    for (const key of [name, snake(name)]) {
      const flag = asBoolean(source[key]);
      if (flag !== null) return flag;
    }
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The list itself, or the first named field that holds one. */
function findList(data: unknown, what: string, ...names: string[]): Raw[] {
  const list = Array.isArray(data) ? data : isRecord(data) ? pick(data, ...names) : null;
  if (!Array.isArray(list)) throw mismatch(what, data);
  return list.filter(isRecord);
}

/** Maps every item; skips the ones that fail unless none succeeds. */
function mapTolerant<T>(items: Raw[], map: (item: Raw, index: number) => T[]): T[] {
  const results: T[] = [];
  let firstError: unknown = null;
  items.forEach((item, index) => {
    try {
      results.push(...map(item, index));
    } catch (error) {
      firstError ??= error;
    }
  });
  if (items.length > 0 && results.length === 0 && firstError) throw firstError;
  return results;
}

/** Status words recognised for colouring. Anything else stays grey with its own wording. */
const STATUS_TONES: Record<string, StatusTone> = {
  normal: "normal", within_range: "normal", in_range: "normal", within_interval: "normal",
  within_reference: "normal", within_reference_range: "normal", optimal: "normal", ok: "normal",
  watch: "watch", borderline: "watch", concerning: "watch", borderline_low: "watch", borderline_high: "watch",
  high: "out", low: "out", abnormal: "out", critical: "out", out_of_range: "out", outside_range: "out",
  outside_interval: "out", above_range: "out", below_range: "out", above_reference: "out",
  below_reference: "out", elevated: "out", decreased: "out", critical_high: "out", critical_low: "out",
};

const UNKNOWN_STATUS: ResultStatus = { tone: "unknown", label: "No status" };

function toStatus(value: unknown): ResultStatus | null {
  const raw = isRecord(value) ? pick(value, "code", "status", "label", "name") : value;
  const text = asString(raw);
  if (!text?.trim()) return null;
  const key = text.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const words = key.replace(/_/g, " ");
  return {
    tone: Object.hasOwn(STATUS_TONES, key) ? STATUS_TONES[key] : "unknown",
    label: words.charAt(0).toUpperCase() + words.slice(1),
  };
}

/**
 * Used only when the backend sends no status: compares the numeric value with
 * the reference interval printed on the same report.
 */
export function statusFromInterval(value: number | null, low: number | null, high: number | null): ResultStatus {
  if (value === null || (low === null && high === null)) return UNKNOWN_STATUS;
  if (low !== null && value < low) return { tone: "out", label: "Low" };
  if (high !== null && value > high) return { tone: "out", label: "High" };
  return { tone: "normal", label: "Within range" };
}

function readInterval(item: Raw, fallback: Raw): ReferenceInterval {
  const reference: Raw = isRecord(item.referenceRange) ? item.referenceRange : isRecord(item.reference_range) ? item.reference_range : {};
  return {
    unit: asString(pick(item, "unit") ?? pick(fallback, "unit")),
    referenceLow: asNumber(pick(item, "referenceLow", "refLow") ?? pick(reference, "low", "min")),
    referenceHigh: asNumber(pick(item, "referenceHigh", "refHigh") ?? pick(reference, "high", "max")),
    referenceRangeText: asString(
      pick(item, "referenceRangeText", "referenceText") ??
        (typeof item.referenceRange === "string" ? item.referenceRange : null) ??
        (typeof item.reference_range === "string" ? item.reference_range : null) ??
        pick(reference, "text"),
    ),
  };
}

function toMeasurement(item: Raw, index: number, parent: Raw = {}): LabMeasurement {
  const biomarker: Raw = isRecord(item.biomarker) ? item.biomarker : isRecord(parent.biomarker) ? parent.biomarker : {};
  const name = asString(
    pick(item, "biomarkerName") ?? pick(biomarker, "name", "biomarkerName") ?? pick(parent, "biomarkerName") ?? pick(item, "name"),
  );
  const biomarkerId =
    asString(pick(item, "biomarkerId") ?? pick(biomarker, "id") ?? pick(parent, "biomarkerId")) ??
    (name ? `name:${name.trim().toLowerCase()}` : null);
  const valueNumeric = asNumber(pick(item, "valueNumeric", "numericValue", "value"));
  const valueText = asString(pick(item, "valueText", "value", "valueNumeric", "numericValue"));
  if (!name) throw mismatch("biomarkerName", item);
  if (!biomarkerId) throw mismatch("biomarkerId", item);
  if (valueText === null) throw mismatch("valueText", item);
  const interval = readInterval(item, { ...parent, ...biomarker });
  const measuredAt = asString(pick(item, "measuredAt", "collectedAt", "resultDate", "date"));
  return {
    id: asString(pick(item, "id", "_id", "resultId")) ?? `${biomarkerId}-${measuredAt}-${index}`,
    biomarkerId,
    biomarkerName: name,
    category: asString(pick(item, "category") ?? pick(biomarker, "category") ?? pick(parent, "category")),
    valueText,
    valueNumeric,
    ...interval,
    measuredAt,
    status:
      toStatus(pick(item, "status", "flag", "interpretation")) ??
      statusFromInterval(valueNumeric, interval.referenceLow, interval.referenceHigh),
    criticalFlag: pickFlag(item, "laboratoryCriticalFlag", "labCriticalFlag", "criticalFlag", "isCritical", "critical"),
    documentId: asString(pick(item, "documentId", "reportId", "medicalDocumentId")),
  };
}

/** A list of measurements, or of biomarkers that each contain their measurements. */
function toMeasurements(data: unknown, what: string): LabMeasurement[] {
  const items = findList(data, what, "results", "labResults", "measurements", "history", "biomarkers", "items");
  const parent: Raw = isRecord(data) ? data : {};
  return mapTolerant(items, (item, index) => {
    const owner: Raw = {
      ...parent,
      ...item,
      biomarkerId: pick(item, "biomarkerId", "id") ?? pick(parent, "biomarkerId"),
      biomarkerName: pick(item, "biomarkerName", "name") ?? pick(parent, "biomarkerName"),
    };
    if (Array.isArray(item.measurements)) {
      return mapTolerant(item.measurements.filter(isRecord), (child, i) => [toMeasurement(child, i, owner)]);
    }
    const latest = item.latestMeasurement ?? item.latest_measurement ?? item.latest;
    if (isRecord(latest)) return [toMeasurement(latest, index, owner)];
    return [toMeasurement(item, index, parent)];
  });
}

const CANDIDATE_STATES: Record<string, CandidateState> = {
  pending: "pending", pending_review: "pending", needs_review: "pending", extracted: "pending",
  unreviewed: "pending", edited: "pending", updated: "pending", new: "pending",
  confirmed: "confirmed", approved: "confirmed", accepted: "confirmed", saved: "confirmed",
  rejected: "rejected", declined: "rejected", discarded: "rejected",
};

function toCandidate(item: Raw): LabCandidate {
  const id = asString(pick(item, "id", "_id", "candidateId"));
  const name = asString(pick(item, "biomarkerName", "name"));
  if (!id) throw mismatch("candidate id", item);
  if (!name) throw mismatch("biomarkerName", item);
  const word = asString(pick(item, "status", "reviewStatus", "state"))?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  return {
    id,
    // Candidates returned for review without a known state are reviewable;
    // the backend rejects an action that is not allowed.
    state: Object.hasOwn(CANDIDATE_STATES, word) ? CANDIDATE_STATES[word] : "pending",
    biomarkerName: name,
    valueText: asString(pick(item, "valueText", "value", "valueNumeric")) ?? "",
    valueNumeric: asNumber(pick(item, "valueNumeric", "numericValue")),
    ...readInterval(item, {}),
    measuredAt: asString(pick(item, "measuredAt", "collectedAt", "resultDate")),
    category: asString(pick(item, "category")),
  };
}

function toReportReview(response: unknown, documentId: string): ReportReview {
  let data = unwrap(response);
  if (isRecord(data) && isRecord(data.review)) data = data.review;
  const items = findList(data, "candidates", "candidates", "items", "results", "biomarkers");
  return { documentId, candidates: mapTolerant(items, (item) => [toCandidate(item)]) };
}

/** A list of organ groups, or an object whose keys are organ names. */
function toOrganGroups(response: unknown): OrganGroup[] {
  let data = unwrap(response);
  if (isRecord(data)) {
    const nested = pick(data, "organs", "groups", "body");
    if (nested !== null) data = nested;
  }
  if (!Array.isArray(data) && !isRecord(data)) throw mismatch("organ groups", data);
  const entries: Raw[] = Array.isArray(data)
    ? data.filter(isRecord)
    : Object.entries(data).map(([organ, value]) => (isRecord(value) ? { organ, ...value } : { organ, measurements: value }));
  return mapTolerant(entries, (entry) => {
    const organ: Raw = isRecord(entry.organ) ? entry.organ : {};
    const key = asString(pick(entry, "organKey", "organId", "organ", "key") ?? pick(organ, "id", "key", "name"));
    if (!key) throw mismatch("organ name", entry);
    const label = asString(pick(entry, "label", "organName", "name") ?? pick(organ, "label", "name")) ?? key;
    let measurements: LabMeasurement[] = [];
    try {
      measurements = toMeasurements(entry, "organ measurements");
    } catch (error) {
      // An organ with no measurement list is shown as empty, not as an error.
      if (pick(entry, "results", "labResults", "measurements", "history", "biomarkers", "items") !== null) throw error;
    }
    return [{ organKey: key, label: label.charAt(0).toUpperCase() + label.slice(1), measurements }];
  });
}

/* ==========================================================================
 * Endpoints
 * ========================================================================== */

const BASE = "/api/lab-results";
const segment = encodeURIComponent;
const reportPath = (documentId: string) => `${BASE}/reports/${segment(documentId)}`;
const candidatePath = (documentId: string, candidateId: string) =>
  `${reportPath(documentId)}/candidates/${segment(candidateId)}`;

/** The user's documents uploaded with the "lab_report" type. */
export async function getLabReports(): Promise<LabReport[]> {
  const documents = await getMedicalDocuments();
  return documents.filter((document) => document.documentType.trim().toLowerCase() === "lab_report");
}

export function getLabReportDetails(documentId: string): Promise<LabReportDetails> {
  return getMedicalDocument(documentId);
}

export async function fetchReportReview(documentId: string, signal?: AbortSignal): Promise<ReportReview> {
  return toReportReview(await labRequest(`${reportPath(documentId)}/review`, { signal }), documentId);
}

export async function updateCandidate(documentId: string, candidateId: string, edit: CandidateEdit): Promise<void> {
  await labRequest(candidatePath(documentId, candidateId), { method: "PATCH", body: edit });
}

export async function confirmCandidate(documentId: string, candidateId: string): Promise<void> {
  await labRequest(`${candidatePath(documentId, candidateId)}/confirm`, { method: "POST" });
}

export async function rejectCandidate(documentId: string, candidateId: string): Promise<void> {
  await labRequest(`${candidatePath(documentId, candidateId)}/reject`, { method: "POST" });
}

export async function fetchConfirmedResults(signal?: AbortSignal): Promise<LabMeasurement[]> {
  return toMeasurements(unwrap(await labRequest(BASE, { signal })), "results");
}

export async function fetchBiomarkerHistory(biomarkerId: string, signal?: AbortSignal): Promise<LabMeasurement[]> {
  if (!/^\d+$/.test(biomarkerId)) {
    throw labError("not_found", "History is not available for this biomarker.");
  }
  const data = unwrap(await labRequest(`${BASE}/biomarkers/${segment(biomarkerId)}/history`, { signal }));
  const withId = Array.isArray(data) ? { biomarkerId, history: data } : isRecord(data) ? { biomarkerId, ...data } : data;
  return toMeasurements(withId, "history");
}

export async function fetchBodyMeasurements(signal?: AbortSignal): Promise<OrganGroup[]> {
  return toOrganGroups(await labRequest(`${BASE}/body`, { signal }));
}

/** Exposed for verification scripts only. */
export const __adapters = { toMeasurements, toReportReview, toOrganGroups, unwrap };
