-- Phase 18 (fix): stale failed resume uploads must be retryable.
--
-- One stored copy of each distinct document per student. Previously this pair
-- was only an index, so a failed parse followed by a re-upload could fork the
-- document's identity across two rows. The upload path now reuses and updates
-- the row for the same (user, content hash) — including when an earlier parse
-- failed for a server-side reason that the current parser no longer has — and
-- this constraint makes that guarantee hold at the storage layer.
--
-- Safe to apply: any pre-existing duplicates are (user, hash) pairs created
-- through the pre-fix retry gap; the newest row per pair is kept.
DELETE FROM resume_files f
USING resume_files newer
WHERE f.user_id = newer.user_id
  AND f.content_hash = newer.content_hash
  AND f.created_at < newer.created_at;

DROP INDEX IF EXISTS "resume_files_user_hash_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "resume_files_user_hash_key"
  ON "resume_files" ("user_id", "content_hash");
