"""cache.py — SQLite-backed cache for Gemini file summaries.

Cache key: SHA-256(file_content) + model_name
Avoids re-sending unchanged files to the LLM between runs.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Dict, Optional

from config import CACHE_DB_PATH, CACHE_ENABLED

logger = logging.getLogger(__name__)

_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS file_summaries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key   TEXT    UNIQUE NOT NULL,
    rel_path    TEXT    NOT NULL,
    model       TEXT    NOT NULL,
    summary_json TEXT   NOT NULL,
    created_at  REAL    NOT NULL,
    hit_count   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cache_key ON file_summaries (cache_key);
"""


@contextmanager
def _get_conn(db_path: str):
    """Context manager for an SQLite connection."""
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


class SummaryCache:
    """SQLite-backed cache for file summaries produced by Stage 1 (Gemini)."""

    def __init__(self, db_path: Optional[str] = None, enabled: Optional[bool] = None):
        self.db_path = db_path or CACHE_DB_PATH
        self.enabled = enabled if enabled is not None else CACHE_ENABLED
        self._initialized = False

        if self.enabled:
            self._init_db()

    def _init_db(self) -> None:
        """Create the cache database and tables if they don't exist."""
        try:
            Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
            with _get_conn(self.db_path) as conn:
                conn.executescript(_CREATE_TABLE_SQL)
            self._initialized = True
            logger.debug(f"Cache initialized at {self.db_path}")
        except sqlite3.Error as e:
            logger.warning(f"Failed to initialize cache DB: {e}. Cache disabled.")
            self.enabled = False

    def _make_key(self, checksum: str, model: str) -> str:
        """Build a cache key from file checksum + model name."""
        return f"{checksum}:{model}"

    def get(self, checksum: str, model: str) -> Optional[dict]:
        """Retrieve cached summary or None if not found."""
        if not self.enabled:
            return None

        key = self._make_key(checksum, model)
        try:
            with _get_conn(self.db_path) as conn:
                row = conn.execute(
                    "SELECT summary_json FROM file_summaries WHERE cache_key = ?",
                    (key,),
                ).fetchone()

                if row:
                    # Update hit count
                    conn.execute(
                        "UPDATE file_summaries SET hit_count = hit_count + 1 WHERE cache_key = ?",
                        (key,),
                    )
                    return json.loads(row["summary_json"])
        except (sqlite3.Error, json.JSONDecodeError) as e:
            logger.warning(f"Cache get error: {e}")

        return None

    def set(self, checksum: str, model: str, rel_path: str, summary: dict) -> None:
        """Store a file summary in the cache."""
        if not self.enabled:
            return

        key = self._make_key(checksum, model)
        try:
            with _get_conn(self.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO file_summaries
                        (cache_key, rel_path, model, summary_json, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(cache_key) DO UPDATE SET
                        summary_json = excluded.summary_json,
                        created_at   = excluded.created_at,
                        hit_count    = 0
                    """,
                    (key, rel_path, model, json.dumps(summary), time.time()),
                )
        except sqlite3.Error as e:
            logger.warning(f"Cache set error for {rel_path}: {e}")

    def get_many(
        self, checksums: Dict[str, str], model: str
    ) -> Dict[str, Optional[dict]]:
        """Batch fetch: {rel_path → summary_or_None}.

        Args:
            checksums: {rel_path → checksum}
            model: model name used for cache keying
        Returns:
            {rel_path → summary dict or None if cache miss}
        """
        if not self.enabled:
            return {rel_path: None for rel_path in checksums}

        results: Dict[str, Optional[dict]] = {}
        try:
            with _get_conn(self.db_path) as conn:
                for rel_path, checksum in checksums.items():
                    key = self._make_key(checksum, model)
                    row = conn.execute(
                        "SELECT summary_json FROM file_summaries WHERE cache_key = ?",
                        (key,),
                    ).fetchone()
                    if row:
                        try:
                            results[rel_path] = json.loads(row["summary_json"])
                            conn.execute(
                                "UPDATE file_summaries SET hit_count = hit_count + 1 WHERE cache_key = ?",
                                (key,),
                            )
                        except json.JSONDecodeError:
                            results[rel_path] = None
                    else:
                        results[rel_path] = None
        except sqlite3.Error as e:
            logger.warning(f"Cache batch get error: {e}")
            return {rel_path: None for rel_path in checksums}

        return results

    def stats(self) -> Dict[str, int]:
        """Return cache statistics."""
        if not self.enabled or not self._initialized:
            return {"enabled": 0, "total_entries": 0, "total_hits": 0}

        try:
            with _get_conn(self.db_path) as conn:
                row = conn.execute(
                    "SELECT COUNT(*) as n, COALESCE(SUM(hit_count), 0) as hits FROM file_summaries"
                ).fetchone()
                return {
                    "enabled": 1,
                    "total_entries": row["n"],
                    "total_hits": row["hits"],
                    "db_path": self.db_path,
                }
        except sqlite3.Error:
            return {"enabled": 1, "total_entries": -1, "total_hits": -1}

    def clear(self) -> None:
        """Clear all cached entries. Used for --no-cache flag."""
        if not self.enabled:
            return
        try:
            with _get_conn(self.db_path) as conn:
                conn.execute("DELETE FROM file_summaries")
            logger.info("Cache cleared.")
        except sqlite3.Error as e:
            logger.warning(f"Cache clear error: {e}")


# ── Module-level singleton ────────────────────────────────────────────────────

_default_cache: Optional[SummaryCache] = None


def get_cache(no_cache: bool = False) -> SummaryCache:
    """Return the module-level SummaryCache singleton."""
    global _default_cache
    if _default_cache is None:
        _default_cache = SummaryCache(enabled=not no_cache)
    return _default_cache
