"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { login } from "@/lib/api/auth";

type FormMode = "login" | "register" | "verify" | "forgot" | "reset";

const config: Record<FormMode, { title: string; subtitle: string }> = {
  login: {
    title: "Welcome back to yourself.",
    subtitle:
      "Sign in to explore your personalized anatomical journey and synchronized biological cadence.",
  },
  register: {
    title: "Registration unavailable",
    subtitle: "Account creation is not connected to the backend yet.",
  },
  verify: {
    title: "Email verification unavailable",
    subtitle: "Email verification is not connected to the backend yet.",
  },
  forgot: {
    title: "Password recovery unavailable",
    subtitle: "Password recovery is not connected to the backend yet.",
  },
  reset: {
    title: "Password reset unavailable",
    subtitle: "Password reset is not connected to the backend yet.",
  },
};

export default function AuthForm({ mode }: { mode: FormMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("Password must contain at least 12 characters.");
      return;
    }

    setLoading(true);
    try {
      await login(email, password, rememberMe);
      sessionStorage.setItem("herbody_user_email", email);
      router.push("/health-journey");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to complete this request.",
      );
    } finally {
      setLoading(false);
    }
  }

  const content = config[mode];

  return (
    <section className="auth-card">
      <Image
        src="/herbody_logo.png"
        alt=""
        width={32}
        height={32}
        className="auth-card-logo"
      />
      <h2>{content.title}</h2>
      <p className="form-subtitle">{content.subtitle}</p>
      {mode === "login" ? (
        <>
          <form onSubmit={submit}>
            <label>
              <span className="auth-field-heading">
                <span>Email Address</span>
                <span className="field-note">Medical ID / Personal</span>
              </span>
              <span className="auth-input-wrap">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="sophie@example.com"
                />
              </span>
            </label>
            <label>
              <span className="auth-field-heading">
                <span>Password</span>
                <Link className="field-link" href="/forgot-password">
                  Forgot password?
                </Link>
              </span>
              <span className="auth-input-wrap">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="15" r="4" />
                  <path d="m11 12 8-8 2 2-2 2 2 2-3 3-2-2-2 2" />
                </svg>
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••••"
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                </button>
              </span>
            </label>
            <label className="remember-row">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span>Remember me on this private device</span>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button" disabled={loading}>
              {loading ? "Please wait…" : "Enter HerBody →"}
            </button>
          </form>
          <p className="switch-text">
            New to HerBody?{" "}
            <Link href="/register">Create your confidential account</Link>
          </p>
        </>
      ) : (
        <p className="switch-text" role="status">
          <Link href="/login">← Back to sign in</Link>
        </p>
      )}
    </section>
  );
}
