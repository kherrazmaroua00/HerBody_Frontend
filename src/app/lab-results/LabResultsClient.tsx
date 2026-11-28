"use client";

import { Line, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Poppins } from "next/font/google";
import Link from "next/link";
import {
  Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore,
  type ComponentRef, type FormEvent, type KeyboardEvent, type ReactNode,
} from "react";
import * as THREE from "three";

import {
  LAB_CATEGORIES,
  FIELD_LIMITS,
  buildCandidateEdit,
  categoryLabel,
  confirmCandidate,
  fetchBiomarkerHistory,
  fetchBodyMeasurements,
  fetchConfirmedResults,
  fetchReportReview,
  getLabReportDetails,
  getLabReports,
  isLabResultsError,
  rejectCandidate,
  statusFromInterval,
  toDraft,
  updateCandidate,
  type CandidateDraft,
  type LabCandidate,
  type LabMeasurement,
  type LabReport,
  type LabReportDetails,
  type OrganGroup,
  type ReferenceInterval,
  type ReportReview,
  type ResultStatus,
  type StatusTone,
} from "@/lib/api/lab-results";
import { useReduceMotion } from "@/lib/preferences";

/* ==========================================================================
 * HELPERS
 * ========================================================================== */

const TONES: Record<StatusTone, { color: string; glow: string; legend: string; stat: string }> = {
  normal: { color: "#6fcaa0", glow: "#5fbf8f", legend: "Within interval", stat: "Within interval" },
  watch: { color: "#e8862a", glow: "#e8862a", legend: "Flagged to watch", stat: "To watch" },
  out: { color: "#d6455d", glow: "#d6334f", legend: "Outside lab interval", stat: "Outside interval" },
  unknown: { color: "#9d95ab", glow: "#9d95ab", legend: "No status available", stat: "No status" },
};

/** Most urgent first. Used for sorting and to colour an organ that holds several results. */
const TONE_ORDER: StatusTone[] = ["out", "watch", "normal", "unknown"];

function time(value: string | null): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/** Oldest first; undated measurements come first so they never count as "latest". */
function sortByDate(measurements: LabMeasurement[]): LabMeasurement[] {
  return [...measurements].sort((a, b) => time(a.measuredAt) - time(b.measuredAt) || 0);
}

/** One entry per biomarker: its most recent measurement. */
function latestPerBiomarker(measurements: LabMeasurement[]): LabMeasurement[] {
  const latest = new Map<string, LabMeasurement>();
  for (const item of sortByDate(measurements)) latest.set(item.biomarkerId, item);
  return [...latest.values()].sort((a, b) => a.biomarkerName.localeCompare(b.biomarkerName));
}

function countByTone(measurements: LabMeasurement[]): Record<StatusTone, number> {
  const counts: Record<StatusTone, number> = { normal: 0, watch: 0, out: 0, unknown: 0 };
  for (const item of measurements) counts[item.status.tone] += 1;
  return counts;
}

function matchesFilters(item: LabMeasurement, query: string, category: string | null): boolean {
  return (
    (category === null || item.category === category) &&
    item.biomarkerName.toLowerCase().includes(query.trim().toLowerCase())
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Date not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    // A date without a time must not shift by a day in western time zones.
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? "UTC" : undefined,
  }).format(date);
}

/** Numeric bounds when present, otherwise the range as printed on the report. */
function formatInterval({ referenceLow: low, referenceHigh: high, unit, referenceRangeText }: ReferenceInterval): string {
  const suffix = unit ? ` ${unit}` : "";
  if (low !== null && high !== null) return `${low}–${high}${suffix}`;
  if (low !== null) return `from ${low}${suffix}`;
  if (high !== null) return `up to ${high}${suffix}`;
  return referenceRangeText ?? "not provided";
}

type Vec3 = [number, number, number];

type ModelOrgan = "brain" | "thyroid" | "heart" | "breasts" | "ovaries" | "uterus";

/**
 * Anchor points in the coordinate space of female_health_model.glb
 * (y: 0 = feet, 1.11 = top of head). Taken from the model's `organ_*` nodes.
 */
const MODEL_ANCHORS: Record<ModelOrgan, Vec3> = {
  brain: [0, 0.997, -0.01],
  thyroid: [0, 0.832, 0.009],
  heart: [0.009, 0.693, 0.003],
  breasts: [0, 0.629, 0.09],
  ovaries: [0, 0.324, -0.028],
  uterus: [0, 0.323, -0.007],
};

/** Organ keys that name a mesh in the model. Add the backend's spelling here if it differs. */
const ALIASES: Record<string, ModelOrgan> = {
  brain: "brain",
  thyroid: "thyroid",
  heart: "heart",
  breast: "breasts",
  breasts: "breasts",
  ovary: "ovaries",
  ovaries: "ovaries",
  uterus: "uterus",
};

function toModelOrgan(organKey: string): ModelOrgan | null {
  const key = organKey.trim().toLowerCase();
  return Object.hasOwn(ALIASES, key) ? ALIASES[key] : null;
}

interface BodyMarker {
  key: string;
  organKey: string;
  /** Organ mesh the marker points to; null when the biomarker has no organ in the model. */
  organ: ModelOrgan | null;
  measurement: LabMeasurement;
  anchor: Vec3;
  position: Vec3;
}

/** Group holding confirmed biomarkers that the body endpoint does not link to any organ. */
const UNLINKED_KEY = "__unlinked";

/**
 * Heights along the body (model space) used for biomarkers without an organ in the
 * model. Each biomarker always gets the same height (hash of its id), so markers
 * are spread over the body and never jump between renders. No organ is implied.
 */
const FREE_HEIGHTS = [0.95, 0.86, 0.76, 0.66, 0.56, 0.46, 0.36, 0.26, 0.18];

function stableIndex(text: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(hash) % size;
}

const SPACING = 0.085;
const PER_COLUMN = 10;

/**
 * Places one marker per biomarker beside the body, alternating left and right,
 * close to the height of its organ and without overlap. Biomarkers whose organ is
 * not in the model (or unknown) get a stable height along the body instead.
 */
function layoutMarkers(groups: OrganGroup[]): BodyMarker[] {
  const entries = groups
    .flatMap((group) => {
      const organ = toModelOrgan(group.organKey);
      return latestPerBiomarker(group.measurements).map((measurement) => ({
        key: `${group.organKey}:${measurement.biomarkerId}`,
        organKey: group.organKey,
        organ,
        measurement,
        anchor: organ
          ? MODEL_ANCHORS[organ]
          : ([0, FREE_HEIGHTS[stableIndex(measurement.biomarkerId, FREE_HEIGHTS.length)], 0] as Vec3),
      }));
    })
    .sort((a, b) => b.anchor[1] - a.anchor[1] || a.key.localeCompare(b.key));

  const sides = [entries.filter((_, i) => i % 2 === 0), entries.filter((_, i) => i % 2 === 1)];

  return sides.flatMap((side, sideIndex) => {
    const direction = sideIndex === 0 ? -1 : 1;
    const markers: BodyMarker[] = [];
    for (let start = 0; start < side.length; start += PER_COLUMN) {
      const column = side.slice(start, start + PER_COLUMN);
      const heights: number[] = [];
      column.forEach((entry, i) => {
        const wanted = entry.anchor[1];
        heights.push(i === 0 ? wanted : Math.min(wanted, heights[i - 1] - SPACING));
      });
      // Lift the whole column if it ran below the legs.
      const lift = Math.max(0, 0.15 - heights[heights.length - 1]);
      const x = direction * (0.34 + (start / PER_COLUMN) * 0.1);
      column.forEach((entry, i) => {
        markers.push({ ...entry, position: [x, heights[i] + lift, 0.1] });
      });
    }
    return markers;
  });
}

/**
 * Sphere colour comes from the laboratory critical flag sent by the backend:
 * true = red, false = green, not provided = grey.
 */
function flagTone({ criticalFlag }: LabMeasurement): StatusTone {
  return criticalFlag === true ? "out" : criticalFlag === false ? "normal" : "unknown";
}

function flagLabel({ criticalFlag }: LabMeasurement): string {
  return criticalFlag === true ? "Critical" : criticalFlag === false ? "Not critical" : "Critical flag not provided";
}

const FLAG_LEGEND: { tone: StatusTone; label: string }[] = [
  { tone: "out", label: "Critical (laboratory flag)" },
  { tone: "normal", label: "Not critical" },
  { tone: "unknown", label: "Flag not provided" },
];

/** Most urgent sphere colour among an organ's latest measurements. */
function worstFlagTone(measurements: LabMeasurement[]): StatusTone {
  const tones = new Set(measurements.map(flagTone));
  return TONE_ORDER.find((tone) => tones.has(tone)) ?? "unknown";
}

/**
 * Marker radius. Only results the backend marks as outside the interval grow,
 * in proportion to their distance from the returned interval (visual cue, not severity).
 */
function markerRadius({ status, valueNumeric, referenceLow, referenceHigh }: LabMeasurement): number {
  const base = 0.024;
  if (status.tone !== "out") return base;
  const emphasised = 0.032;
  if (valueNumeric === null || referenceLow === null || referenceHigh === null) return emphasised;
  const width = referenceHigh - referenceLow;
  if (width <= 0) return emphasised;
  const distance = Math.max(referenceLow - valueNumeric, valueNumeric - referenceHigh, 0) / width;
  return emphasised + Math.min(distance, 1) * 0.012;
}

/* ==========================================================================
 * DATA HOOKS
 * ========================================================================== */

interface Resource<T> {
  data: T | undefined;
  error: string;
  loading: boolean;
  reload: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

/**
 * Loads data for `key` (null = idle). Requests are aborted and late answers
 * ignored when the key changes. During a reload of the same key the previous
 * data stays visible. `load` must be stable (module function or useCallback).
 */
function useResource<T>(
  key: string | null,
  load: (key: string, signal: AbortSignal) => Promise<T>,
): Resource<T> {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ key: string; version: number; data?: T; error: string } | null>(null);

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    load(key, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ key, version, data, error: "" });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState((previous) => ({
          key,
          version,
          data: previous?.key === key ? previous.data : undefined,
          error: errorMessage(error),
        }));
      },
    );
    return () => controller.abort();
  }, [key, load, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  const current = state !== null && state.key === key ? state : null;
  const loading = key !== null && (current === null || current.version !== version);

  return { data: current?.data, error: loading ? "" : current?.error ?? "", loading, reload };
}

interface ReviewEntry {
  review?: ReportReview;
  error?: string;
  /** The backend has no review for this report (404): nothing extracted yet. */
  notFound?: boolean;
  loading: boolean;
}

const PARALLEL = 4;

/**
 * Loads the review of every report (a few at a time) so pending candidates can
 * be counted and listed. `refresh` reloads a single report after an action.
 */
function useReportReviews(documentIds: string[]) {
  const [entries, setEntries] = useState<Record<string, ReviewEntry>>({});
  /** Latest request number per report, so an older answer never overwrites a newer one. */
  const latest = useRef<Record<string, number>>({});

  const refresh = useCallback(async (documentId: string, signal?: AbortSignal) => {
    const request = (latest.current[documentId] ?? 0) + 1;
    latest.current[documentId] = request;
    const apply = (entry: (previous?: ReviewEntry) => ReviewEntry) => {
      if (signal?.aborted || latest.current[documentId] !== request) return;
      setEntries((all) => ({ ...all, [documentId]: entry(all[documentId]) }));
    };
    apply((previous) => ({ review: previous?.review, loading: true }));
    try {
      const review = await fetchReportReview(documentId, signal);
      apply(() => ({ review, loading: false }));
    } catch (error) {
      if (isLabResultsError(error, "not_found")) {
        apply(() => ({ notFound: true, loading: false }));
      } else {
        apply((previous) => ({ review: previous?.review, error: errorMessage(error), loading: false }));
      }
    }
  }, []);

  const idsKey = JSON.stringify(documentIds);

  useEffect(() => {
    const controller = new AbortController();
    const queue = JSON.parse(idsKey) as string[];
    const worker = async () => {
      for (let id = queue.shift(); id !== undefined && !controller.signal.aborted; id = queue.shift()) {
        await refresh(id, controller.signal);
      }
    };
    for (let i = 0; i < PARALLEL; i += 1) void worker();
    return () => controller.abort();
  }, [idsKey, refresh]);

  return { entries, refresh };
}

/* ==========================================================================
 * STYLES
 * ========================================================================== */

const theme = { theme: "hb-theme", glass: "hb-glass" };

const THEME_CSS = `
/* Design tokens copied from the "My Body Biomarker Universe" prototype. */
.hb-theme {
  --hb-violet: #6b3fa0;
  --hb-lilac: #eadcf8;
  --hb-rose: #e75a97;
  --hb-plum: #3b2a4f;
  --hb-bg1: #fff1f7;
  --hb-bg2: #eadcf8;
  --hb-glass: rgba(255, 255, 255, 0.62);
  --hb-line: rgba(107, 63, 160, 0.18);
  --hb-text: #3b2a4f;
  --hb-muted: #7a6a8c;
  --hb-soft: rgba(234, 220, 248, 0.45);
  color: var(--hb-text);
  background:
    radial-gradient(900px 600px at 20% 10%, var(--hb-bg2), transparent 60%),
    radial-gradient(800px 600px at 90% 90%, var(--hb-bg1), transparent 60%),
    var(--hb-bg1);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .hb-theme {
    --hb-bg1: #2a1d3a;
    --hb-bg2: #1e1530;
    --hb-glass: rgba(59, 42, 79, 0.62);
    --hb-line: rgba(234, 220, 248, 0.2);
    --hb-text: #fff1f7;
    --hb-muted: #c4b3d8;
    --hb-soft: rgba(234, 220, 248, 0.12);
    color-scheme: dark;
  }
}

.hb-glass {
  background: var(--hb-glass);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  border: 1px solid var(--hb-line);
  border-radius: 20px;
  box-shadow: 0 8px 30px rgba(107, 63, 160, 0.12);
}
`;

/* ==========================================================================
 * SHARED UI
 * ========================================================================== */

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hb-violet)]";

function chipClass(active = false): string {
  return `cursor-pointer rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${focus} ${
    active
      ? "border-[var(--hb-violet)] bg-[var(--hb-violet)] text-white"
      : "border-[var(--hb-line)] bg-transparent text-[var(--hb-text)] hover:border-[var(--hb-rose)]"
  }`;
}

const inputClass = `w-full rounded-full border border-[var(--hb-line)] bg-[var(--hb-glass)] px-3.5 py-2.5 text-[13px] text-[var(--hb-text)] placeholder:text-[var(--hb-muted)] ${focus}`;

function StatusPill({ status }: { status: ResultStatus }) {
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 align-middle text-[11px] font-normal text-white"
      style={{ background: TONES[status.tone].color }}
    >
      {status.label}
    </span>
  );
}

function Note({ children, role }: { children: ReactNode; role?: "status" }) {
  return (
    <p role={role} className="my-2 rounded-xl bg-[var(--hb-soft)] p-3 text-xs leading-5 text-[var(--hb-muted)]">
      {children}
    </p>
  );
}

function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const needsSignIn = /sign in|session|unauthori[sz]ed|\b401\b/i.test(message);
  return (
    <div role="alert" className="my-2 rounded-xl border border-[#d6455d]/40 bg-[#d6455d]/10 p-3 text-xs leading-5">
      <p className="break-words">{message}</p>
      {needsSignIn ? (
        <Link href="/login" className="mt-1 inline-block font-semibold underline">Sign in</Link>
      ) : onRetry ? (
        <button type="button" onClick={onRetry} className={`mt-1 cursor-pointer font-semibold underline ${focus}`}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

/* ==========================================================================
 * 3D BODY
 * ========================================================================== */

/** public/models/female_health_model (1).glb */
const MODEL_URL = "/models/female_health_model%20(1).glb";

const HOME_POSITION: [number, number, number] = [0, 0.62, 2.45];
const HOME_TARGET: [number, number, number] = [0, 0.575, 0];
const ORGAN_NODE = /^organ_(brain|thyroid|heart|breasts|ovaries|uterus)$/;

interface MarkerHover {
  marker: BodyMarker;
  x: number;
  y: number;
}

function organOf(object: THREE.Object3D | null): ModelOrgan | null {
  for (let node = object; node; node = node.parent) {
    const match = ORGAN_NODE.exec(node.name);
    if (match) return match[1] as ModelOrgan;
  }
  return null;
}

function setCursor(event: ThreeEvent<PointerEvent>, cursor: string) {
  const target = event.nativeEvent.target;
  if (target instanceof HTMLElement) target.style.cursor = cursor;
}

interface OrganMaterial {
  organ: ModelOrgan;
  material: THREE.MeshStandardMaterial;
  opacity: number;
  emissive: THREE.Color;
}

/** Clones the cached GLB and restyles it with the prototype's lilac glass look. */
function buildBody(source: THREE.Object3D) {
  const root = source.clone(true);
  const owned: THREE.Material[] = [];
  const organs: OrganMaterial[] = [];
  const shells: THREE.Mesh[] = [];

  const own = <T extends THREE.Material>(material: T): T => {
    owned.push(material);
    return material;
  };
  const collider = own(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
  const skin = own(new THREE.MeshPhysicalMaterial({
    color: 0xd9bdf2, transparent: true, opacity: 0.3, roughness: 0.35, metalness: 0, clearcoat: 0.6, depthWrite: false,
  }));
  const wire = own(new THREE.MeshBasicMaterial({ color: 0x6b3fa0, wireframe: true, transparent: true, opacity: 0.035, depthWrite: false }));

  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const original = node.material as THREE.MeshStandardMaterial;
    if (original.name === "mat_collider") {
      node.material = collider;
      return;
    }
    if (node.name.startsWith("body_shell")) {
      node.material = skin;
      node.renderOrder = 1;
      node.raycast = () => {}; // clicks pass through the skin to the organs
      shells.push(node);
      return;
    }
    const organ = organOf(node);
    if (!organ) return;
    const material = own(original.clone());
    const opacity = material.opacity;
    material.transparent = true;
    node.material = material;
    organs.push({ organ, material, opacity, emissive: material.emissive.clone() });
  });

  // Added after traversal so the overlay is not visited itself.
  for (const shell of shells) {
    const overlay = new THREE.Mesh(shell.geometry, wire);
    overlay.renderOrder = 2;
    overlay.raycast = () => {};
    shell.add(overlay);
  }

  return { root, organs, owned };
}

const SELECTED_GLOW = new THREE.Color(0xe75a97);

/** Eases organ materials toward the selected/unselected look (Three.js objects, mutated per frame). */
function animateOrgans(organs: OrganMaterial[], selectedOrgan: ModelOrgan | null, delta: number, elapsed: number) {
  const ease = 1 - Math.exp(-delta * 8);
  const pulse = 0.75 + Math.sin(elapsed * 3) * 0.25;
  for (const { organ, material, opacity, emissive } of organs) {
    const selected = organ === selectedOrgan;
    material.opacity += ((selectedOrgan && !selected ? opacity * 0.3 : opacity) - material.opacity) * ease;
    material.emissive.lerp(selected ? SELECTED_GLOW : emissive, ease);
    material.emissiveIntensity = selected ? pulse : 1;
  }
}

function BodyModel({ selectedOrgan, onSelectOrgan }: { selectedOrgan: ModelOrgan | null; onSelectOrgan: (organ: ModelOrgan) => void }) {
  const { scene } = useGLTF(MODEL_URL, false);
  const body = useMemo(() => buildBody(scene), [scene]);

  // Geometries belong to the useGLTF cache; only the materials created here are ours.
  useEffect(() => () => body.owned.forEach((material) => material.dispose()), [body]);

  useFrame(({ clock }, delta) => animateOrgans(body.organs, selectedOrgan, delta, clock.elapsedTime));

  return (
    <primitive
      object={body.root}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        const organ = organOf(event.object);
        if (!organ || event.delta > 5) return; // a drag is a rotation, not a click
        event.stopPropagation();
        onSelectOrgan(organ);
      }}
      onPointerOver={(event: ThreeEvent<PointerEvent>) => {
        if (organOf(event.object)) setCursor(event, "pointer");
      }}
      onPointerOut={(event: ThreeEvent<PointerEvent>) => setCursor(event, "grab")}
    />
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Soft glow in the status colour that fades to fully transparent (no white disc on light backgrounds). */
function haloTexture(color: string): THREE.CanvasTexture {
  const [r, g, b] = hexToRgb(color);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
  gradient.addColorStop(0.45, `rgba(${r},${g},${b},0.18)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Marker({
  marker, halo, selected, dimmed, faded, reducedMotion, onSelect, onHover,
}: {
  marker: BodyMarker;
  halo: THREE.Texture;
  selected: boolean;
  /** Excluded by the search or category filter: shown faintly and not clickable. */
  dimmed: boolean;
  /** Belongs to another organ than the selected one. */
  faded: boolean;
  reducedMotion: boolean;
  onSelect: (marker: BodyMarker) => void;
  onHover: (hover: MarkerHover | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const hovered = useRef(false);
  const tone = flagTone(marker.measurement);
  const radius = markerRadius(marker.measurement);
  const opacity = dimmed ? 0.12 : faded ? 0.3 : 1;
  const phase = marker.position[1] * 20 + marker.position[0] * 7;

  useFrame(({ clock }) => {
    const node = group.current;
    if (!node) return;
    const t = reducedMotion || dimmed ? 0 : clock.elapsedTime;
    const moving = t !== 0;
    node.position.y = marker.position[1] + (moving && tone === "normal" ? Math.sin(t * 0.9 + phase) * 0.008 : 0);
    const amplitude = tone === "out" ? 0.14 : tone === "watch" ? 0.09 : 0;
    const speed = tone === "out" ? 2.6 : 2;
    const pulse = moving ? 1 + Math.sin(t * speed + phase) * amplitude : 1;
    node.scale.setScalar(pulse * (selected || hovered.current ? 1.25 : 1));
  });

  const move = (event: ThreeEvent<PointerEvent>) => {
    if (dimmed) return;
    event.stopPropagation();
    hovered.current = true;
    setCursor(event, "pointer");
    onHover({ marker, x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY });
  };

  return (
    <>
      {marker.organ && (
        <Line points={[marker.anchor, marker.position]} color={TONES[tone].color} lineWidth={1} transparent
          opacity={selected ? 0.9 : opacity * 0.3} />
      )}
      <group ref={group} position={marker.position}>
        <mesh
          onPointerMove={move}
          onPointerOut={(event) => {
            hovered.current = false;
            setCursor(event, "grab");
            onHover(null);
          }}
          onClick={(event) => {
            if (dimmed || event.delta > 5) return;
            event.stopPropagation();
            onSelect(marker);
          }}
        >
          <sphereGeometry args={[radius, 32, 24]} />
          <meshStandardMaterial color={TONES[tone].color} emissive={TONES[tone].glow} emissiveIntensity={0.45}
            roughness={0.25} metalness={0.1} transparent opacity={opacity} />
        </mesh>
        <sprite scale={[radius * 4.5, radius * 4.5, 1]} raycast={() => null}>
          <spriteMaterial map={halo} transparent opacity={opacity * (selected ? 0.85 : 0.5)} depthWrite={false} />
        </sprite>
      </group>
    </>
  );
}

/** Orbit controls plus the animated front/back switch and the reset. */
function CameraRig({ flips, resets }: { flips: number; resets: number }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const seen = useRef({ flips, resets });
  const goal = useRef<number | null>(null);

  useFrame(({ camera }, delta) => {
    const orbit = controls.current;
    if (!orbit) return;
    if (seen.current.resets !== resets) {
      seen.current.resets = resets;
      goal.current = null;
      camera.position.set(...HOME_POSITION);
      orbit.target.set(...HOME_TARGET);
      orbit.update();
    }
    if (seen.current.flips !== flips) {
      seen.current.flips = flips;
      const facingFront = goal.current === null ? Math.abs(orbit.getAzimuthalAngle()) < Math.PI / 2 : goal.current === 0;
      goal.current = facingFront ? Math.PI : 0;
    }
    if (goal.current === null) return;
    const difference = goal.current - orbit.getAzimuthalAngle();
    const remaining = Math.atan2(Math.sin(difference), Math.cos(difference));
    const step = Math.sign(remaining) * Math.min(Math.abs(remaining), delta * 4.5);
    camera.position.sub(orbit.target).applyAxisAngle(THREE.Object3D.DEFAULT_UP, step).add(orbit.target);
    orbit.update();
    if (Math.abs(remaining) < 0.01) goal.current = null;
  });

  return (
    <OrbitControls ref={controls} target={HOME_TARGET} enablePan={false} enableDamping minDistance={1} maxDistance={4}
      onStart={() => { goal.current = null; }} />
  );
}

function LabBodyViewer({
  markers, selectedOrgan, selectedOrganKey, selectedBiomarkerId, dimmedBiomarkerIds, flips, resets,
  onSelectOrgan, onSelectMarker, onHover,
}: {
  markers: BodyMarker[];
  selectedOrgan: ModelOrgan | null;
  /** Selected organ group (may be one that is not in the model, e.g. unlinked). */
  selectedOrganKey: string | null;
  selectedBiomarkerId: string | null;
  dimmedBiomarkerIds: ReadonlySet<string>;
  flips: number;
  resets: number;
  onSelectOrgan: (organ: ModelOrgan) => void;
  onSelectMarker: (marker: BodyMarker) => void;
  onHover: (hover: MarkerHover | null) => void;
}) {
  // Client-only component (loaded with ssr: false).
  const systemReducedMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const reducedMotion = useReduceMotion() || systemReducedMotion;
  const halos = useMemo(
    () => Object.fromEntries(
      (Object.keys(TONES) as StatusTone[]).map((tone) => [tone, haloTexture(TONES[tone].glow)]),
    ) as Record<StatusTone, THREE.CanvasTexture>,
    [],
  );
  useEffect(() => () => Object.values(halos).forEach((texture) => texture.dispose()), [halos]);

  return (
    <Canvas
      camera={{ position: HOME_POSITION, fov: 38, near: 0.05, far: 20 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0, cursor: "grab", touchAction: "none" }}
      aria-label="3D female body with biomarker markers. Use the organ buttons for keyboard access."
      onPointerLeave={() => onHover(null)}
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[2, 4, 5]} intensity={1.4} />
      <directionalLight position={[-3, 1, -3]} intensity={0.8} color="#e75a97" />
      <Suspense fallback={null}>
        <BodyModel selectedOrgan={selectedOrgan} onSelectOrgan={onSelectOrgan} />
        {markers.map((marker) => (
          <Marker
            key={marker.key}
            marker={marker}
            halo={halos[flagTone(marker.measurement)]}
            selected={marker.measurement.biomarkerId === selectedBiomarkerId}
            dimmed={dimmedBiomarkerIds.has(marker.measurement.biomarkerId)}
            faded={selectedOrganKey !== null && marker.organKey !== selectedOrganKey}
            reducedMotion={reducedMotion}
            onSelect={onSelectMarker}
            onHover={onHover}
          />
        ))}
      </Suspense>
      <CameraRig flips={flips} resets={resets} />
    </Canvas>
  );
}


/* ==========================================================================
 * BodyStage
 * ========================================================================== */

function StageMessage({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-[var(--hb-muted)]">
      {children}
    </div>
  );
}

class ViewerBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

let webglSupport: boolean | undefined;
function hasWebGL(): boolean {
  if (webglSupport === undefined) {
    const context = document.createElement("canvas").getContext("webgl2");
    webglSupport = context !== null;
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return webglSupport;
}
const neverChanges = () => () => {};

interface OrganOption {
  key: string;
  label: string;
  tone: StatusTone | null;
}

function BodyStage({
  markers,
  organs,
  selectedOrganKey,
  selectedModelOrgan,
  selectedBiomarkerId,
  dimmedBiomarkerIds,
  onSelectOrgan,
  onSelectModelOrgan,
  onSelectMarker,
  onReset,
  status,
  card,
  onCloseCard,
}: {
  markers: BodyMarker[];
  organs: OrganOption[];
  selectedOrganKey: string | null;
  selectedModelOrgan: ModelOrgan | null;
  selectedBiomarkerId: string | null;
  dimmedBiomarkerIds: ReadonlySet<string>;
  onSelectOrgan: (organKey: string | null) => void;
  onSelectModelOrgan: (organ: ModelOrgan) => void;
  onSelectMarker: (marker: BodyMarker) => void;
  onReset: () => void;
  /** Loading / error message for the organ measurements. */
  status: ReactNode;
  card: ReactNode;
  onCloseCard: () => void;
}) {
  const webgl = useSyncExternalStore<boolean | null>(neverChanges, hasWebGL, () => null);
  const [flips, setFlips] = useState(0);
  const [resets, setResets] = useState(0);
  const [hover, setHover] = useState<MarkerHover | null>(null);
  const open = card !== null;

  const fallback = (
    <div className="absolute inset-0 overflow-auto p-8 pt-28 text-center">
      <h3 className="text-base font-semibold">3D view unavailable</h3>
      <p className="mt-1 text-[11px] text-[var(--hb-muted)]">The 3D body could not be displayed. Browse biomarkers below.</p>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {markers.map((marker) => (
          <button key={marker.key} type="button" onClick={() => onSelectMarker(marker)} className={chipClass()}
            style={{ borderColor: TONES[flagTone(marker.measurement)].color }}>
            {marker.measurement.biomarkerName} · {flagLabel(marker.measurement)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section
      id="body-stage"
      aria-label="Interactive body map"
      className={`${theme.glass} relative h-[70vh] min-h-[520px] scroll-mt-4 overflow-hidden !rounded-3xl min-[901px]:h-full`}
    >
      {webgl === false ? (
        fallback
      ) : webgl ? (
        <ViewerBoundary fallback={fallback}>
          <LabBodyViewer
            markers={markers}
            selectedOrgan={selectedModelOrgan}
            selectedOrganKey={selectedOrganKey}
            selectedBiomarkerId={selectedBiomarkerId}
            dimmedBiomarkerIds={dimmedBiomarkerIds}
            flips={flips}
            resets={resets}
            onSelectOrgan={onSelectModelOrgan}
            onSelectMarker={onSelectMarker}
            onHover={setHover}
          />
        </ViewerBoundary>
      ) : (
        <StageMessage>Loading the 3D body…</StageMessage>
      )}

      {hover && (
        <div
          className={`${theme.glass} pointer-events-none absolute z-20 whitespace-nowrap !rounded-xl px-3 py-2 text-xs`}
          style={{ left: `min(${hover.x + 14}px, calc(100% - 180px))`, top: hover.y + 14 }}
        >
          <b>{hover.marker.measurement.biomarkerName}</b>
          <br />
          {hover.marker.measurement.valueText} {hover.marker.measurement.unit} · {hover.marker.measurement.status.label}
          <br />
          <span style={{ color: TONES[flagTone(hover.marker.measurement)].color }}>● </span>{flagLabel(hover.marker.measurement)}
        </div>
      )}

      <div className="absolute left-3.5 right-3.5 top-3.5 z-10">
        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-auto" role="group" aria-label="Choose an organ">
          {organs.map((organ) => (
            <button
              key={organ.key}
              type="button"
              aria-pressed={selectedOrganKey === organ.key}
              onClick={() => onSelectOrgan(selectedOrganKey === organ.key ? null : organ.key)}
              className={`${chipClass(selectedOrganKey === organ.key)} backdrop-blur`}
            >
              {organ.tone && (
                <i className="mr-1.5 inline-block size-2 rounded-full" style={{ background: TONES[organ.tone].color }} />
              )}
              {organ.label}
            </button>
          ))}
        </div>
        {status}
      </div>

      <div className="absolute bottom-3.5 left-3.5 z-10 flex gap-2">
        <button type="button" disabled={!webgl} onClick={() => setFlips((n) => n + 1)} className={chipClass(true)}>
          ⟲ Front / Back
        </button>
        <button type="button" onClick={() => { setResets((n) => n + 1); onReset(); }} className={`${chipClass()} bg-[var(--hb-glass)]`}>
          Reset
        </button>
      </div>
      <p className="absolute bottom-4 right-4 hidden text-[11px] text-[var(--hb-muted)] sm:block">
        Drag to rotate · scroll to zoom · click a sphere or organ
      </p>

      <div
        aria-hidden={!open}
        className={`${theme.glass} absolute inset-x-0 bottom-0 z-30 max-h-[72%] overflow-auto !rounded-b-none p-[18px] transition duration-300 min-[901px]:bottom-auto min-[901px]:left-auto min-[901px]:right-3.5 min-[901px]:top-3.5 min-[901px]:max-h-[calc(100%-28px)] min-[901px]:w-[380px] min-[901px]:max-w-[calc(100%-28px)] min-[901px]:!rounded-[20px] ${
          open
            ? "visible opacity-100"
            : "pointer-events-none invisible translate-y-10 opacity-0 min-[901px]:translate-x-8 min-[901px]:translate-y-0"
        }`}
      >
        <button type="button" aria-label="Close details" onClick={onCloseCard}
          className="absolute right-3.5 top-3 cursor-pointer text-xl text-[var(--hb-muted)]">
          ×
        </button>
        {card}
      </div>
    </section>
  );
}

/* ==========================================================================
 * HistoryChart
 * ========================================================================== */

const W = 340;
const H = 170;
const PAD = { left: 36, right: 14, top: 10, bottom: 24 };

type Point = LabMeasurement & { valueNumeric: number };

function shortDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
}

/**
 * Plots numeric measurements that share the unit of the most recent one
 * (different units are never mixed on one axis). Each measurement keeps its own
 * reference interval, since laboratories may print different ones.
 */
function HistoryChart({ measurements }: { measurements: LabMeasurement[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const numeric = sortByDate(measurements).filter((item): item is Point => item.valueNumeric !== null);
  const unit = numeric.at(-1)?.unit ?? null;
  const points = numeric.filter((item) => item.unit === unit);
  const omitted = measurements.length - points.length;

  if (points.length === 0) {
    return <p className="my-3 text-xs text-[var(--hb-muted)]">No numeric values are available to chart.</p>;
  }

  const values = points.flatMap((p) => [p.valueNumeric, p.referenceLow, p.referenceHigh]).filter((v): v is number => v !== null);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.12 || Math.abs(max) * 0.1 || 1;
  const y0 = min - pad;
  const y1 = max + pad;
  const plotWidth = W - PAD.left - PAD.right;
  const X = (i: number) => PAD.left + (points.length < 2 ? 0.5 : i / (points.length - 1)) * plotWidth;
  const Y = (v: number) => H - PAD.bottom - ((v - y0) / (y1 - y0)) * (H - PAD.top - PAD.bottom);
  const labelEvery = Math.ceil(points.length / 5);

  const first = points[0];
  const sharedInterval = points.every(
    (p) => p.referenceLow === first.referenceLow && p.referenceHigh === first.referenceHigh,
  );
  const hasBothBounds = (p: Point) => p.referenceLow !== null && p.referenceHigh !== null;
  const active = points.find((p) => p.id === activeId);

  return (
    <div>
      <p className="mt-2 min-h-[18px] text-xs" aria-live="polite">
        {active ? (
          <>
            <b>{active.valueText} {active.unit}</b> on {formatDate(active.measuredAt)} · {active.status.label} · interval{" "}
            {formatInterval(active)}
          </>
        ) : (
          <span className="text-[var(--hb-muted)]">Hover or focus a point for details</span>
        )}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full fill-[var(--hb-muted)] text-[9px]" role="group" aria-label="History chart">
        {points.map((p, i) => {
          if (!hasBothBounds(p) || (sharedInterval && i > 0)) return null;
          const width = sharedInterval ? plotWidth : 14;
          const x = sharedInterval ? PAD.left : X(i) - width / 2;
          return (
            <rect key={`band-${p.id}`} x={x} y={Y(p.referenceHigh!)} width={width}
              height={Math.max(Y(p.referenceLow!) - Y(p.referenceHigh!), 0)} fill="#6fcaa0" opacity={0.2} />
          );
        })}
        {points.map((p, i) =>
          // One-sided intervals are drawn as a dashed limit.
          hasBothBounds(p)
            ? null
            : [p.referenceLow, p.referenceHigh].map((bound, side) =>
                bound === null ? null : (
                  <line key={`limit-${p.id}-${side}`} x1={X(i) - 10} x2={X(i) + 10} y1={Y(bound)} y2={Y(bound)}
                    stroke="#5fbf8f" strokeWidth={1.5} strokeDasharray="3 2" />
                ),
              ),
        )}
        {sharedInterval && hasBothBounds(first) && (
          <text x={PAD.left + 4} y={Y(first.referenceHigh!) + 10}>
            Lab interval {first.referenceLow}–{first.referenceHigh}
          </text>
        )}
        {[min, (min + max) / 2, max].map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={Y(v)} y2={Y(v)} stroke="currentColor" opacity={0.08} />
            <text x={2} y={Y(v) + 3}>{+v.toFixed(2)}</text>
          </g>
        ))}
        {points.slice(1).map((p, i) => (
          <line key={`segment-${p.id}`} x1={X(i)} y1={Y(points[i].valueNumeric)} x2={X(i + 1)} y2={Y(p.valueNumeric)}
            stroke={p.status.tone === "watch" ? TONES.watch.color : "#6b3fa0"}
            strokeWidth={p.status.tone === "watch" ? 3.5 : 2} strokeLinecap="round" />
        ))}
        {points.map((p, i) => {
          const flagged = p.status.tone === "out";
          const stroke = p.status.tone === "normal" ? "#6b3fa0" : TONES[p.status.tone].color;
          return (
            <g key={p.id}>
              <circle cx={X(i)} cy={Y(p.valueNumeric)} r={flagged ? 6 : 4.5} fill={flagged ? stroke : "#fff"}
                stroke={stroke} strokeWidth={2} tabIndex={0} className="cursor-pointer"
                aria-label={`${p.valueText} ${p.unit ?? ""} on ${formatDate(p.measuredAt)}, ${p.status.label}`}
                onMouseEnter={() => setActiveId(p.id)} onFocus={() => setActiveId(p.id)} onClick={() => setActiveId(p.id)} />
              {(points.length - 1 - i) % labelEvery === 0 && (
                <text x={X(i)} y={H - 8} textAnchor="middle">{shortDate(p.measuredAt)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {omitted > 0 && (
        <p className="text-[10.5px] text-[var(--hb-muted)]">
          {omitted} {omitted === 1 ? "measurement is" : "measurements are"} not plotted (non-numeric or another unit).
          See the complete history.
        </p>
      )}
    </div>
  );
}

/* ==========================================================================
 * BiomarkerCard
 * ========================================================================== */

/** Details of one biomarker. Mount with `key={biomarkerId}` so local state resets. */
function BiomarkerCard({
  latest,
  history,
  organLabel,
  sourceTitle,
}: {
  latest: LabMeasurement;
  history: Resource<LabMeasurement[]>;
  organLabel: string | null;
  sourceTitle: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const measurements = sortByDate(history.data ?? []);
  const previous = measurements.filter(
    (item) => item.id !== latest.id,
  ).slice(-3).reverse();
  const row = "my-0.5 text-xs text-[var(--hb-muted)] [&>b]:font-medium [&>b]:text-[var(--hb-text)]";

  return (
    <>
      <h2 className="pr-8 text-lg font-semibold">{latest.biomarkerName}</h2>
      <p className="text-[11px] text-[var(--hb-muted)]">
        {[latest.category && categoryLabel(latest.category), organLabel].filter(Boolean).join(" · ") || "Category not provided"}
      </p>
      <p className="mb-0.5 mt-2 break-words text-3xl font-semibold">
        {latest.valueText} <small className="text-[13px] font-normal text-[var(--hb-muted)]">{latest.unit}</small>{" "}
        <StatusPill status={latest.status} />
      </p>
      <p className={row}>Laboratory interval: <b>{formatInterval(latest)}</b></p>
      <p className={row}>Latest measurement: <b>{formatDate(latest.measuredAt)}</b></p>
      <p className={row}>
        Laboratory critical flag:{" "}
        <b style={{ color: latest.criticalFlag === null ? undefined : TONES[flagTone(latest)].color }}>
          {latest.criticalFlag === true ? "Yes" : latest.criticalFlag === false ? "No" : "Not provided"}
        </b>
      </p>
      {sourceTitle && <p className={row}>Source: <b>{sourceTitle}</b></p>}

      {history.loading && !history.data ? (
        <Note role="status">Loading history…</Note>
      ) : history.error ? (
        <ErrorNote message={history.error} onRetry={history.reload} />
      ) : measurements.length === 0 ? (
        <Note>No history is available for this biomarker.</Note>
      ) : (
        <>
          <HistoryChart measurements={measurements} />
          <p className={row}>
            Previous:{" "}
            {previous.length > 0
              ? previous.map((m) => `${m.valueText} ${m.unit ?? ""} (${formatDate(m.measuredAt)})`).join(", ")
              : "none"}
          </p>
          <button type="button" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)} className={`${chipClass(true)} mt-2.5`}>
            {showAll ? "Hide complete history" : "View complete history"}
          </button>
          {showAll && (
            <table className="mt-2 w-full border-collapse text-xs">
              <thead className="sr-only">
                <tr><th>Date</th><th>Value</th><th>Interval and status</th></tr>
              </thead>
              <tbody>
                {measurements.slice().reverse().map((m) => (
                  <tr key={m.id} className="border-b border-[var(--hb-line)] align-top">
                    <td className="px-0.5 py-1.5">{formatDate(m.measuredAt)}</td>
                    <td className="px-0.5 py-1.5 font-medium">{m.valueText} {m.unit}</td>
                    <td className="px-0.5 py-1.5 text-right">
                      <StatusPill status={m.status} />
                      <span className="mt-0.5 block text-[10px] text-[var(--hb-muted)]">
                        {formatInterval(m)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
      <p className="mt-3 text-[10.5px] text-[var(--hb-muted)]">Informational only. Not a diagnosis.</p>
    </>
  );
}

/* ==========================================================================
 * LabSidebar
 * ========================================================================== */

const STAT_ORDER: StatusTone[] = ["normal", "watch", "out"];

function LabSidebar({
  latest,
  loading,
  error,
  onRetry,
  query,
  onQueryChange,
  categories,
  category,
  onCategoryChange,
  pendingCount,
  onReviewPending,
}: {
  /** Latest confirmed measurement of each biomarker; undefined until loaded. */
  latest: LabMeasurement[] | undefined;
  loading: boolean;
  error: string;
  onRetry: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  categories: string[];
  category: string | null;
  onCategoryChange: (value: string | null) => void;
  /** null while report reviews are still loading or failed. */
  pendingCount: number | null;
  /** Opens the reviewed-labs section. */
  onReviewPending: () => void;
}) {
  const counts = latest ? countByTone(latest) : null;
  const placeholder = loading ? "…" : "—";

  return (
    <aside
      aria-label="Biomarker overview and filters"
      className={`${theme.glass} flex flex-col gap-3.5 p-4 min-[901px]:h-full min-[901px]:overflow-auto`}
    >
      <dl className="grid grid-cols-2 gap-2">
        {[
          { label: "Tracked", value: latest?.length, color: undefined },
          ...STAT_ORDER.map((tone) => ({
            label: TONES[tone].stat,
            value: counts?.[tone],
            color: tone === "normal" ? undefined : TONES[tone].color,
          })),
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse rounded-[14px] border border-[var(--hb-line)] p-2.5">
            <dt className="text-[11px] text-[var(--hb-muted)]">{stat.label}</dt>
            <dd className="text-[22px] font-semibold" style={{ color: stat.color }}>{stat.value ?? placeholder}</dd>
          </div>
        ))}
      </dl>

      {error && <ErrorNote message={error} onRetry={onRetry} />}
      {latest?.length === 0 && <Note>No confirmed results yet. Confirm values from a report to start tracking them.</Note>}

      {pendingCount !== null && pendingCount > 0 && (
        <button type="button" onClick={onReviewPending}
          className={`cursor-pointer rounded-[14px] bg-[var(--hb-soft)] px-3 py-2 text-left text-xs font-medium underline-offset-2 hover:underline ${focus}`}>
          {pendingCount} extracted {pendingCount === 1 ? "value" : "values"} waiting for review →
        </button>
      )}

      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search a biomarker…"
        aria-label="Search biomarkers"
        className={inputClass}
      />

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
        {[null, ...categories].map((item) => (
          <button
            key={item ?? "__all"}
            type="button"
            aria-pressed={category === item}
            onClick={() => onCategoryChange(item)}
            className={chipClass(category === item)}
          >
            {item === null ? "All" : categoryLabel(item)}
          </button>
        ))}
      </div>

      <ul className="grid gap-1.5 text-[11px] text-[var(--hb-muted)]">
        <li className="font-medium text-[var(--hb-text)]">Sphere colour on the body</li>
        {FLAG_LEGEND.map(({ tone, label }) => (
          <li key={tone}>
            <i className="mr-2 inline-block size-2.5 rounded-full" style={{ background: TONES[tone].color }} />
            {label}
            {latest ? ` (${latest.filter((item) => flagTone(item) === tone).length})` : ""}
          </li>
        ))}
        <li className="mt-1 font-medium text-[var(--hb-text)]">Status badges</li>
        {TONE_ORDER.slice().reverse().map((tone) => (
          <li key={tone}>
            <i className="mr-2 inline-block size-2.5 rounded-full" style={{ background: TONES[tone].color }} />
            {TONES[tone].legend}
            {counts && tone === "unknown" && counts.unknown > 0 ? ` (${counts.unknown})` : ""}
          </li>
        ))}
        <li>Larger spheres are farther from the interval. Size is not severity.</li>
        <li>A line links a sphere to its organ. Spheres without a line have no linked organ; their place on the body has no meaning.</li>
      </ul>

      <p className="text-[10.5px] leading-[1.4] text-[var(--hb-muted)]">
        Statuses, reference intervals and critical flags come from your lab results. They are monitoring aids, not
        diagnoses.
      </p>
    </aside>
  );
}

/* ==========================================================================
 * ResultsList
 * ========================================================================== */

function ResultsList({
  results,
  total,
  loading,
  error,
  onRetry,
  selectedBiomarkerId,
  onSelect,
}: {
  /** Latest measurement per biomarker, already filtered. */
  results: LabMeasurement[];
  total: number;
  loading: boolean;
  error: string;
  onRetry: () => void;
  selectedBiomarkerId: string | null;
  onSelect: (biomarkerId: string) => void;
}) {
  const sorted = [...results].sort((a, b) => TONE_ORDER.indexOf(a.status.tone) - TONE_ORDER.indexOf(b.status.tone));

  return (
    <section aria-labelledby="confirmed-results-title" className={`${theme.glass} min-w-0 p-4`}>
      <h2 id="confirmed-results-title" className="text-base font-semibold">Confirmed results</h2>
      {error && <ErrorNote message={error} onRetry={onRetry} />}
      {loading && total === 0 ? (
        <Note role="status">Loading your results…</Note>
      ) : total === 0 ? (
        !error && <Note>No confirmed results yet.</Note>
      ) : sorted.length === 0 ? (
        <Note>No biomarker matches this search and category.</Note>
      ) : (
        <ul className="mt-3 grid max-h-[480px] gap-2 overflow-auto">
          {sorted.map((item) => (
            <li key={item.biomarkerId}>
              <button
                type="button"
                aria-pressed={selectedBiomarkerId === item.biomarkerId}
                onClick={() => onSelect(item.biomarkerId)}
                className={`flex w-full cursor-pointer flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[14px] border p-3 text-left transition hover:border-[var(--hb-rose)] ${
                  selectedBiomarkerId === item.biomarkerId ? "border-[var(--hb-violet)] bg-[var(--hb-soft)]" : "border-[var(--hb-line)]"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{item.biomarkerName}</span>
                  <span className="block text-[11px] text-[var(--hb-muted)]">
                    {item.category ? `${categoryLabel(item.category)} · ` : ""}{formatDate(item.measuredAt)}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold">
                    {item.valueText} <small className="font-normal text-[var(--hb-muted)]">{item.unit}</small>{" "}
                    <StatusPill status={item.status} />
                  </span>
                  <span className="block text-[11px] text-[var(--hb-muted)]">
                    Interval: {formatInterval(item)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ==========================================================================
 * CandidateRow (one extracted value in a report table)
 * ========================================================================== */

type TextField = Exclude<keyof CandidateDraft, "category">;

const FIELDS: { name: TextField; label: string; decimal?: boolean; required?: boolean; type?: "date"; maxLength?: number }[] = [
  { name: "biomarkerName", label: "Biomarker name", required: true, maxLength: FIELD_LIMITS.biomarkerName },
  { name: "valueText", label: "Value (as printed)", required: true, maxLength: FIELD_LIMITS.valueText },
  { name: "valueNumeric", label: "Numeric value (optional)", decimal: true },
  { name: "unit", label: "Unit", maxLength: FIELD_LIMITS.unit },
  { name: "referenceLow", label: "Reference low", decimal: true },
  { name: "referenceHigh", label: "Reference high", decimal: true },
  { name: "referenceRangeText", label: "Reference range (as printed)", maxLength: FIELD_LIMITS.referenceRangeText },
  { name: "measuredAt", label: "Measured at", type: "date" },
];

type Action = "save" | "confirm" | "reject";

const COLUMNS = ["Biomarker", "Value", "Reference range", "Measured", "Status", "Actions"] as const;
/** Fixed widths so the columns line up across the groups of a report. */
const COLUMN_WIDTHS: Record<(typeof COLUMNS)[number], string> = {
  Biomarker: "w-[19%]", Value: "w-[12%]", "Reference range": "w-[17%]", Measured: "w-[13%]", Status: "w-[14%]", Actions: "w-[25%]",
};
const cell = "py-2 pr-3 align-top";
const smallButton = (active = false) => `${chipClass(active)} !px-2.5 !py-1 text-[11px]`;

function CandidateRow({
  documentId,
  candidate,
  onChanged,
}: {
  documentId: string;
  candidate: LabCandidate;
  /** Called after a successful action; resolves once the data has been refreshed. */
  onChanged: (action: Action) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CandidateDraft | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState("");
  const pending = candidate.state === "pending";
  // Compared with the range printed on the same report (candidates carry no backend status).
  const status = statusFromInterval(candidate.valueNumeric, candidate.referenceLow, candidate.referenceHigh);

  async function run(action: Action, request: () => Promise<void>) {
    setBusy(action);
    setError("");
    try {
      await request();
      await onChanged(action);
      setDraft(null);
      setRejecting(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const result = buildCandidateEdit(draft);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    void run("save", () => updateCandidate(documentId, candidate.id, result.edit));
  }

  if (draft) {
    return (
      <tr className="border-t border-[var(--hb-line)] bg-[var(--hb-soft)]">
        <td colSpan={COLUMNS.length} className="p-3">
          <form onSubmit={save} aria-label={`Edit ${candidate.biomarkerName}`}>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((field) => (
                <label key={field.name} className="text-[11px] text-[var(--hb-muted)]">
                  {field.label}
                  <input
                    type={field.type ?? "text"}
                    value={draft[field.name]}
                    required={field.required}
                    maxLength={field.maxLength}
                    inputMode={field.decimal ? "decimal" : undefined}
                    onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })}
                    className={`${inputClass} mt-1`}
                  />
                </label>
              ))}
              <label className="text-[11px] text-[var(--hb-muted)]">
                Category
                <select
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                  className={`${inputClass} mt-1`}
                >
                  <option value="">Not set</option>
                  {LAB_CATEGORIES.map((item) => (
                    <option key={item} value={item}>{categoryLabel(item)}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="submit" disabled={busy !== null} className={chipClass(true)}>
                {busy === "save" ? "Saving…" : "Save changes"}
              </button>
              <button type="button" disabled={busy !== null} onClick={() => { setDraft(null); setError(""); }} className={chipClass()}>
                Cancel
              </button>
            </div>
            {error && <ErrorNote message={error} />}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-t border-[var(--hb-line)]">
        <td className={`${cell} break-words`}>
          <span className="block text-[13px] font-medium">{candidate.biomarkerName}</span>
          {candidate.category && (
            <span className="block text-[10.5px] text-[var(--hb-muted)]">{categoryLabel(candidate.category)}</span>
          )}
        </td>
        <td className={`${cell} break-words text-[13px] font-semibold`}>
          {candidate.valueText} <small className="font-normal text-[var(--hb-muted)]">{candidate.unit}</small>
        </td>
        <td className={`${cell} break-words text-[var(--hb-muted)]`}>{formatInterval(candidate)}</td>
        <td className={`${cell} whitespace-nowrap text-[var(--hb-muted)]`}>
          {candidate.measuredAt ? formatDate(candidate.measuredAt) : "—"}
        </td>
        <td className={cell}>
          {status.tone === "unknown" ? <span className="text-[var(--hb-muted)]">—</span> : <StatusPill status={status} />}
        </td>
        <td className={`${cell} !pr-0 text-right`}>
          {pending ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              {rejecting ? (
                <>
                  <button type="button" disabled={busy !== null} className={smallButton(true)}
                    onClick={() => void run("reject", () => rejectCandidate(documentId, candidate.id))}>
                    {busy === "reject" ? "Rejecting…" : "Yes, reject"}
                  </button>
                  <button type="button" disabled={busy !== null} onClick={() => setRejecting(false)} className={smallButton()}>
                    Keep
                  </button>
                </>
              ) : (
                <>
                  <button type="button" disabled={busy !== null} className={smallButton(true)}
                    onClick={() => void run("confirm", () => confirmCandidate(documentId, candidate.id))}>
                    {busy === "confirm" ? "Confirming…" : "Confirm"}
                  </button>
                  <button type="button" disabled={busy !== null} onClick={() => { setDraft(toDraft(candidate)); setError(""); }}
                    className={smallButton()}>
                    Edit
                  </button>
                  <button type="button" disabled={busy !== null} onClick={() => setRejecting(true)} className={smallButton()}>
                    Reject
                  </button>
                </>
              )}
            </div>
          ) : candidate.state === "confirmed" ? (
            <span className="whitespace-nowrap text-[11px] font-medium text-[#3f9b72]">✓ Confirmed</span>
          ) : (
            <span className="whitespace-nowrap text-[11px] font-medium text-[var(--hb-muted)]">Rejected</span>
          )}
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={COLUMNS.length}><ErrorNote message={error} /></td>
        </tr>
      )}
    </>
  );
}

/** One group of a report ("To review", "Confirmed", "Rejected") as a table. */
function CandidateTable({
  title,
  documentId,
  candidates,
  onChanged,
}: {
  title: string;
  documentId: string;
  candidates: LabCandidate[];
  onChanged: (action: Action, candidate: LabCandidate) => Promise<void>;
}) {
  return (
    <div className="mt-3">
      <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--hb-muted)]">
        {title} ({candidates.length})
      </h4>
      <div className="overflow-x-auto">
        <table className="mt-1 w-full min-w-[720px] table-fixed border-collapse text-xs">
          <thead>
            <tr className="text-left text-[10.5px] text-[var(--hb-muted)]">
              {COLUMNS.map((column) => (
                <th key={column} scope="col" className={`${COLUMN_WIDTHS[column]} py-1.5 pr-3 font-medium ${column === "Actions" ? "!pr-0 text-right" : ""}`}
                  title={column === "Status" ? "Compared with the reference range printed on the report" : undefined}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <CandidateRow
                key={`${documentId}:${candidate.id}`}
                documentId={documentId}
                candidate={candidate}
                onChanged={(action) => onChanged(action, candidate)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==========================================================================
 * ReportActions
 * ========================================================================== */

function Preview({ report, onClose }: { report: LabReportDetails; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    <dialog ref={dialog} onClose={onClose} aria-label={`${report.title} preview`}
      className="m-auto h-[92dvh] w-[min(1150px,96vw)] flex-col overflow-hidden rounded-2xl bg-white text-[#3b2a4f] backdrop:bg-[#3b2a4f]/70 open:flex">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#eadcf8] px-4">
        <h2 className="min-w-0 truncate text-sm font-semibold">{report.title}</h2>
        <button type="button" aria-label="Close preview" onClick={() => dialog.current?.close()} className="cursor-pointer text-2xl">×</button>
      </header>
      <iframe src={report.downloadUrl} title={`${report.title} preview`} className="min-h-0 w-full flex-1" />
    </dialog>
  );
}

/** View / download of the original file. Details are fetched on demand. */
function ReportActions({ documentId }: { documentId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<LabReportDetails | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function open(mode: "view" | "download") {
    setBusy(true);
    setError("");
    try {
      // Fetched on every click because download links may expire.
      const details = await getLabReportDetails(documentId);
      if (!mounted.current) return;
      if (mode === "view") setPreview(details);
      else window.location.assign(details.downloadUrl);
    } catch (caught) {
      if (mounted.current) setError(errorMessage(caught));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <>
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy} onClick={() => void open("view")} className={chipClass()}>View report</button>
        <button type="button" disabled={busy} onClick={() => void open("download")} className={chipClass()}>Download</button>
      </div>
      {error && <ErrorNote message={error} />}
      {preview && <Preview report={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

/* ==========================================================================
 * ReportReviewPanel (one section per report, values in tables)
 * ========================================================================== */

const pendingOf = (entry?: ReviewEntry) => entry?.review?.candidates.filter((c) => c.state === "pending").length;

function reportSummary(entry?: ReviewEntry): string {
  if (entry?.error) return "Couldn't load values";
  if (entry?.notFound) return "Not extracted yet";
  if (!entry?.review) return "Loading…";
  const count = (state: LabCandidate["state"]) => entry.review!.candidates.filter((c) => c.state === state).length;
  const [pending, confirmed, rejected] = [count("pending"), count("confirmed"), count("rejected")];
  if (pending + confirmed + rejected === 0) return "No values extracted";
  return [
    pending > 0 ? `${pending} to review` : "All reviewed",
    `${confirmed} confirmed`,
    rejected > 0 ? `${rejected} rejected` : null,
  ].filter(Boolean).join(" · ");
}

function ReportSection({
  report,
  entry,
  expanded,
  onToggle,
  onRefresh,
  onChanged,
}: {
  report: LabReport;
  entry?: ReviewEntry;
  expanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
  onChanged: (action: Action, candidate: LabCandidate) => Promise<void>;
}) {
  const [showRejected, setShowRejected] = useState(false);
  const candidates = entry?.review?.candidates ?? [];
  const byState = (state: LabCandidate["state"]) => candidates.filter((c) => c.state === state);
  const [pending, confirmed, rejected] = [byState("pending"), byState("confirmed"), byState("rejected")];
  const hasPending = pending.length > 0;
  const panelId = `report-${report.id}`;

  return (
    <li className={`rounded-[18px] border ${hasPending ? "border-[var(--hb-rose)]/50" : "border-[var(--hb-line)]"} bg-[var(--hb-glass)]`}>
      <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={onToggle}
        className={`flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 rounded-[18px] p-3.5 text-left ${focus}`}>
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className={`text-[var(--hb-muted)] transition ${expanded ? "rotate-90" : ""}`}>▸</span>
          <span className="min-w-0">
            <span className="block break-words text-sm font-semibold">{report.title}</span>
            <span className="block text-[11px] text-[var(--hb-muted)]">Added {formatDate(report.createdAt)}</span>
          </span>
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] ${hasPending ? "bg-[var(--hb-rose)] text-white" : "bg-[var(--hb-soft)]"}`}>
          {reportSummary(entry)}
        </span>
      </button>

      {expanded && (
        <div id={panelId} className="border-t border-[var(--hb-line)] px-3.5 pb-3.5">
          <ReportActions documentId={report.id} />
          {entry?.error && <ErrorNote message={entry.error} onRetry={onRefresh} />}
          {entry?.notFound ? (
            <div className="mt-2 rounded-[14px] bg-[var(--hb-soft)] px-3 py-2 text-xs">
              No extracted values are available for this report yet.{" "}
              <button type="button" onClick={onRefresh} className="cursor-pointer font-medium underline">Check again</button>
            </div>
          ) : !entry?.review ? (
            !entry?.error && <Note role="status">Loading extracted values…</Note>
          ) : candidates.length === 0 ? (
            <Note>No values were extracted from this report.</Note>
          ) : (
            <>
              {hasPending && <CandidateTable title="To review" documentId={report.id} candidates={pending} onChanged={onChanged} />}
              {confirmed.length > 0 && (
                <CandidateTable title="Confirmed" documentId={report.id} candidates={confirmed} onChanged={onChanged} />
              )}
              {rejected.length > 0 && (
                showRejected ? (
                  <CandidateTable title="Rejected" documentId={report.id} candidates={rejected} onChanged={onChanged} />
                ) : (
                  <button type="button" onClick={() => setShowRejected(true)} className={`${chipClass()} mt-3`}>
                    Show rejected ({rejected.length})
                  </button>
                )
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

function ReportReviewPanel({
  reports,
  entries,
  onRefreshReview,
  onResultsChanged,
  onShowResults,
}: {
  reports: Resource<LabReport[]>;
  entries: Record<string, ReviewEntry>;
  onRefreshReview: (documentId: string) => Promise<void>;
  /** Confirmed results changed on the server. */
  onResultsChanged: () => void;
  /** Opens the results section. */
  onShowResults: () => void;
}) {
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [pendingOnly, setPendingOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [confirmedName, setConfirmedName] = useState<string | null>(null);
  const all = reports.data ?? [];
  const visible = all.filter(
    (report) =>
      report.title.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!pendingOnly || (pendingOf(entries[report.id]) ?? 0) > 0),
  );
  // Newest first; the first report and every report with values to review start open.
  const sorted = [...visible].sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0));
  const isExpanded = (report: LabReport, index: number) =>
    toggled[report.id] ?? (index === 0 || (pendingOf(entries[report.id]) ?? 0) > 0);

  return (
    <section id="report-review" aria-labelledby="report-review-title" className={`${theme.glass} min-w-0 scroll-mt-4 p-4`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="report-review-title" className="text-base font-semibold">Lab reports</h2>
        <Link href="/documents" className="text-xs font-medium underline-offset-2 hover:underline">Manage documents</Link>
      </div>
      <p className="mt-0.5 text-[11px] text-[var(--hb-muted)]">
        Check the values extracted from each lab report, correct them if needed, then confirm or reject them.
      </p>
      {confirmedName && (
        <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-[var(--hb-soft)] px-3 py-2 text-xs">
          <span><b className="font-medium">{confirmedName}</b> was added to your results.</span>
          <span className="flex gap-2">
            <button type="button" onClick={onShowResults} className={chipClass(true)}>View results</button>
            <button type="button" aria-label="Dismiss" onClick={() => setConfirmedName(null)} className={chipClass()}>×</button>
          </span>
        </div>
      )}
      {reports.error && <ErrorNote message={reports.error} onRetry={reports.reload} />}
      {reports.loading && !reports.data ? (
        <Note role="status">Loading your lab reports…</Note>
      ) : reports.data && all.length === 0 ? (
        <Note>
          No lab reports yet.{" "}
          <Link href="/documents" className="underline">Upload one in your medical documents</Link> and choose the
          &ldquo;Lab report&rdquo; type so its values can be extracted for review.
        </Note>
      ) : all.length > 0 ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reports…" aria-label="Search reports" className={`${inputClass} min-w-40 flex-1`} />
            <button type="button" aria-pressed={pendingOnly} onClick={() => setPendingOnly((v) => !v)} className={chipClass(pendingOnly)}>
              To review only
            </button>
          </div>
          {sorted.length === 0 && <Note>No report matches.</Note>}
          <ul className="mt-3 grid gap-2.5">
            {sorted.map((report, index) => (
              <ReportSection
                key={report.id}
                report={report}
                entry={entries[report.id]}
                expanded={isExpanded(report, index)}
                onToggle={() => setToggled((all) => ({ ...all, [report.id]: !isExpanded(report, index) }))}
                onRefresh={() => void onRefreshReview(report.id)}
                onChanged={async (action, candidate) => {
                  // Keep the report open after its last pending value is handled.
                  setToggled((all) => ({ ...all, [report.id]: true }));
                  if (action === "confirm") {
                    setConfirmedName(candidate.biomarkerName);
                    onResultsChanged();
                  }
                  await onRefreshReview(report.id);
                }}
              />
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

/* ==========================================================================
 * SectionTabs
 * ========================================================================== */

type Section = "reports" | "results";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "reports", label: "Your reviewed labs" },
  { id: "results", label: "Results" },
];

function SectionTabs({
  section,
  onChange,
  pendingCount,
  trackedCount,
}: {
  section: Section;
  onChange: (section: Section) => void;
  pendingCount: number | null;
  trackedCount: number | null;
}) {
  const refs = useRef<Record<Section, HTMLButtonElement | null>>({ reports: null, results: null });

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = SECTIONS[(SECTIONS.findIndex((item) => item.id === section) + 1) % SECTIONS.length].id;
    onChange(next);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label="Lab results sections" onKeyDown={onKeyDown}
      className={`${theme.glass} mb-3.5 inline-flex gap-1 !rounded-full p-1`}>
      {SECTIONS.map(({ id, label }) => {
        const active = section === id;
        const badge = id === "reports"
          ? pendingCount ? `${pendingCount} pending` : null
          : trackedCount ? String(trackedCount) : null;
        return (
          <button
            key={id}
            ref={(node) => { refs.current[id] = node; }}
            type="button"
            role="tab"
            id={`lab-tab-${id}`}
            aria-selected={active}
            aria-controls={`lab-panel-${id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(id)}
            className={`cursor-pointer rounded-full px-4 py-2 text-[13px] font-medium transition ${focus} ${
              active ? "bg-[var(--hb-violet)] text-white" : "text-[var(--hb-text)] hover:bg-[var(--hb-soft)]"
            }`}
          >
            {label}
            {badge && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${active ? "bg-white/25" : "bg-[var(--hb-soft)]"}`}>
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ==========================================================================
 * PAGE
 * ========================================================================== */

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"] });

const loadReports = () => getLabReports();
const loadResults = (_key: string, signal: AbortSignal) => fetchConfirmedResults(signal);
const loadBody = (_key: string, signal: AbortSignal) => fetchBodyMeasurements(signal);

const MODEL_ORGAN_LABELS: Record<ModelOrgan, string> = {
  brain: "Brain",
  thyroid: "Thyroid",
  heart: "Heart",
  breasts: "Breasts",
  ovaries: "Ovaries",
  uterus: "Uterus",
};

export default function LabResultsClient() {
  const reports = useResource("reports", loadReports);
  const results = useResource("results", loadResults);
  const body = useResource("body", loadBody);

  const [section, setSection] = useState<Section>("reports");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [organKey, setOrganKey] = useState<string | null>(null);
  const [biomarkerId, setBiomarkerId] = useState<string | null>(null);
  const history = useResource(biomarkerId, fetchBiomarkerHistory);

  const documentIds = useMemo(() => (reports.data ?? []).map((report) => report.id), [reports.data]);
  const reviews = useReportReviews(documentIds);

  const latest = useMemo(() => (results.data ? latestPerBiomarker(results.data) : undefined), [results.data]);
  // Confirmed biomarkers that /body does not place in any organ group are shown
  // too, under a "No linked organ" group, so every result appears on the body.
  const groups = useMemo<OrganGroup[]>(() => {
    const fromBody = body.data ?? [];
    if (!results.data) return fromBody;
    const keyOf = (item: LabMeasurement) => [item.biomarkerId, `name:${item.biomarkerName.trim().toLowerCase()}`];
    const grouped = new Set(fromBody.flatMap((group) => group.measurements.flatMap(keyOf)));
    const unlinked = results.data.filter((item) => !keyOf(item).some((key) => grouped.has(key)));
    if (unlinked.length === 0) return fromBody;
    return [...fromBody, { organKey: UNLINKED_KEY, label: "No linked organ", measurements: unlinked }];
  }, [body.data, results.data]);
  const markers = useMemo(() => layoutMarkers(groups), [groups]);
  const bodyLatest = useMemo(() => latestPerBiomarker(groups.flatMap((group) => group.measurements)), [groups]);

  const categories = useMemo(
    () => [...new Set([...(latest ?? []), ...bodyLatest].flatMap((item) => item.category ?? []))].sort(),
    [latest, bodyLatest],
  );
  const filtered = useMemo(
    () => (latest ?? []).filter((item) => matchesFilters(item, query, category)),
    [latest, query, category],
  );
  const dimmed = useMemo(
    () => new Set(bodyLatest.filter((item) => !matchesFilters(item, query, category)).map((item) => item.biomarkerId)),
    [bodyLatest, query, category],
  );

  const organs = useMemo<OrganOption[]>(
    () => groups.map((group) => ({
      key: group.organKey,
      label: group.label,
      tone: group.measurements.length > 0 ? worstFlagTone(latestPerBiomarker(group.measurements)) : null,
    })),
    [groups],
  );

  const selectedGroup = groups.find((group) => group.organKey === organKey);
  const modelOrgan = organKey ? toModelOrgan(organKey) : null;
  const organLabel = selectedGroup?.label ?? (modelOrgan ? MODEL_ORGAN_LABELS[modelOrgan] : null);

  const selected = biomarkerId
    ? latest?.find((item) => item.biomarkerId === biomarkerId) ??
      bodyLatest.find((item) => item.biomarkerId === biomarkerId)
    : undefined;
  const selectedOrganName =
    organLabel ??
    groups.find((group) => group.measurements.some((item) => item.biomarkerId === biomarkerId))?.label ??
    null;

  const closeCard = useCallback(() => {
    setBiomarkerId(null);
    setOrganKey(null);
  }, []);

  function selectOrgan(key: string | null) {
    setBiomarkerId(null);
    setOrganKey(key);
  }

  function selectModelOrgan(organ: ModelOrgan) {
    selectOrgan(groups.find((group) => toModelOrgan(group.organKey) === organ)?.organKey ?? organ);
  }

  function selectMarker(marker: BodyMarker) {
    setOrganKey(marker.organKey);
    setBiomarkerId(marker.measurement.biomarkerId);
  }

  function selectFromList(id: string) {
    const group = groups.find((item) => item.measurements.some((m) => m.biomarkerId === id));
    setOrganKey(group?.organKey ?? null);
    setBiomarkerId(id);
    document.getElementById("body-stage")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function reloadResults() {
    results.reload();
    body.reload();
    history.reload();
  }

  const reviewList = documentIds.map((id) => reviews.entries[id]);
  const pendingCount = reports.data && reviewList.every((entry) => entry?.review || entry?.notFound)
    ? reviewList.reduce((sum, entry) => sum + (pendingOf(entry) ?? 0), 0)
    : null;

  let card: ReactNode = null;
  if (selected) {
    card = (
      <BiomarkerCard
        key={selected.biomarkerId}
        latest={selected}
        history={history}
        organLabel={selectedOrganName}
        sourceTitle={reports.data?.find((report) => report.id === selected.documentId)?.title ?? null}
      />
    );
  } else if (organKey) {
    const items = latestPerBiomarker(selectedGroup?.measurements ?? []).sort(
      (a, b) => TONE_ORDER.indexOf(a.status.tone) - TONE_ORDER.indexOf(b.status.tone),
    );
    card = (
      <>
        <h2 className="pr-8 text-lg font-semibold">{organLabel ?? organKey}</h2>
        <p className="text-[11px] text-[var(--hb-muted)]">
          {organKey === UNLINKED_KEY ? "Confirmed biomarkers that are not linked to an organ" : "Associated biomarkers"}
        </p>
        {body.loading && !body.data ? (
          <Note role="status">Loading measurements…</Note>
        ) : items.length === 0 ? (
          <Note>No measurements are associated with this organ.</Note>
        ) : (
          <ul className="mt-3 grid gap-2">
            {items.map((item) => (
              <li key={item.biomarkerId}>
                <button type="button" onClick={() => setBiomarkerId(item.biomarkerId)}
                  className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 rounded-[14px] border border-[var(--hb-line)] p-2.5 text-left text-xs hover:border-[var(--hb-rose)]">
                  <span className="font-medium">{item.biomarkerName}</span>
                  <span>{item.valueText} {item.unit} <StatusPill status={item.status} /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <main
      className={`${poppins.className} ${theme.theme} min-h-dvh w-full p-4`}
      onKeyDown={(event) => { if (event.key === "Escape") closeCard(); }}
    >
      <style>{THEME_CSS}</style>
      <header className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          Her<span className="text-[var(--hb-violet)]">Body</span> · My Body Biomarker Universe
        </h1>
        <span className="rounded-full bg-[#eadcf8] px-2.5 py-1 text-[11px] text-[#3b2a4f]">Private health records</span>
      </header>

      <SectionTabs
        section={section}
        onChange={setSection}
        pendingCount={pendingCount}
        trackedCount={latest?.length ?? null}
      />

      {section === "reports" ? (
        <div role="tabpanel" id="lab-panel-reports" aria-labelledby="lab-tab-reports">
          <ReportReviewPanel
            reports={reports}
            entries={reviews.entries}
            onRefreshReview={reviews.refresh}
            onResultsChanged={reloadResults}
            onShowResults={() => setSection("results")}
          />
        </div>
      ) : (
        <div role="tabpanel" id="lab-panel-results" aria-labelledby="lab-tab-results">
          <div className="grid gap-3.5 min-[901px]:h-[calc(100dvh-150px)] min-[901px]:min-h-[560px] min-[901px]:grid-cols-[300px_minmax(0,1fr)] min-[901px]:grid-rows-[minmax(0,1fr)]">
            <LabSidebar
              latest={latest}
              loading={results.loading}
              error={results.error}
              onRetry={results.reload}
              query={query}
              onQueryChange={setQuery}
              categories={categories}
              category={category}
              onCategoryChange={setCategory}
              pendingCount={pendingCount}
              onReviewPending={() => setSection("reports")}
            />
            <BodyStage
              markers={markers}
              organs={organs}
              selectedOrganKey={organKey}
              selectedModelOrgan={modelOrgan}
              selectedBiomarkerId={biomarkerId}
              dimmedBiomarkerIds={dimmed}
              onSelectOrgan={selectOrgan}
              onSelectModelOrgan={selectModelOrgan}
              onSelectMarker={selectMarker}
              onReset={closeCard}
              card={card}
              onCloseCard={closeCard}
              status={
                body.error ? (
                  <div className="max-w-sm"><ErrorNote message={body.error} onRetry={body.reload} /></div>
                ) : body.loading && !body.data ? (
                  <div className="max-w-sm"><Note role="status">Loading organ measurements…</Note></div>
                ) : groups.length === 0 ? (
                  <div className="max-w-sm"><Note>No organ measurements yet.</Note></div>
                ) : null
              }
            />
          </div>
          <div className="mt-3.5">
            <ResultsList
              results={filtered}
              total={latest?.length ?? 0}
              loading={results.loading}
              error={results.error}
              onRetry={results.reload}
              selectedBiomarkerId={biomarkerId}
              onSelect={selectFromList}
            />
          </div>
        </div>
      )}
    </main>
  );
}