import { getExerciseList } from "@/lib/gym/exercises";

/**
 * The bundled exercise library (~140 KB). Served on its own so the browser caches it once,
 * instead of it riding along in every /gym render and every server-action refresh.
 */
export async function GET() {
  return Response.json(getExerciseList(), {
    headers: { "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800" },
  });
}
