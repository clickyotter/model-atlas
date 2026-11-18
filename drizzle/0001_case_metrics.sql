CREATE TABLE case_metrics (
  case_slug TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  actor TEXT NOT NULL,
  source TEXT NOT NULL,
  platform TEXT NOT NULL,
  likes INTEGER NOT NULL,
  comments INTEGER NOT NULL,
  shares INTEGER NOT NULL,
  bookmarks INTEGER NOT NULL,
  PRIMARY KEY(case_slug,captured_at)
);
