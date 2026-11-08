import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h2 className="mb-5 text-lg font-semibold">Welcome back</h2>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </>
  );
}
