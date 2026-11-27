"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import AppPageHeading from "@/components/ui/AppPageHeading";
import {
  deleteMedicalDocument,
  getMedicalDocument,
  getMedicalDocuments,
  uploadMedicalDocument,
  type MedicalDocument,
  type MedicalDocumentDetails,
  type MedicalDocumentType,
} from "@/lib/api/medical-documents";
import { ORGANS } from "@/lib/organs";
import type { OrganId } from "@/types/organ";

const DOCUMENT_TYPES = [
  { value: "pdf", label: "PDF" },
  { value: "lab_report", label: "Lab report" },
  { value: "medical_image", label: "Medical image" },
  { value: "other", label: "Other" },
] satisfies { value: MedicalDocumentType; label: string }[];
const DOCUMENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_TYPES.map(({ value, label }) => [value, label]),
);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

type SortOrder = "newest" | "oldest" | "name";
type Notice = { tone: "success" | "error"; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function documentTypeLabel(value: string): string {
  return DOCUMENT_TYPE_LABELS[value] ?? value;
}

function isMedicalDocumentType(value: string): value is MedicalDocumentType {
  return DOCUMENT_TYPES.some((type) => type.value === value);
}

function formatDate(value?: string): string {
  if (!value) return "Date not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not provided";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatFileSize(bytes?: number): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getPreviewMimeType(contentType: string | null, fileName?: string): string | null {
  const supportedTypes = new Set([
    "application/pdf",
    "image/avif",
    "image/bmp",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  const responseType = contentType?.split(";")[0].trim().toLowerCase();
  if (responseType && supportedTypes.has(responseType)) return responseType;
  if (responseType && responseType !== "application/octet-stream") return null;

  const extension = fileName?.split(".").pop()?.toLowerCase();
  const extensionTypes: Record<string, string> = {
    avif: "image/avif",
    bmp: "image/bmp",
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    pdf: "application/pdf",
    png: "image/png",
    webp: "image/webp",
  };
  return extension ? extensionTypes[extension] ?? null : null;
}

function DocumentIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-5">
      <path d="M6 3.5h8l4 4V20H6z" />
      <path d="M14 3.5V8h4M9 12h6M9 16h6" />
    </svg>
  );
}

function UploadDocumentDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    description: string;
    documentType: MedicalDocumentType;
    organIds: OrganId[];
    file: File;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [documentType, setDocumentType] = useState<MedicalDocumentType>(DOCUMENT_TYPES[0].value);
  const [organIds, setOrganIds] = useState<OrganId[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function toggleOrgan(organId: OrganId) {
    setOrganIds((current) =>
      current.includes(organId)
        ? current.filter((value) => value !== organId)
        : [...current, organId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Enter a title for this document.");
      return;
    }
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    if (!ALLOWED_FILE_TYPES.has(file.type)) {
      setError("Choose a PDF, JPEG, or PNG file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("The file must be 10 MB or smaller.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        documentType,
        organIds,
        file,
      });
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-document-title"
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-pink">Your health records</p>
            <h2 id="upload-document-title" className="mt-1 text-xl font-bold text-brand-purple">Add a medical document</h2>
            <p className="mt-1 text-sm text-ink/60">Keep a private copy of the records that matter to you.</p>
          </div>
          <button
            type="button"
            aria-label="Close upload form"
            onClick={onClose}
            disabled={submitting}
            className="grid size-9 shrink-0 place-items-center rounded-full text-ink/60 hover:bg-blush hover:text-brand-purple disabled:opacity-50"
          >
            <span aria-hidden="true" className="text-xl leading-none">×</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block text-xs font-semibold text-ink">
            Title <span className="text-brand-pink">*</span>
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={150}
              className="mt-1.5 h-11 w-full rounded-xl border border-[#eadcf4] bg-white px-3 text-sm font-normal outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/10"
              placeholder="e.g. Annual blood test"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-ink">
              Document type <span className="text-brand-pink">*</span>
              <select
                required
                value={documentType}
                onChange={(event) => {
                  if (isMedicalDocumentType(event.target.value)) {
                    setDocumentType(event.target.value);
                  }
                }}
                className="mt-1.5 h-11 w-full rounded-xl border border-[#eadcf4] bg-white px-3 text-sm font-normal outline-none focus:border-brand-purple"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-ink">
              File <span className="text-brand-pink">*</span>
              <input
                required
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="mt-1.5 block h-11 w-full rounded-xl border border-[#eadcf4] bg-white text-xs text-ink/70 file:mr-3 file:h-full file:border-0 file:bg-lavender/60 file:px-3 file:text-xs file:font-semibold file:text-brand-purple"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-ink">
            Description <span className="font-normal text-ink/45">(optional)</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={1000}
              className="mt-1.5 w-full resize-y rounded-xl border border-[#eadcf4] px-3 py-2.5 text-sm font-normal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/10"
              placeholder="Add a note to help you find this document later"
            />
          </label>

          <fieldset>
            <legend className="text-xs font-semibold text-ink">
              Associated organs <span className="font-normal text-ink/45">(optional, select any)</span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.values(ORGANS).map((organ) => (
                <label
                  key={organ.id}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                    organIds.includes(organ.id)
                      ? "border-brand-purple bg-lavender/70 font-semibold text-brand-purple"
                      : "border-[#eadcf4] text-ink/70 hover:border-brand-purple/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={organIds.includes(organ.id)}
                    onChange={() => toggleOrgan(organ.id)}
                    className="accent-brand-purple"
                  />
                  {organ.label}
                </label>
              ))}
            </div>
          </fieldset>

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-10 rounded-full border border-[#eadcf4] px-5 text-sm font-semibold text-ink/75 hover:bg-blush disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-10 rounded-full bg-brand-purple px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-purple/90 disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? "Uploading…" : "Upload document"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeType, setActiveType] = useState("All");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [details, setDetails] = useState<MedicalDocumentDetails | null>(null);
  const [documentAction, setDocumentAction] = useState<{
    id: string;
    action: "view" | "download";
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const refreshDocuments = useCallback(async () => {
    try {
      setDocuments(await getMedicalDocuments());
      setLoadError("");
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getMedicalDocuments()
      .then((loadedDocuments) => {
        if (!active) return;
        setDocuments(loadedDocuments);
        setLoadError("");
      })
      .catch((error: unknown) => {
        if (active) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const documentTypes = useMemo(
    () => Array.from(new Set(documents.map((document) => document.documentType))).sort(),
    [documents],
  );
  const filteredDocuments = useMemo(() => {
    const search = query.trim().toLowerCase();
    return documents
      .filter((document) => {
        const matchesType = activeType === "All" || document.documentType === activeType;
        const organNames = document.organIds.map((id) => ORGANS[id].label).join(" ");
        const matchesQuery =
          !search ||
          `${document.title} ${document.description ?? ""} ${document.documentType} ${organNames}`
            .toLowerCase()
            .includes(search);
        return matchesType && matchesQuery;
      })
      .sort((first, second) => {
        if (sortOrder === "name") return first.title.localeCompare(second.title);
        const firstDate = first.createdAt ? new Date(first.createdAt).getTime() : 0;
        const secondDate = second.createdAt ? new Date(second.createdAt).getTime() : 0;
        return sortOrder === "newest" ? secondDate - firstDate : firstDate - secondDate;
      });
  }, [activeType, documents, query, sortOrder]);

  async function handleUpload(input: {
    title: string;
    description: string;
    documentType: MedicalDocumentType;
    organIds: OrganId[];
    file: File;
  }) {
    await uploadMedicalDocument(input);
    setUploadOpen(false);
    setNotice({ tone: "success", message: "Your document was uploaded successfully." });
    setLoading(true);
    await refreshDocuments();
  }

  function retryLoadingDocuments() {
    setLoadError("");
    setLoading(true);
    void refreshDocuments();
  }

  async function handleDelete(document: MedicalDocument) {
    if (!window.confirm(`Delete “${document.title}”? This cannot be undone.`)) return;
    setDeletingId(document.id);
    setNotice(null);
    try {
      await deleteMedicalDocument(document.id);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setNotice({ tone: "success", message: "Document deleted." });
      if (details?.id === document.id) {
        setDetails(null);
        setPreviewOpen(false);
        setPreviewUrl(null);
      }
    } catch (error) {
      setNotice({ tone: "error", message: errorMessage(error) });
    } finally {
      setDeletingId(null);
    }
  }

  async function openDocument(document: MedicalDocument, action: "view" | "download") {
    setDetails(null);
    setPreviewOpen(false);
    setPreviewUrl(null);
    setNotice(null);
    setDocumentAction({ id: document.id, action });
    try {
      const loadedDetails = await getMedicalDocument(document.id);
      if (action === "view") {
        let response: Response;
        try {
          response = await fetch(loadedDetails.downloadUrl);
        } catch {
          throw new Error("The file server does not allow in-browser preview. Please try Download instead.");
        }
        if (!response.ok) {
          throw new Error(`Preview request failed (${response.status}). Please try Download instead.`);
        }
        const file = await response.blob();
        const mimeType = getPreviewMimeType(
          response.headers.get("content-type"),
          loadedDetails.fileName ?? loadedDetails.title,
        );
        if (!mimeType) {
          throw new Error("In-browser preview supports PDF and image files. Use Download for this file type.");
        }
        const previewBlob = new Blob([file], { type: mimeType });
        setPreviewUrl(URL.createObjectURL(previewBlob));
        setDetails(loadedDetails);
        setPreviewOpen(true);
      } else {
        window.location.assign(loadedDetails.downloadUrl);
      }
    } catch (error) {
      setNotice({ tone: "error", message: errorMessage(error) });
    } finally {
      setDocumentAction(null);
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <AppPageHeading
          icon="documents"
          eyebrow="Your health records"
          title="Medical documents"
          description="Store and organize the medical records you choose to keep."
        />
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-full bg-brand-purple px-5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(74,38,103,0.18)] transition hover:bg-brand-purple/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
        >
          <span aria-hidden="true" className="text-lg leading-none">+</span>
          Add a document
        </button>
      </div>

      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mb-4 rounded-xl px-4 py-3 text-sm ${
            notice.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.message}
        </div>
      )}

      <section className="rounded-3xl border border-[#eadcf4] bg-white/80 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="flex h-10 w-full items-center gap-2 rounded-full border border-[#eadcf4] bg-white px-4 text-brand-purple md:max-w-sm">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="size-4 shrink-0">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <span className="sr-only">Search documents</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, type or organ"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/45"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="document-sort">Sort documents</label>
            <select
              id="document-sort"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              className="h-10 rounded-full border border-[#eadcf4] bg-white px-3 text-xs font-medium text-ink/75 outline-none focus:border-brand-purple"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
            </select>
            <div className="flex h-10 items-center rounded-full border border-[#eadcf4] bg-white p-1" role="group" aria-label="Document view">
              {(["grid", "list"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-label={`${mode === "grid" ? "Grid" : "List"} view`}
                  aria-pressed={viewMode === mode}
                  onClick={() => setViewMode(mode)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                    viewMode === mode ? "bg-lavender text-brand-purple" : "text-ink/55"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by document type">
          {["All", ...documentTypes].map((type) => {
            const count = type === "All"
              ? documents.length
              : documents.filter((document) => document.documentType === type).length;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={activeType === type}
                onClick={() => setActiveType(type)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activeType === type
                    ? "border-brand-pink bg-brand-pink text-white"
                    : "border-[#eadcf4] bg-white text-ink/75 hover:border-brand-pink/50"
                }`}
              >
                {type === "All" ? type : documentTypeLabel(type)} ({count})
              </button>
            );
          })}
        </div>
      </section>

      {loadError ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">
          <p>{loadError}</p>
          {loadError.toLowerCase().includes("sign in") || loadError.toLowerCase().includes("session") ? (
            <a href="/login" className="mt-2 inline-block font-semibold underline">Go to sign in</a>
          ) : (
            <button type="button" onClick={retryLoadingDocuments} className="mt-2 font-semibold underline">
              Try again
            </button>
          )}
        </div>
      ) : loading ? (
        <div className="mt-5 rounded-2xl border border-[#eadcf4] bg-white p-10 text-center text-sm text-ink/60" role="status">
          Loading your documents…
        </div>
      ) : filteredDocuments.length > 0 ? (
        <section
          aria-label="Medical documents"
          className={`mt-5 ${
            viewMode === "grid"
              ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              : "flex flex-col gap-3"
          }`}
        >
          {filteredDocuments.map((document) => (
            <article
              key={document.id}
              className={`rounded-2xl border border-[#eadcf4] bg-white p-4 shadow-[0_3px_12px_rgba(80,43,108,0.04)] ${
                viewMode === "list" ? "sm:flex sm:items-center sm:gap-4" : ""
              }`}
            >
              <div className="flex min-w-0 flex-1 gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-lavender/70 text-brand-purple">
                  <DocumentIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-bold text-ink" title={document.title}>{document.title}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-lavender/65 px-2.5 py-1 text-[10px] font-semibold text-brand-purple">
                      {documentTypeLabel(document.documentType)}
                    </span>
                    {document.fileName && (
                      <span className="max-w-full truncate text-[10px] text-ink/50">{document.fileName}</span>
                    )}
                  </div>
                  {document.description && (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink/65">{document.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {document.organIds.length > 0 ? document.organIds.map((organId) => (
                      <span key={organId} className="rounded-full bg-brand-pink/10 px-2.5 py-1 text-[10px] font-medium text-brand-pink">
                        {ORGANS[organId].label}
                      </span>
                    )) : (
                      <span className="text-[10px] text-ink/45">No organ association</span>
                    )}
                  </div>
                </div>
              </div>
              <div className={`mt-3 flex items-center justify-between border-t border-[#f1e7f6] pt-3 sm:gap-4 ${viewMode === "list" ? "sm:mt-0 sm:w-[330px] sm:shrink-0 sm:border-0 sm:pt-0" : ""}`}>
                <span className="text-[10px] text-ink/55">
                  {formatDate(document.createdAt)}
                  {formatFileSize(document.fileSize) && ` · ${formatFileSize(document.fileSize)}`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void openDocument(document, "view")}
                    disabled={documentAction?.id === document.id}
                    className="min-h-9 rounded-full bg-lavender/60 px-3 text-xs font-semibold text-brand-purple transition hover:bg-lavender focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
                  >
                    {documentAction?.id === document.id && documentAction.action === "view" ? "Opening…" : "View"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void openDocument(document, "download")}
                    disabled={documentAction?.id === document.id}
                    className="min-h-9 rounded-full bg-brand-purple px-3 text-xs font-semibold text-white transition hover:bg-brand-purple/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple disabled:cursor-wait disabled:opacity-60"
                  >
                    {documentAction?.id === document.id && documentAction.action === "download" ? "Preparing…" : "Download"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(document)}
                    disabled={deletingId === document.id}
                    className="min-h-9 rounded-full px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    {deletingId === document.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-brand-purple/25 bg-white/70 px-5 py-12 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-lavender/70 text-brand-purple">
            <DocumentIcon />
          </span>
          <p className="mt-3 text-base font-semibold text-brand-purple">
            {documents.length === 0 ? "No documents yet" : "No documents found"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink/60">
            {documents.length === 0
              ? "Upload a medical record to keep it organized in your personal health space."
              : "Try another search or choose a different document type."}
          </p>
          {documents.length === 0 && (
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="mt-4 min-h-10 rounded-full bg-brand-purple px-5 text-sm font-semibold text-white hover:bg-brand-purple/90"
            >
              Upload your first document
            </button>
          )}
        </div>
      )}

      {uploadOpen && (
        <UploadDocumentDialog
          onClose={() => setUploadOpen(false)}
          onSubmit={handleUpload}
        />
      )}

      {previewOpen && details && previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink/70 p-3 sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-preview-title"
            className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#eadcf4] px-4">
              <h2 id="document-preview-title" className="min-w-0 truncate text-sm font-semibold text-brand-purple">
                {details.title}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={details.downloadUrl}
                  download={details.fileName ?? details.title}
                  className="inline-flex min-h-9 items-center rounded-full bg-brand-purple px-4 text-xs font-semibold text-white hover:bg-brand-purple/90"
                >
                  Download
                </a>
                <button
                  type="button"
                  aria-label="Close document preview"
                  onClick={() => {
                    setPreviewOpen(false);
                    setDetails(null);
                    setPreviewUrl(null);
                  }}
                  className="grid size-9 place-items-center rounded-full text-ink/60 hover:bg-blush hover:text-brand-purple"
                >
                  <span aria-hidden="true" className="text-xl leading-none">×</span>
                </button>
              </div>
            </header>
            <iframe
              src={previewUrl}
              title={`${details.title} preview`}
              className="min-h-0 flex-1 bg-white"
            />
          </section>
        </div>
      )}
    </main>
  );
}
