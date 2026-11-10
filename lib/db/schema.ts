import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const habitTypeEnum = pgEnum("habit_type", ["check", "count"]);
export const frequencyEnum = pgEnum("habit_frequency", [
  "daily",
  "days", // specific days of week
  "weekly", // X times per week, any day
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  weekStartsOn: integer("week_starts_on").notNull().default(1), // 0 = Sunday, 1 = Monday
  currency: text("currency").notNull().default("LKR"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#6366f1"),
    icon: text("icon").notNull().default("folder"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("categories_user_idx").on(t.userId)],
);

export const habits = pgTable(
  "habits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    color: text("color").notNull().default("#10b981"),
    icon: text("icon").notNull().default("check"),
    type: habitTypeEnum("type").notNull().default("check"),
    target: real("target").notNull().default(1),
    unit: text("unit"),
    frequency: frequencyEnum("frequency").notNull().default("daily"),
    daysOfWeek: integer("days_of_week")
      .array()
      .notNull()
      .default(sql`'{0,1,2,3,4,5,6}'::integer[]`),
    timesPerWeek: integer("times_per_week").notNull().default(3),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    reminderTime: text("reminder_time"), // "HH:MM" in the user's timezone
    lastRemindedOn: date("last_reminded_on"),
    startDate: date("start_date").notNull(),
    archived: boolean("archived").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("habits_user_idx").on(t.userId)],
);

export const habitLogs = pgTable(
  "habit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    value: real("value").notNull().default(1),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("habit_logs_habit_date_uq").on(t.habitId, t.date),
    index("habit_logs_user_date_idx").on(t.userId, t.date),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    parentId: uuid("parent_id"),
    title: text("title").notNull(),
    notes: text("notes"),
    priority: integer("priority").notNull().default(0), // 0 none, 1 low, 2 medium, 3 high
    dueDate: date("due_date"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    reminderAt: timestamp("reminder_at", { withTimezone: true }),
    reminderSent: boolean("reminder_sent").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tasks_user_idx").on(t.userId), index("tasks_parent_idx").on(t.parentId)],
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    mood: integer("mood"), // 1-5
    energy: integer("energy"), // 1-5
    content: text("content").notNull().default(""),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("journal_user_date_uq").on(t.userId, t.date)],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_user_idx").on(t.userId)],
);

const userRef = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// --- Gym ---------------------------------------------------------------------------------------
/** One logged set. Exercises come from the bundled exercise library (lib/gym), keyed by its id. */
export const workoutSets = pgTable(
  "workout_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    date: date("date").notNull(),
    exerciseId: text("exercise_id").notNull(),
    exerciseName: text("exercise_name").notNull(),
    reps: integer("reps"),
    weight: real("weight"), // kg
    durationSec: integer("duration_sec"),
    createdAt: createdAt(),
  },
  (t) => [index("workout_sets_user_date_idx").on(t.userId, t.date), index("workout_sets_user_ex_idx").on(t.userId, t.exerciseId)],
);

/**
 * The user's chosen exercises, shown as a daily checklist. Ticking one logs `sets` rows of
 * `reps × weight` into workout_sets, so "done on a day" = that exercise has sets on that date.
 */
export const gymPlan = pgTable(
  "gym_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    exerciseId: text("exercise_id").notNull(),
    exerciseName: text("exercise_name").notNull(),
    sets: integer("sets").notNull().default(3),
    reps: integer("reps"),
    weight: real("weight"), // kg; null = bodyweight
    durationSec: integer("duration_sec"), // for timed exercises (cardio, stretching)
    daysOfWeek: integer("days_of_week")
      .array()
      .notNull()
      .default(sql`'{0,1,2,3,4,5,6}'::integer[]`),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("gym_plan_user_idx").on(t.userId), uniqueIndex("gym_plan_user_ex_uq").on(t.userId, t.exerciseId)],
);

// --- Personal info & documents ------------------------------------------------------------------
export const personalProfiles = pgTable("personal_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    name: text("name").notNull(),
    category: text("category").notNull().default("Other"),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    content: text("content").notNull(), // base64 file contents
    expiryDate: date("expiry_date"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("documents_user_idx").on(t.userId)],
);

// --- Notes -------------------------------------------------------------------------------------
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    title: text("title").notNull().default(""),
    content: text("content").notNull().default(""),
    color: text("color"),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notes_user_idx").on(t.userId)],
);

// --- To-do lists -------------------------------------------------------------------------------
export const todoLists = pgTable(
  "todo_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#2a78d6"),
    createdAt: createdAt(),
  },
  (t) => [index("todo_lists_user_idx").on(t.userId)],
);

export const todoItems = pgTable(
  "todo_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    listId: uuid("list_id")
      .notNull()
      .references(() => todoLists.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    done: boolean("done").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("todo_items_list_idx").on(t.listId), index("todo_items_user_idx").on(t.userId)],
);

// --- Expenses ----------------------------------------------------------------------------------
const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });

/** Where money is kept (cash, bank, savings…). Balance = opening balance + linked activity. */
export const moneyAccounts = pgTable(
  "money_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    name: text("name").notNull(),
    type: text("type").notNull().default("bank"), // see ACCOUNT_TYPES in lib/expenses
    openingBalance: money("opening_balance").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("money_accounts_user_idx").on(t.userId)],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    kind: text("kind").notNull().default("expense"), // "expense" | "income"
    amount: money("amount").notNull(),
    category: text("category").notNull(),
    note: text("note"),
    method: text("method"), // cash, card, bank, other
    accountId: uuid("account_id").references(() => moneyAccounts.id, { onDelete: "set null" }),
    date: date("date").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("expenses_user_date_idx").on(t.userId, t.date)],
);

/** Money moved between two of the user's accounts (e.g. into savings). */
export const accountTransfers = pgTable(
  "account_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    fromAccountId: uuid("from_account_id").references(() => moneyAccounts.id, { onDelete: "set null" }),
    toAccountId: uuid("to_account_id").references(() => moneyAccounts.id, { onDelete: "set null" }),
    amount: money("amount").notNull(),
    date: date("date").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("account_transfers_user_idx").on(t.userId)],
);

/** A running balance with one person: money lent to them, or borrowed from them. */
export const debts = pgTable(
  "debts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    person: text("person").notNull(),
    direction: text("direction").notNull(), // "lent" (they owe me) | "borrowed" (I owe them)
    note: text("note"),
    dueDate: date("due_date"),
    createdAt: createdAt(),
  },
  (t) => [index("debts_user_idx").on(t.userId)],
);

/** "add" grows the debt (lend/borrow more), "repay" shrinks it. accountId = where the cash moved. */
export const debtEntries = pgTable(
  "debt_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    debtId: uuid("debt_id")
      .notNull()
      .references(() => debts.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // "add" | "repay"
    amount: money("amount").notNull(),
    date: date("date").notNull(),
    accountId: uuid("account_id").references(() => moneyAccounts.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("debt_entries_user_idx").on(t.userId), index("debt_entries_debt_idx").on(t.debtId)],
);

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    category: text("category").notNull(), // "" = overall monthly budget
    amount: money("amount").notNull(),
  },
  (t) => [uniqueIndex("budgets_user_category_uq").on(t.userId, t.category)],
);

// --- Goals -------------------------------------------------------------------------------------
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    title: text("title").notNull(),
    description: text("description"),
    area: text("area").notNull().default("Personal"),
    color: text("color").notNull().default("#2a78d6"),
    targetValue: real("target_value"),
    currentValue: real("current_value").notNull().default(0),
    unit: text("unit"),
    targetDate: date("target_date"),
    status: text("status").notNull().default("active"), // active | completed | archived
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("goals_user_idx").on(t.userId)],
);

export const goalMilestones = pgTable(
  "goal_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    done: boolean("done").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("goal_milestones_goal_idx").on(t.goalId)],
);

// --- Reminders (birthdays, events, meetings…) ---------------------------------------------------
export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    title: text("title").notNull(),
    kind: text("kind").notNull().default("event"), // birthday | anniversary | event | meeting | bill | other
    /** First (or only) occurrence. For birthdays this is the birth date, so ages can be shown. */
    date: date("date").notNull(),
    /** "HH:MM" local time, or null for an all-day reminder. */
    time: text("time"),
    repeat: text("repeat").notNull().default("none"), // none | daily | weekly | monthly | yearly
    location: text("location"),
    notes: text("notes"),
    /** Push alert this many minutes before the start (all-day items start at 09:00). Null = no alert. */
    alertMinutes: integer("alert_minutes"),
    /** The occurrence date (YYYY-MM-DD) the latest alert was sent for, so each occurrence alerts once. */
    lastAlertedFor: date("last_alerted_for"),
    createdAt: createdAt(),
  },
  (t) => [index("reminders_user_idx").on(t.userId)],
);

export const usersRelations = relations(users, ({ many }) => ({
  habits: many(habits),
  tasks: many(tasks),
  categories: many(categories),
}));

export const habitsRelations = relations(habits, ({ one, many }) => ({
  category: one(categories, { fields: [habits.categoryId], references: [categories.id] }),
  logs: many(habitLogs),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  category: one(categories, { fields: [tasks.categoryId], references: [categories.id] }),
}));

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type HabitLog = typeof habitLogs.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type WorkoutSet = typeof workoutSets.$inferSelect;
export type GymPlanItem = typeof gymPlan.$inferSelect;
export type DocumentMeta = Omit<typeof documents.$inferSelect, "content" | "userId">;
export type Note = typeof notes.$inferSelect;
export type TodoList = typeof todoLists.$inferSelect;
export type TodoItem = typeof todoItems.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type MoneyAccount = typeof moneyAccounts.$inferSelect;
export type AccountTransfer = typeof accountTransfers.$inferSelect;
export type Debt = typeof debts.$inferSelect;
export type DebtEntry = typeof debtEntries.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type GoalMilestone = typeof goalMilestones.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
