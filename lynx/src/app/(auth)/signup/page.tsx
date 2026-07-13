import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { signUp } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthForm
      title="Create your account"
      action={signUp}
      submitLabel="Sign up"
      error={error}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--accent)" }}>
            Sign in
          </Link>
        </>
      }
    />
  );
}
