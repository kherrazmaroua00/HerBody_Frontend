"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiRequest, saveAccessToken } from "@/lib/api";

type FormMode = "login" | "register" | "verify" | "forgot" | "reset";

const config = {
  login: { title: "Welcome back to yourself.", subtitle: "Sign in to explore your personalized anatomical journey and synchronized biological cadence.", button: "Enter HerBody →" },
  register: { title: "Create your confidential profile", subtitle: "Start exploring for free. No credit card required.", button: "Begin Exploration – Free →" },
  verify: { title: "Verify your email", subtitle: "Enter the six-digit code we sent to your inbox.", button: "Verify email →" },
  forgot: { title: "Recover your account", subtitle: "We’ll send a one-time password to your email.", button: "Send recovery code →" },
  reset: { title: "Create a new password", subtitle: "Choose a strong password to keep your account private.", button: "Reset password →" },
} as const;

export default function AuthForm({ mode }: { mode: FormMode }) {
  const router = useRouter();
  const [values, setValues] = useState({ fullName: "", email: "", password: "", otp: "", newPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const update = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    if ((mode === "login" || mode === "register") && values.password.length < 8) {
      setError("Password must contain at least 8 characters."); return;
    }
    if (mode === "reset" && values.newPassword.length < 8) {
      setError("New password must contain at least 8 characters."); return;
    }
    setLoading(true);
    try {
      const path = { login: "/api/auth/login", register: "/api/auth/register", verify: "/api/auth/verify-email", forgot: "/api/auth/forgot-password", reset: "/api/auth/reset-password" }[mode];
      const body = mode === "register" ? { fullName: values.fullName, email: values.email, password: values.password }
        : mode === "login" ? { email: values.email, password: values.password }
        : mode === "verify" ? { email: values.email, otp: values.otp }
        : mode === "forgot" ? { email: values.email }
        : { email: values.email, otp: values.otp, newPassword: values.newPassword };
      const data = await apiRequest<unknown>(path, { method: "POST", body: JSON.stringify(body) });
      saveAccessToken(data);
      if (mode === "login") {
        sessionStorage.setItem("herbody_user_name", values.email.split("@")[0]);
      }
      if (mode === "register") {
        sessionStorage.setItem("herbody_user_name", values.fullName);
      }
      if (mode === "login") router.push("/health-journey");
      else if (mode === "register") router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
      else if (mode === "forgot") router.push(`/reset-password?email=${encodeURIComponent(values.email)}`);
      else if (mode === "reset") router.push("/login");
      else router.push("/health-journey");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete this request.");
    } finally { setLoading(false); }
  }

  const c = config[mode];
  return <section className="auth-card">
    <span className="sparkle">✦</span>
    <h2>{c.title}</h2><p className="form-subtitle">{c.subtitle}</p>
    <form onSubmit={submit}>
      {mode === "register" && <label>Preferred First Name or Pseudonym<input required value={values.fullName} onChange={update("fullName")} placeholder="e.g. Maya or Serene" /><small>What should your anatomical companion call you?</small></label>}
      <label>Email Address<input required type="email" value={values.email} onChange={update("email")} placeholder="name@domain.com" /></label>
      {(mode === "login" || mode === "register") && <label>{mode === "register" ? "Create Confidential Password" : "Password"}<input required type="password" value={values.password} onChange={update("password")} placeholder="••••••••••••" />{mode === "login" && <Link className="field-link" href="/forgot-password">Forgot password?</Link>}</label>}
      {mode === "verify" || mode === "reset" ? <label>One-Time Password<input required inputMode="numeric" pattern="[0-9]{6}" value={values.otp} onChange={update("otp")} placeholder="123456" /></label> : null}
      {mode === "reset" && <label>New Password<input required type="password" value={values.newPassword} onChange={update("newPassword")} placeholder="At least 8 characters" /></label>}
      {mode === "login" && <label className="checkbox"><input type="checkbox" /> Remember my cycle sync on this private device</label>}
      {mode === "register" && <label className="checkbox"><input required type="checkbox" /> I agree to the Terms of Care and Reproductive Privacy Commitment.</label>}
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success">{message}</p>}
      <button className="primary-button" disabled={loading}>{loading ? "Please wait…" : c.button}</button>
    </form>
    {mode === "login" && <p className="switch-text">New to HerBody? <Link href="/register">Create your confidential account</Link></p>}
    {mode === "register" && <p className="switch-text">Already have an account? <Link href="/login">Sign In</Link></p>}
    {mode === "verify" && <button type="button" className="text-button" onClick={async () => {
      setError(""); setMessage(""); setLoading(true);
      try {
        await apiRequest("/api/auth/resend-verification-otp", { method: "POST", body: JSON.stringify({ email: values.email }) });
        setMessage("A new verification code was sent.");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to resend the code.");
      } finally { setLoading(false); }
    }}>Resend code</button>}
    {(mode === "verify" || mode === "reset") && <p className="switch-text"><Link href="/login">← Back to sign in</Link></p>}
    {mode === "forgot" && <p className="switch-text"><Link href="/login">← Back to sign in</Link></p>}
  </section>;
}
