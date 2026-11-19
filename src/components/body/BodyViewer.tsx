"use client";

import { OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Component, type ReactNode, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { ORGANS, MODEL_URL } from "@/lib/organs";
import type { OrganId } from "@/types/organ";

type BodyViewerProps = {
  selectedOrgan: OrganId | null;
  onSelect: (organ: OrganId | null) => void;
};

type ViewerErrorBoundaryProps = {
  children: ReactNode;
  onRetry: () => void;
};

type ViewerErrorBoundaryState = {
  failed: boolean;
  message: string;
};

class ViewerErrorBoundary extends Component<
  ViewerErrorBoundaryProps,
  ViewerErrorBoundaryState
> {
  state: ViewerErrorBoundaryState = { failed: false, message: "" };

  static getDerivedStateFromError(): ViewerErrorBoundaryState {
    return { failed: true, message: "" };
  }

  componentDidCatch(error: Error) {
    this.setState({
      message: error.message,
    });
  }

  render() {
    if (this.state.failed) {
      const webglUnavailable =
        this.state.message.toLowerCase().includes("webgl") ||
        this.state.message.toLowerCase().includes("context");
      return (
        <div className="grid h-full min-h-80 place-items-center p-6 text-center">
          <div>
            <p className="font-semibold text-brand-purple">
              {webglUnavailable ? "WebGL is unavailable." : "The 3D model could not load."}
            </p>
            <p className="mt-2 text-sm text-ink/70">
              {webglUnavailable
                ? "Enable hardware acceleration or open this page in a WebGL-enabled browser."
                : "Check your connection and try again."}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ failed: false, message: "" });
                this.props.onRetry();
              }}
              className="mt-4 rounded-full bg-brand-purple px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const ORGAN_IDS = Object.keys(ORGANS) as OrganId[];

// Resolve a hit object to an organ by walking up its parents, so the invisible
// `collider_*` child meshes resolve to their parent `organ_*` node.
function organFromObject(object: THREE.Object3D | null): OrganId | null {
  for (let node = object; node; node = node.parent) {
    const id = ORGAN_IDS.find((organId) => ORGANS[organId].meshNames.includes(node.name));
    if (id) return id;
  }
  return null;
}

// The first thing a ray hits is usually the translucent `body_shell` or a non-selectable
// collider (e.g. `collider_breasts`), so look through the whole hit list for the first organ.
function organFromHits(intersections: THREE.Intersection[]): OrganId | null {
  for (const hit of intersections) {
    const id = organFromObject(hit.object);
    if (id) return id;
  }
  return null;
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

// Fail fast when the browser has no WebGL, so ViewerErrorBoundary shows its message and
// Retry button instead of leaving a blank canvas. Retry remounts this and re-checks.
function WebGLGuard() {
  const [supported] = useState(hasWebGL);
  if (!supported) throw new Error("WebGL is unavailable.");
  return null;
}

function Model({ selectedOrgan, onSelect }: BodyViewerProps) {
  const gltf = useGLTF(MODEL_URL);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const [hoveredOrgan, setHoveredOrgan] = useState<OrganId | null>(null);

  useEffect(() => {
    const brandPink =
      typeof window === "undefined"
        ? new THREE.Color("pink")
        : new THREE.Color(
            getComputedStyle(document.documentElement)
              .getPropertyValue("--color-brand-pink")
              .trim() || "pink",
          );

    scene.traverse((object) => {
      if (!((object as THREE.Mesh).isMesh)) return;
      const mesh = object as THREE.Mesh;

      const matchingOrgan = (Object.keys(ORGANS) as OrganId[]).find((organId) =>
        ORGANS[organId].meshNames.includes(mesh.name),
      );
      const restyle = (material: THREE.Material) => {
        const cloned = material.clone();
        if (cloned instanceof THREE.MeshStandardMaterial) {
          const isActive =
            matchingOrgan === selectedOrgan || matchingOrgan === hoveredOrgan;
          cloned.emissive.copy(isActive ? brandPink : new THREE.Color("black"));
          cloned.emissiveIntensity = matchingOrgan === selectedOrgan ? 1.1 : matchingOrgan === hoveredOrgan ? 0.35 : 0;
        }
        return cloned;
      };

      // Keep a single material single. Assigning an array to a mesh whose geometry has no
      // groups (true for every mesh in this GLB) makes three.js draw and raycast nothing.
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(restyle)
        : restyle(mesh.material);
    });
  }, [hoveredOrgan, scene, selectedOrgan]);

  useEffect(() => {
    document.body.style.cursor = hoveredOrgan ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hoveredOrgan]);

  function handleClick(event: ThreeEvent<MouseEvent>, organ: OrganId) {
    event.stopPropagation();
    onSelect(organ);
  }

  return (
    <primitive
      object={scene}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        const organId = organFromHits(event.intersections);
        if (organId) handleClick(event, organId);
      }}
      onPointerMove={(event: ThreeEvent<PointerEvent>) => {
        const organId = organFromHits(event.intersections);
        setHoveredOrgan(organId);
        if (organId) event.stopPropagation();
      }}
      onPointerOut={() => setHoveredOrgan(null)}
    />
  );
}

useGLTF.preload(MODEL_URL);

export default function BodyViewer(props: BodyViewerProps) {
  const [retryKey, setRetryKey] = useState(0);

  return (
    <ViewerErrorBoundary
      onRetry={() => {
        useGLTF.clear(MODEL_URL);
        setRetryKey((key) => key + 1);
      }}
    >
      <WebGLGuard />
      <Canvas
        key={retryKey}
        style={{ width: "100%", height: "100%", display: "block" }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0.55, 2.2], fov: 32, near: 0.1, far: 100 }}
        fallback={
          <div className="grid h-full min-h-80 place-items-center p-6 text-center">
            <p className="font-semibold text-brand-purple">
              WebGL is unavailable. Enable hardware acceleration to view the 3D body.
            </p>
          </div>
        }
        onPointerMissed={() => props.onSelect(null)}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        aria-label="Interactive 3D human body model"
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 4, 5]} intensity={1.5} />
        <Model {...props} />
        <OrbitControls
          makeDefault
          target={[0, 0.55, 0]}
          enablePan={false}
          enableDamping
          dampingFactor={0.06}
          minDistance={1.5}
          maxDistance={8}
          rotateSpeed={0.7}
          zoomSpeed={0.7}
        />
      </Canvas>
    </ViewerErrorBoundary>
  );
}