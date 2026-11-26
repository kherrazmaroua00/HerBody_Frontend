import Link from "next/link";
import Image from "next/image";

export default function AuthShell({
  children,
  mode = "login",
}: {
  children: React.ReactNode;
  mode?: "login" | "register";
}) {
  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link href="/" className="auth-logo">
          <Image
            src="/herbody_logo.png"
            alt=""
            width={28}
            height={28}
            priority
          />
          <span>HerBody</span>
        </Link>
        <div className="auth-header-links">
          <Link href="/healthy-life">
            <span aria-hidden="true">◌</span> Explore Anonymously
          </Link>
          <Link href={mode === "login" ? "/health-journey" : "/login"}>
            <span aria-hidden="true">←</span>
            {mode === "login" ? "Return Home" : "Sign in"}
          </Link>
        </div>
      </header>
      <div className="auth-content">{children}</div>
      <p className="auth-disclaimer">HerBody honors biological autonomy. Encrypted at rest. Never sold to third-party data brokers.</p>
    </main>
  );
}

export function FeaturePanel({ register = false }: { register?: boolean }) {
  return (
    <aside className="feature-panel">
      <span className="eyebrow">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-3">
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 1 1 8 0v3" />
        </svg>
        CONFIDENTIAL HEALTH SANCTUARY
      </span>
      <h1>{register ? "Begin your journey of anatomical discovery." : <>Scientific clarity meets <em>intimate intuition.</em></>}</h1>
      <p>{register ? "Join thousands of women exploring their bodies with clinical accuracy, transparent 3D physiological models, and compassionate AI companions." : "Your anatomical twin, synchronized with your hormonal cycles, medical benchmarks, and everyday vitality."}</p>
      <div className="body-image-wrap">
        <Image
          src="/body.png"
          alt="3D anatomical body visualization"
          width={410}
          height={306}
          priority
        />
      </div>
    </aside>
  );
}
