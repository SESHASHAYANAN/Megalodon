"""AgentRouter — receives task + RepoContext, routes to the correct specialist agent.

Uses keyword-based classification to determine which agent to invoke.
All agents use the 3-stage Gemini → OpenRouter → Groq pipeline internally.
"""

import re
from typing import AsyncGenerator
from repo_context import RepoContext
from pipeline.orchestrator import normalize_task_type


# ── Routing keyword maps ──────────────────────────────────────────────────────

DEBUG_KEYWORDS = {
    "debug", "error", "fix", "bug", "crash", "exception", "traceback",
    "broken", "failing", "fails", "failed", "not working", "issue",
    "problem", "wrong", "incorrect", "undefined", "null", "attributeerror",
    "typeerror", "syntaxerror", "importerror", "modulenotfounderror",
}

EXPLAIN_KEYWORDS = {
    "explain", "describe", "how does", "what is", "what does", "understand",
    "overview", "architecture", "how do", "walkthrough", "summarize",
    "summary", "tell me about", "what are", "help me understand",
}

SECURITY_KEYWORDS = {
    "security", "secure", "vulnerability", "vulnerabilities", "audit",
    "scan", "check for", "exposed", "secrets", "api key", "password",
    "injection", "xss", "cors", "auth", "authentication", "authorization",
}

LIST_KEYWORDS = {
    "list files", "list all", "show files", "show all files", "what files",
    "file tree", "project structure", "directory", "ls",
}

REFACTOR_KEYWORDS = {
    "refactor", "clean up", "improve", "restructure", "reorganize",
    "optimize", "simplify", "extract", "rename", "move",
}


def _classify_task(task: str) -> str:
    """Rule-based classifier. Returns: 'debug', 'explain', 'security', 'list', 'refactor', or 'code'."""
    t = task.lower()

    # Check list keywords first (exact phrases)
    for kw in LIST_KEYWORDS:
        if kw in t:
            return "list"

    # Score each category
    def score(keywords):
        return sum(1 for kw in keywords if kw in t)

    scores = {
        "debug": score(DEBUG_KEYWORDS),
        "explain": score(EXPLAIN_KEYWORDS),
        "security": score(SECURITY_KEYWORDS),
        "refactor": score(REFACTOR_KEYWORDS),
    }

    best = max(scores, key=scores.get)
    if scores[best] > 0:
        return best

    return "code"  # Default: CodeWriterAgent for feature/code tasks


class AgentRouter:
    """Routes a task to the correct specialist agent."""

    def __init__(self, ctx: RepoContext):
        self.ctx = ctx

    async def route(self, task: str) -> AsyncGenerator[dict, None]:
        agent_type = _classify_task(task)

        yield {
            "type": "thinking",
            "content": f"🧭 AgentRouter: routing to {agent_type.upper()} agent...",
        }

        if agent_type == "list":
            from agents.file_reader_agent import FileReaderAgent
            agent = FileReaderAgent()
        elif agent_type == "debug":
            from agents.debug_agent import DebugAgent
            agent = DebugAgent()
        elif agent_type == "explain":
            from agents.explain_agent import ExplainAgent
            agent = ExplainAgent()
        elif agent_type == "security":
            from agents.security_agent import SecurityAgent
            agent = SecurityAgent()
        elif agent_type == "refactor":
            from agents.code_writer_agent import CodeWriterAgent
            agent = CodeWriterAgent()
        else:
            from agents.code_writer_agent import CodeWriterAgent
            agent = CodeWriterAgent()

        yield {
            "type": "agent_selected",
            "content": f"Selected: {agent.__class__.__name__}",
            "agent": agent.__class__.__name__,
        }

        async for event in agent.run(self.ctx, task):
            yield event
