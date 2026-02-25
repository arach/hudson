CREATE TABLE `signups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`use_case` text,
	`context` text,
	`ip` text,
	`created_at` text NOT NULL
);
