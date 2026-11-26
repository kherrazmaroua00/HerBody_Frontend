"use client";

import { useMemo, useRef, useState } from "react";

const categories = [
  "Lab report",
  "Prescription",
  "Imaging",
  "Consultation",
  "Other",
] as const;

type DocumentCategory = (typeof categories)[number];
type SortOrder = "newest" | "oldest" | "name";
type ViewMode = "grid" | "list";

type DocumentEntry = {
  id: string;
  title: string;
  category: DocumentCategory;
  format: string;
  date: string;
  sortDate: string;
  size: string;
  file: File;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function FileTypeIcon({ category }: { category: DocumentCategory }) {
  const iconPath: Record<DocumentCategory, React.ReactNode> = {
    "Lab report": <><path d="M6 3.5h8l4 4V20H6z" /><path d="M14 3.5V8h4M9 12h6M9 16h6" /></>,
    Prescription: <><path d="M8 3h8M9 3v5l-4.5 8.5A2.5 2.5 0 0 0 6.7 20h10.6a2.5 2.5 0 0 0 2.2-3.5L15 8V3" /><path d="M8 15h8" /></>,
    Imaging: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 5-5 3 3 3-4 5 6" /></>,
    Consultation: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6a7.5 7.5 0 1 1 17-3.5Z" /><path d="M8 11h8M8 14h5" /></>,
    Other: <><path d="M6 3.5h8l4 4V20H6z" /><path d="M14 3.5V8h4" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[17px]"
    >
      {iconPath[category]}
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="size-4">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

export default function DocumentsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | "All">("All");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const filteredDocuments = useMemo(() => {
    const search = query.trim().toLowerCase();
    const filtered = documents.filter((document) => {
      const matchesCategory =
        activeCategory === "All" || document.category === activeCategory;
      const matchesSearch =
        search.length === 0 ||
        `${document.title} ${document.category}`.toLowerCase().includes(search);
      return matchesCategory && matchesSearch;
    });

    return filtered.sort((first, second) => {
      if (sortOrder === "name") return first.title.localeCompare(second.title);
      const dateOrder = first.sortDate.localeCompare(second.sortDate);
      return sortOrder === "newest" ? -dateOrder : dateOrder;
    });
  }, [activeCategory, documents, query, sortOrder]);

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const today = new Date();
    const sortDate = today.toISOString().slice(0, 10);
    const additions = Array.from(fileList).map((file, index): DocumentEntry => {
      const extension = file.name.split(".").pop()?.toUpperCase() || "FILE";
      const category: DocumentCategory = file.type.startsWith("image/")
        ? "Imaging"
        : "Other";
      return {
        id: `${Date.now()}-${index}-${file.name}`,
        title: file.name,
        category,
        format: extension,
        date: formatDate(today),
        sortDate,
        size: formatFileSize(file.size),
        file,
      };
    });

    setDocuments((current) => [...additions, ...current]);
    setNotice(
      `${additions.length} file${additions.length === 1 ? "" : "s"} added to this session only.`,
    );
    setActiveCategory("All");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openDocument(document: DocumentEntry) {
    setOpenMenuId(null);
    const fileUrl = URL.createObjectURL(document.file);
    window.open(fileUrl, "_blank", "noopener,noreferrer");
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full border border-brand-pink/15 bg-white/80 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-brand-pink">
            Health journey
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-purple sm:text-3xl">
            Documents
          </h1>
          <p className="mt-0.5 text-xs text-ink/60 sm:text-sm">
            Keep your medical documents organized in one private place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-brand-purple px-4 text-xs font-semibold text-white shadow-[0_4px_10px_rgba(74,38,103,0.18)] transition hover:bg-brand-purple/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Upload document
        </button>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(event) => addFiles(event.target.files)}
        className="sr-only"
        aria-label="Upload documents"
      />

      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className="flex min-h-[92px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-brand-purple/35 bg-white/55 px-4 py-3 text-center transition hover:bg-white/80"
      >
        <span className="grid size-8 place-items-center rounded-full bg-lavender/80 text-brand-purple">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4">
            <path d="M12 16V4m0 0L8 8m4-4 4 4" />
            <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
          </svg>
        </span>
        <p className="mt-1.5 text-[11px] font-semibold text-ink">
          Drag a file here or <span className="text-brand-purple">choose one</span>
        </p>
        <p className="mt-0.5 text-[9px] text-ink/50">
          PDF, JPG or PNG · Files stay in this browser session
        </p>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{notice}</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex h-8 w-full max-w-[320px] items-center gap-2 rounded-full border border-[#eadcf4] bg-white px-3 text-brand-purple">
          <SearchIcon />
          <span className="sr-only">Search documents</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents"
            className="min-w-0 flex-1 bg-transparent text-[11px] text-ink outline-none placeholder:text-ink/50"
          />
        </label>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="document-sort">Sort documents</label>
          <select
            id="document-sort"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            className="h-8 rounded-full border border-[#eadcf4] bg-white px-3 text-[10px] font-medium text-ink/75 outline-none focus:border-brand-purple"
          >
            <option value="newest">Sort: Newest first</option>
            <option value="oldest">Sort: Oldest first</option>
            <option value="name">Sort: Name A–Z</option>
          </select>
          <div className="flex h-8 items-center rounded-full border border-[#eadcf4] bg-white p-0.5" role="group" aria-label="Document view">
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              onClick={() => setViewMode("grid")}
              className={`grid size-7 place-items-center rounded-full ${viewMode === "grid" ? "bg-lavender text-brand-purple" : "text-ink/55"}`}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-3.5">
                <rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
              className={`grid size-7 place-items-center rounded-full ${viewMode === "list" ? "bg-lavender text-brand-purple" : "text-ink/55"}`}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="size-3.5">
                <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter by document type">
        {(["All", ...categories] as const).map((category) => {
          const count =
            category === "All"
              ? documents.length
              : documents.filter((document) => document.category === category).length;
          const active = activeCategory === category;
          return (
            <button
              key={category}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveCategory(category)}
              className={`h-7 rounded-full border px-3 text-[10px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple ${
                active
                  ? "border-brand-pink bg-brand-pink text-white"
                  : "border-[#eadcf4] bg-white text-ink/75 hover:border-brand-pink/40"
              }`}
            >
              {category} ({count})
            </button>
          );
        })}
      </div>

      {filteredDocuments.length > 0 ? (
        <section
          aria-label="Documents"
          className={`mt-3 ${
            viewMode === "grid"
              ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              : "flex flex-col gap-2"
          }`}
        >
          {filteredDocuments.map((document) => (
            <article
              key={document.id}
              className={`relative rounded-2xl border border-[#eadcf4] bg-white p-3.5 shadow-[0_3px_12px_rgba(80,43,108,0.04)] ${
                viewMode === "list" ? "flex items-center gap-3" : "min-h-[128px]"
              }`}
            >
              <div className={`flex items-start justify-between ${viewMode === "list" ? "w-10 shrink-0" : ""}`}>
                <span className="grid size-8 place-items-center rounded-xl bg-lavender/75 text-brand-purple">
                  <FileTypeIcon category={document.category} />
                </span>
                <button
                  type="button"
                  aria-label={`More options for ${document.title}`}
                  aria-expanded={openMenuId === document.id}
                  onClick={() => setOpenMenuId((current) => current === document.id ? null : document.id)}
                  className="grid size-7 place-items-center rounded-full text-brand-purple/70 hover:bg-lavender/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-4">
                    <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
              </div>

              {openMenuId === document.id && (
                <div className="absolute right-3 top-10 z-20 min-w-36 rounded-xl border border-[#eadcf4] bg-white p-1.5 shadow-lg">
                  <button
                    type="button"
                    onClick={() => openDocument(document)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] text-ink/80 hover:bg-blush"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-3.5">
                      <path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" />
                    </svg>
                    View document
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDocuments((current) => current.filter((item) => item.id !== document.id));
                      setOpenMenuId(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] text-red-600 hover:bg-red-50"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="size-3.5">
                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />
                    </svg>
                    Remove
                  </button>
                </div>
              )}

              <div className={viewMode === "list" ? "min-w-0 flex-1" : ""}>
                <button
                  type="button"
                  onClick={() => openDocument(document)}
                  className="mt-1 block max-w-full truncate text-left text-[11px] font-bold text-ink hover:text-brand-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
                >
                  {document.title}
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-lavender/65 px-2 py-0.5 text-[8px] font-semibold text-brand-purple">
                    {document.category}
                  </span>
                  <span className="rounded-full bg-brand-pink/10 px-2 py-0.5 text-[8px] font-semibold text-brand-pink">
                    {document.format}
                  </span>
                </div>
                <div className={`mt-2 flex items-center justify-between border-t border-[#f1e7f6] pt-2 text-[9px] text-ink/55 ${viewMode === "list" ? "sm:w-64" : ""}`}>
                  <span className="inline-flex items-center gap-1">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-3">
                      <rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" />
                    </svg>
                    {document.date}
                  </span>
                  <span>{document.size}</span>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-brand-purple/25 bg-white/60 px-5 py-10 text-center">
          <p className="text-sm font-semibold text-brand-purple">
            {documents.length === 0 ? "No documents yet" : "No documents found"}
          </p>
          <p className="mt-1 text-xs text-ink/60">
            {documents.length === 0
              ? "Upload a document to see it here. Files are only available in this browser session."
              : "Try another search or choose a different category."}
          </p>
        </div>
      )}
    </main>
  );
}
