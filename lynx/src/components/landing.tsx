import Link from "next/link";

function FloatCard({
  className,
  delay,
  children,
}: {
  className: string;
  delay: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute hidden md:block rounded-2xl border p-4 animate-float ${className}`}
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-lg)",
        animationDelay: delay,
      }}
    >
      {children}
    </div>
  );
}

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Big lynx logo, upper middle */}
      <div
        className="animate-fade-up absolute left-1/2 top-[12%] z-20 -translate-x-1/2 text-6xl font-bold tracking-tight sm:text-7xl"
        style={{ color: "var(--text)" }}
      >
        lynx<span style={{ color: "var(--accent)" }}>.</span>
      </div>

      {/* Soft accent glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
      />

      {/* Decorative floating cards */}
      <FloatCard className="left-[8%] top-[24%] w-44" delay="0s">
        <div className="mb-2 h-2 w-12 rounded-full" style={{ background: "var(--accent)" }} />
        <div className="mb-1.5 h-2 w-full rounded-full" style={{ background: "var(--border)" }} />
        <div className="h-2 w-2/3 rounded-full" style={{ background: "var(--border)" }} />
      </FloatCard>
      <FloatCard className="right-[9%] top-[30%] w-40" delay="1.5s">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-md border" style={{ borderColor: "var(--accent)" }} />
          <div className="h-2 w-20 rounded-full" style={{ background: "var(--border)" }} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="grid h-4 w-4 place-items-center rounded-md" style={{ background: "var(--accent)" }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </span>
          <div className="h-2 w-16 rounded-full" style={{ background: "var(--border)" }} />
        </div>
      </FloatCard>
      <FloatCard className="right-[16%] bottom-[16%] w-36" delay="0.8s">
        <div className="text-xs font-semibold" style={{ color: "var(--text)" }}>Reminder</div>
        <div className="mt-1 h-2 w-20 rounded-full" style={{ background: "var(--border)" }} />
      </FloatCard>

      {/* Hero */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <p
          className="animate-fade-up text-sm font-semibold uppercase tracking-[0.2em]"
          style={{ color: "var(--accent)", animationDelay: "0.08s" }}
        >
          Personal Vault
        </p>
        <h1
          className="animate-fade-up mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-6xl"
          style={{ color: "var(--text)", animationDelay: "0.12s" }}
        >
          Notes, photos, and AI —
          <span style={{ color: "var(--accent)" }}> calm, fast, yours.</span>
        </h1>
        <p
          className="animate-fade-up mt-5 max-w-md text-base sm:text-lg"
          style={{ color: "var(--muted)", animationDelay: "0.2s" }}
        >
          Everything in one beautiful space that syncs across every device — write,
          attach photos, set reminders, and ask AI about any note.
        </p>
        <div className="animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "0.28s" }}>
          <Link
            href="/signup"
            className="rounded-xl px-6 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5"
            style={{ background: "var(--accent)", color: "var(--accent-fg)", boxShadow: "var(--shadow)" }}
          >
            Sign Up
          </Link>
          <Link
            href="/login"
            className="rounded-xl border px-6 py-3 text-sm font-semibold transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
