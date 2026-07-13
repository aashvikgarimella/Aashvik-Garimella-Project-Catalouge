import { type ReactNode } from "react";
import { GoogleButton } from "./google-button";

export function AuthForm({
  title,
  action,
  submitLabel,
  footer,
  error,
  message,
}: {
  title: string;
  action: (formData: FormData) => void;
  submitLabel: string;
  footer: ReactNode;
  error?: string;
  message?: string;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg)" }}
    >
      <form
        action={action}
        className="w-full max-w-sm rounded-3xl border p-7 flex flex-col gap-4"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg text-base font-bold"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            l
          </span>
          <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            lynx
          </span>
        </div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
          {title}
        </h1>
        {message && (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {message}
          </p>
        )}
        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        <GoogleButton />
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--muted)" }}>
          <span className="h-px flex-1" style={{ background: "var(--border)" }} />
          or
          <span className="h-px flex-1" style={{ background: "var(--border)" }} />
        </div>
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          autoComplete="email"
          className="rounded-md border px-3 py-2 text-sm"
          style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
        />
        <input
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="Password"
          autoComplete="current-password"
          className="rounded-md border px-3 py-2 text-sm"
          style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
        />
        <button
          type="submit"
          className="rounded-md px-4 py-2 text-sm font-medium"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          {submitLabel}
        </button>
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          {footer}
        </div>
      </form>
    </div>
  );
}
