"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { useDeviceTimezone } from "@/lib/client-env";
import { login, signup, type AuthState } from "@/lib/actions/auth";
import { Button, Input, Label } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? login : signup, undefined);
  const next = useSearchParams().get("next") ?? "";
  const tz = useDeviceTimezone() ?? "UTC";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="timezone" value={tz} />
      {mode === "signup" && (
        <label className="block">
          <Label>Name</Label>
          <Input name="name" required autoComplete="name" defaultValue={state?.fields?.name} />
        </label>
      )}
      <label className="block">
        <Label>Email</Label>
        <Input name="email" type="email" required autoComplete="email" defaultValue={state?.fields?.email} />
      </label>
      <label className="block">
        <Label hint={mode === "signup" ? "8+ characters" : undefined}>Password</Label>
        <Input
          name="password"
          type="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </label>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-center text-sm text-text-3">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/signup" className="font-medium text-accent hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
