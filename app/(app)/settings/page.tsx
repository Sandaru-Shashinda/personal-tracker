import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getCategories } from "@/lib/queries";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const categories = await getCategories(user.id);
  return (
    <SettingsView
      user={{ name: user.name, email: user.email, timezone: user.timezone, weekStartsOn: user.weekStartsOn }}
      categories={categories}
      vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
    />
  );
}
