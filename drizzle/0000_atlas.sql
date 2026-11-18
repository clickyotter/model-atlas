CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE sources (id TEXT PRIMARY KEY, label TEXT NOT NULL, url TEXT NOT NULL UNIQUE, category TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, etag TEXT, modified TEXT, checked_at TEXT, success_at TEXT, attempts INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0, consecutive_failures INTEGER NOT NULL DEFAULT 0, error TEXT);
--> statement-breakpoint
CREATE TABLE source_snapshots (source_id TEXT NOT NULL, fetched_at TEXT NOT NULL, item_count INTEGER NOT NULL, status TEXT NOT NULL, PRIMARY KEY (source_id, fetched_at));
--> statement-breakpoint
CREATE TABLE news (url TEXT PRIMARY KEY, source_id TEXT NOT NULL, title TEXT NOT NULL, title_key TEXT NOT NULL, published_at TEXT NOT NULL, fetched_at TEXT NOT NULL, category TEXT NOT NULL, ai_score INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX news_published ON news(published_at DESC);
--> statement-breakpoint
CREATE TABLE graph_snapshots (window TEXT PRIMARY KEY, as_of TEXT NOT NULL, payload TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE offer_checks (id TEXT PRIMARY KEY, checked_at TEXT NOT NULL, verified_at TEXT, status TEXT NOT NULL, detail TEXT NOT NULL, fingerprint TEXT);
--> statement-breakpoint
CREATE TABLE offer_history (id TEXT NOT NULL, at TEXT NOT NULL, status TEXT NOT NULL, detail TEXT NOT NULL, fingerprint TEXT, PRIMARY KEY (id, at));
--> statement-breakpoint
CREATE TABLE submissions (id TEXT PRIMARY KEY, kind TEXT NOT NULL, user_id TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, detail TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE published_cases (slug TEXT PRIMARY KEY, payload TEXT NOT NULL, published_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE retests (id TEXT PRIMARY KEY, case_slug TEXT NOT NULL, model TEXT NOT NULL, version TEXT NOT NULL, parameters TEXT NOT NULL, outcome TEXT NOT NULL, score REAL, evidence TEXT NOT NULL, note TEXT NOT NULL, cost TEXT, tested_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE audit (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, created_at TEXT NOT NULL);
