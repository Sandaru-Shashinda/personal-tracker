import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db, documents } from "@/lib/db";
import { ALLOWED_DOCUMENT_TYPES, DOCUMENT_CATEGORIES, MAX_DOCUMENT_BYTES } from "@/lib/personal";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/** Upload a document (multipart form: file, name, category, expiryDate?, notes?). */
export async function POST(req: NextRequest) {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file" }, { status: 400 });
  if (file.size > MAX_DOCUMENT_BYTES) return NextResponse.json({ error: "File is larger than 4 MB" }, { status: 413 });
  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_DOCUMENT_TYPES.includes(mimeType)) {
    return NextResponse.json({ error: "Use a PDF, image, Word, Excel or text file" }, { status: 415 });
  }

  const name = String(form.get("name") ?? "").trim().slice(0, 120) || file.name.replace(/\.[^.]+$/, "").slice(0, 120);
  const category = String(form.get("category") ?? "Other");
  const expiry = String(form.get("expiryDate") ?? "");
  const notes = String(form.get("notes") ?? "").trim().slice(0, 1000);

  const [row] = await db
    .insert(documents)
    .values({
      userId: session.sub,
      name,
      category: DOCUMENT_CATEGORIES.includes(category) ? category : "Other",
      fileName: file.name.slice(0, 200),
      mimeType,
      size: file.size,
      content: Buffer.from(await file.arrayBuffer()).toString("base64"),
      expiryDate: /^\d{4}-\d{2}-\d{2}$/.test(expiry) ? expiry : null,
      notes: notes || null,
    })
    .returning({ id: documents.id });

  revalidatePath("/personal");
  return NextResponse.json({ ok: true, id: row.id });
}
