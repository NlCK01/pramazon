CREATE TABLE `research_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`cache_key` text NOT NULL,
	`query` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `research_runs_cache_key_unique` ON `research_runs` (`cache_key`);