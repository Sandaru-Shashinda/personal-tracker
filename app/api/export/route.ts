import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  budgets,
  categories,
  db,
  documents,
  expenses,
  goalMilestones,
  goals,
  reminders,
  habitLogs,
  habits,
  journalEntries,
  notes,
  personalProfiles,
  tasks,
  todoItems,
  todoLists,
  users,
  workoutSets,
} from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

type Row = Record<string, unknown>;

function toCsv(rows: Row[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join("|") : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\r\n");
}

export async function GET(req: NextRequest) {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.sub;
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const type = req.nextUrl.searchParams.get("type") ?? "habit_logs";

  const [user] = await db
    .select({ name: users.name, email: users.email, timezone: users.timezone, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId));
  const [cats, hs, logs, ts, journal] = await Promise.all([
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(habits).where(eq(habits.userId, userId)),
    db.select().from(habitLogs).where(eq(habitLogs.userId, userId)),
    db.select().from(tasks).where(eq(tasks.userId, userId)),
    db.select().from(journalEntries).where(eq(journalEntries.userId, userId)),
  ]);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const habitTitle = new Map(hs.map((h) => [h.id, h.title]));
    const catName = new Map(cats.map((c) => [c.id, c.name]));
    const strip = <T extends Row>(r: T) => {
      const { userId: _u, ...rest } = r as Row;
      void _u;
      return rest;
    };
    const datasets: Record<string, Row[]> = {
      habit_logs: logs
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((l) => ({ date: l.date, habit: habitTitle.get(l.habitId) ?? l.habitId, value: l.value, note: l.note })),
      habits: hs.map((h) => ({ ...strip(h), category: h.categoryId ? catName.get(h.categoryId) : null })),
      tasks: ts.map((t) => ({ ...strip(t), category: t.categoryId ? catName.get(t.categoryId) : null })),
      journal: journal
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((j) => ({ date: j.date, mood: j.mood, energy: j.energy, tags: j.tags, content: j.content })),
    };
    const rows = datasets[type];
    if (!rows) return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tracker-${type}-${stamp}.csv"`,
      },
    });
  }

  const [sets, noteRows, lists, items, money, budgetRows, goalRows, milestones, profile, docs, reminderRows] = await Promise.all([
    db.select().from(workoutSets).where(eq(workoutSets.userId, userId)),
    db.select().from(notes).where(eq(notes.userId, userId)),
    db.select().from(todoLists).where(eq(todoLists.userId, userId)),
    db.select().from(todoItems).where(eq(todoItems.userId, userId)),
    db.select().from(expenses).where(eq(expenses.userId, userId)),
    db.select().from(budgets).where(eq(budgets.userId, userId)),
    db.select().from(goals).where(eq(goals.userId, userId)),
    db.select().from(goalMilestones).where(eq(goalMilestones.userId, userId)),
    db.select().from(personalProfiles).where(eq(personalProfiles.userId, userId)),
    // File contents are not exported (download them from the Personal page); metadata is.
    db
      .select({
        id: documents.id,
        name: documents.name,
        category: documents.category,
        fileName: documents.fileName,
        mimeType: documents.mimeType,
        size: documents.size,
        expiryDate: documents.expiryDate,
        notes: documents.notes,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.userId, userId)),
    db.select().from(reminders).where(eq(reminders.userId, userId)),
  ]);

  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      user,
      categories: cats,
      habits: hs,
      habitLogs: logs,
      tasks: ts,
      journal,
      workoutSets: sets,
      notes: noteRows,
      todoLists: lists,
      todoItems: items,
      expenses: money,
      budgets: budgetRows,
      goals: goalRows,
      goalMilestones: milestones,
      personal: profile[0]?.data ?? null,
      documents: docs,
      reminders: reminderRows,
    },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="tracker-export-${stamp}.json"`,
    },
  });
}
