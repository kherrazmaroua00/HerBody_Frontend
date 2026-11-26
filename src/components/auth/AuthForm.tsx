"use client";

import Link from "next/link";
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("Password must contain at least 12 characters.");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      sessionStorage.setItem("herbody_user_email", email);
      router.push("/");
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
      <span className="sparkle">✦</span>
      <h2>{content.title}</h2>
      <p className="form-subtitle">{content.subtitle}</p>
      {mode === "login" ? (
        <>
          <form onSubmit={submit}>
            <label>
              Email Address
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
              <Link className="field-link" href="/forgot-password">
                Forgot password?
              </Link>
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
