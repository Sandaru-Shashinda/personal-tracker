import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db, documents } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/** View (inline) or download (?download=1) a document. Only its owner can read it. */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/documents/[id]">) {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [doc] = await db
    .select({ fileName: documents.fileName, mimeType: documents.mimeType, content: documents.content })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, session.sub)))
    .limit(1);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bytes = Buffer.from(doc.content, "base64");
  const download = req.nextUrl.searchParams.get("download") === "1";
  // Only PDFs and images are shown in the browser; everything else is downloaded.
  const inlineSafe = doc.mimeType === "application/pdf" || (doc.mimeType.startsWith("image/") && doc.mimeType !== "image/svg+xml");
  const disposition = download || !inlineSafe ? "attachment" : "inline";
  const asciiName = doc.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
