import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h2 className="mb-5 text-lg font-semibold">Create your account</h2>
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </>
  );
}
