import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const researchRuns = sqliteTable("research_runs", {
  id: text("id").primaryKey(),
  cacheKey: text("cache_key").notNull().unique(),
  query: text("query").notNull(),
  resultJson: text("result_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
