import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { signInWithPassword } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  return (
    <AuthForm
      title="Sign in"
      action={signInWithPassword}
      submitLabel="Sign in"
      error={error}
      message={message}
      footer={
        <>
          No account?{" "}
          <Link href="/signup" style={{ color: "var(--accent)" }}>
            Create one
          </Link>
        </>
      }
    />
  );
}
