-- Run this once against the existing Cloudflare D1 database: iris-digital-db
CREATE TABLE IF NOT EXISTS design_requests (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  product_type TEXT NOT NULL,
  budget TEXT NOT NULL DEFAULT 'Chưa xác định',
  deadline TEXT,
  brief TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewing', 'awaiting_quote', 'in_progress', 'completed', 'rejected')),
  internal_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_design_requests_created_at
  ON design_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_design_requests_status
  ON design_requests(status);
