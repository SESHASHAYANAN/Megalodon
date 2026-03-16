"""config.py — Typed configuration loader from .env file.

All secrets must be provided as environment variables. Never hardcoded.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory
_env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_env_path)


def _require(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise EnvironmentError(
            f"Missing required environment variable: {key}. "
            f"Please set it in backend/.env or export it in your shell."
        )
    return val


def _optional(key: str, default: str = "") -> str:
    return os.getenv(key, default)


# ── API Keys ─────────────────────────────────────────────────────────────────

OPENROUTER_API_KEY: str = _require("OPENROUTER_API_KEY")
GROQ_API_KEY: str = _require("GROQ_API_KEY")
GEMINI_API_KEY: str = _require("GEMINI_API_KEY")

# GitHub (optional, for web UI GitHub OAuth)
GITHUB_CLIENT_ID: str = _optional("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET: str = _optional("GITHUB_CLIENT_SECRET")

# Krea AI (optional, for image generation in App Creator)
KREA_API_KEY: str = _optional("KREA_API_KEY")

# json2video (optional, for video visualization)
JSON2VIDEO_API_KEY: str = _optional("JSON2VIDEO_API_KEY")


# ── Model Names ───────────────────────────────────────────────────────────────

# Stage 1: Gemini via OpenRouter — large context for file reading & summarization
GEMINI_MODEL: str = _optional(
    "GEMINI_MODEL", "google/gemini-2.0-flash-001"
)

# Stage 2: OpenRouter non-Gemini model — cross-file reasoning & analysis
OPENROUTER_MODEL: str = _optional(
    "OPENROUTER_MODEL", "deepseek/deepseek-r1"
)

# Stage 3: Groq — fast final answer synthesis
GROQ_MODEL: str = _optional(
    "GROQ_MODEL", "llama-3.3-70b-versatile"
)


# ── OpenRouter Base URL ───────────────────────────────────────────────────────

OPENROUTER_BASE_URL: str = _optional(
    "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
)

GROQ_BASE_URL: str = _optional(
    "GROQ_BASE_URL", "https://api.groq.com/openai/v1"
)


# ── Generation Parameters per Stage ──────────────────────────────────────────

# Stage 1 — Gemini structured reading: deterministic, compact JSON
STAGE1_TEMPERATURE: float = float(_optional("STAGE1_TEMPERATURE", "0.1"))
STAGE1_MAX_TOKENS: int = int(_optional("STAGE1_MAX_TOKENS", "4096"))

# Stage 2 — OpenRouter reasoning: slightly more creative for analysis
STAGE2_TEMPERATURE: float = float(_optional("STAGE2_TEMPERATURE", "0.2"))
STAGE2_MAX_TOKENS: int = int(_optional("STAGE2_MAX_TOKENS", "8192"))

# Stage 3 — Groq final answer: balanced for code quality
STAGE3_TEMPERATURE: float = float(_optional("STAGE3_TEMPERATURE", "0.25"))
STAGE3_MAX_TOKENS: int = int(_optional("STAGE3_MAX_TOKENS", "8192"))


# ── Repository Scanner Settings ───────────────────────────────────────────────

# Max file size in bytes to include in context (default: 500KB)
MAX_FILE_SIZE_BYTES: int = int(_optional("MAX_FILE_SIZE_BYTES", str(500 * 1024)))

# Max total context chars to send to LLM per batch
MAX_CONTEXT_CHARS: int = int(_optional("MAX_CONTEXT_CHARS", str(800_000)))

# Max chars per file in context (truncated with notice if exceeded)
MAX_FILE_CHARS: int = int(_optional("MAX_FILE_CHARS", str(15_000)))


# ── Cache Settings ────────────────────────────────────────────────────────────

CACHE_DB_PATH: str = _optional(
    "CACHE_DB_PATH",
    str(Path.home() / ".coding_agent_cache.db"),
)

CACHE_ENABLED: bool = _optional("CACHE_ENABLED", "true").lower() != "false"


# ── Source File Extensions ────────────────────────────────────────────────────

SOURCE_EXTENSIONS: frozenset = frozenset({
    # Python
    ".py", ".pyi",
    # JavaScript / TypeScript
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    # Web
    ".html", ".css", ".scss", ".less",
    # Config / Data
    ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg",
    # Docs
    ".md", ".mdx", ".rst", ".txt",
    # Backend / Other languages
    ".go", ".rs", ".java", ".kt", ".swift", ".c", ".cpp", ".h", ".hpp",
    ".rb", ".php", ".sh", ".bash", ".zsh", ".fish",
    # IaC
    ".tf", ".hcl", ".dockerfile", "dockerfile",
    # SQL
    ".sql",
    # GraphQL
    ".graphql", ".gql",
})


# ── Sensitive File Patterns (always excluded from LLM context) ────────────────

SENSITIVE_PATTERNS: list = [
    ".env", ".env.*", "*.key", "*.pem", "*.p12", "*.pfx",
    "id_rsa", "id_rsa.pub", "id_ed25519", "id_ed25519.pub",
    "*.secret", "secrets.yaml", "secrets.yml",
    ".htpasswd", "credentials.json", "token.json",
]
