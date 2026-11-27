import { clearAccessToken, getAccessToken } from "@/lib/api/auth";
import type { OrganId } from "@/types/organ";

export type MedicalDocument = {
  id: string;
  title: string;
  description?: string;
  documentType: string;
  organIds: OrganId[];
  createdAt?: string;
  fileName?: string;
  fileSize?: number;
};

export type MedicalDocumentType = "pdf" | "lab_report" | "medical_image" | "other";

export type MedicalDocumentDetails = MedicalDocument & {
  downloadUrl: string;
};

export type UploadMedicalDocumentInput = {
  title: string;
  description: string;
  documentType: MedicalDocumentType;
  organIds: OrganId[];
  file: File;
};

type MedicalDocumentErrorKind = "unauthorized" | "not_found" | "network" | "server";
export type MedicalDocumentError = Error & { kind: MedicalDocumentErrorKind };
type ApiRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === "object" && value !== null;
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
}

function medicalDocumentError(
  kind: MedicalDocumentErrorKind,
  message: string,
): MedicalDocumentError {
  return Object.assign(new Error(message), { kind });
}

async function authorizedRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw medicalDocumentError("unauthorized", "Please sign in to access your documents.");
  }
  if (!baseUrl()) {
    throw medicalDocumentError("server", "API configuration is missing.");
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw medicalDocumentError(
      "network",
      "Unable to reach the server. Check your connection and try again.",
    );
  }

  if (response.status === 401) {
    clearAccessToken();
    throw medicalDocumentError(
      "unauthorized",
      "Your session has expired. Please sign in again.",
    );
  }
  if (response.status === 404) {
    throw medicalDocumentError("not_found", "This medical document could not be found.");
  }
  return response;
}

async function ensureSuccess(response: Response): Promise<void> {
  if (response.ok) return;

  const payload: unknown = await response.json().catch(() => null);
  const message = isRecord(payload) ? payload.message ?? payload.error : undefined;
  const serverMessage = Array.isArray(message)
    ? message.filter((item): item is string => typeof item === "string").join(" ")
    : typeof message === "string"
      ? message
      : "";

  throw medicalDocumentError(
    "server",
    serverMessage || "The request could not be completed. Please try again.",
  );
}

function recordsFromPayload(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return null;

  const data = payload.data;
  if (Array.isArray(data)) return data;
  const candidates = [
    payload.documents,
    payload.medicalDocuments,
    payload.items,
    isRecord(data) ? data.documents : undefined,
    isRecord(data) ? data.medicalDocuments : undefined,
    isRecord(data) ? data.items : undefined,
  ];
  return candidates.find(Array.isArray) as unknown[] | undefined ?? null;
}

function normalizeOrganId(value: unknown): OrganId | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, OrganId> = {
    brain: "brain",
    breast: "breasts",
    breasts: "breasts",
    heart: "heart",
    ovary: "ovaries",
    ovaries: "ovaries",
    thyroid: "thyroid",
    uterus: "uterus",
  };
  return aliases[normalized] ?? null;
}

function normalizeOrganIds(value: unknown): OrganId[] {
  let values: unknown[] = [];
  if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      values = Array.isArray(parsed) ? parsed : value.split(",");
    } catch {
      values = value.split(",");
    }
  }
  return Array.from(new Set(values.flatMap((item) => {
    const candidate = isRecord(item)
      ? item.id ?? item.organId ?? item.organ_id ?? item.name
      : item;
    const organId = normalizeOrganId(candidate);
    return organId ? [organId] : [];
  })));
}

function normalizeMedicalDocument(value: unknown): MedicalDocument | null {
  if (!isRecord(value)) return null;
  const record = isRecord(value.document) ? value.document : value;
  const idValue = record.id ?? record.documentId ?? record.document_id;
  const titleValue = record.title ?? record.name;
  const typeValue =
    record.documentType ?? record.document_type ?? record.type ?? record.category;
  const id = typeof idValue === "string" || typeof idValue === "number"
    ? String(idValue)
    : "";
  if (!id || typeof titleValue !== "string" || typeof typeValue !== "string") return null;

  const descriptionValue = record.description;
  const createdAtValue =
    record.createdAt ?? record.created_at ?? record.uploadedAt ?? record.uploaded_at;
  const fileNameValue =
    record.fileName ?? record.file_name ?? record.filename ?? record.originalName;
  const fileSizeValue =
    record.fileSize ?? record.file_size ?? record.file_size_bytes ?? record.size;
  const organValue =
    record.organids ?? record.organIds ?? record.organ_ids ?? record.organs ?? record.associatedOrgans;

  return {
    id,
    title: titleValue,
    ...(typeof descriptionValue === "string" ? { description: descriptionValue } : {}),
    documentType: typeValue,
    organIds: normalizeOrganIds(organValue),
    ...(typeof createdAtValue === "string" ? { createdAt: createdAtValue } : {}),
    ...(typeof fileNameValue === "string" ? { fileName: fileNameValue } : {}),
    ...(typeof fileSizeValue === "number" ||
    (typeof fileSizeValue === "string" && fileSizeValue.trim())
      ? { fileSize: Number(fileSizeValue) }
      : {}),
  };
}

function readDownloadUrl(payload: unknown): string | null {
  const root = isRecord(payload) ? payload : null;
  const data = root && isRecord(root.data) ? root.data : null;
  const result = root && isRecord(root.result) ? root.result : null;
  const document = data && isRecord(data.document)
    ? data.document
    : root && isRecord(root.document)
      ? root.document
      : null;
  const medicalDocument = data && isRecord(data.medicalDocument)
    ? data.medicalDocument
    : root && isRecord(root.medicalDocument)
      ? root.medicalDocument
      : null;
  const download = data && isRecord(data.download)
    ? data.download
    : root && isRecord(root.download)
      ? root.download
      : null;
  const candidates = [data, result, document, medicalDocument, download, root];
  for (const candidate of candidates) {
    const value =
      candidate?.downloadUrl ??
      candidate?.download_url ??
      candidate?.signedDownloadUrl ??
      candidate?.signed_download_url ??
      candidate?.signedUrl ??
      candidate?.signed_url ??
      candidate?.temporaryUrl ??
      candidate?.url;
    if (typeof value !== "string") continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
    } catch {
      continue;
    }
  }
  return null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw medicalDocumentError("server", "The server returned an invalid response.");
  }
}

export async function getMedicalDocuments(): Promise<MedicalDocument[]> {
  const response = await authorizedRequest("/api/medical-documents", { method: "GET" });
  await ensureSuccess(response);
  const payload = await readJson(response);
  const records = recordsFromPayload(payload);
  if (!records) {
    throw medicalDocumentError("server", "The server returned documents in an unsupported format.");
  }
  const documents = records
    .map(normalizeMedicalDocument)
    .filter((document): document is MedicalDocument => document !== null);
  if (records.length > 0 && documents.length === 0) {
    throw medicalDocumentError("server", "The server returned documents in an unsupported format.");
  }
  return documents;
}

export async function getMedicalDocument(
  documentId: string,
): Promise<MedicalDocumentDetails> {
  const response = await authorizedRequest(
    `/api/medical-documents/${encodeURIComponent(documentId)}`,
    { method: "GET" },
  );
  await ensureSuccess(response);
  const payload = await readJson(response);
  const root = isRecord(payload) ? payload : null;
  const data = root && isRecord(root.data) ? root.data : null;
  const result = root && isRecord(root.result) ? root.result : null;
  const candidate =
    data?.document ??
    data?.medicalDocument ??
    root?.document ??
    root?.medicalDocument ??
    result?.document ??
    result?.medicalDocument ??
    data ??
    result ??
    root;
  const document = normalizeMedicalDocument(candidate);
  const downloadUrl = readDownloadUrl(payload);
  if (!document || !downloadUrl) {
    throw medicalDocumentError("server", "The server did not return document details and a download link.");
  }
  return { ...document, downloadUrl };
}

export async function uploadMedicalDocument(
  input: UploadMedicalDocumentInput,
): Promise<void> {
  const body = new FormData();
  body.append("title", input.title);
  body.append("description", input.description);
  body.append("documentType", input.documentType);
  body.append("organIds", JSON.stringify(input.organIds));
  body.append("file", input.file);

  const response = await authorizedRequest("/api/medical-documents", {
    method: "POST",
    body,
  });
  await ensureSuccess(response);
}

export async function deleteMedicalDocument(documentId: string): Promise<void> {
  const response = await authorizedRequest(
    `/api/medical-documents/${encodeURIComponent(documentId)}`,
    { method: "DELETE" },
  );
  await ensureSuccess(response);
}
