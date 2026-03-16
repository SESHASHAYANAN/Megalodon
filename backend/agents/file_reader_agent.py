"""FileReaderAgent — lists all files and returns structured file map."""

import json
from typing import AsyncGenerator
from repo_context import RepoContext
import mimetypes

class FileReaderAgent:
    """Reads all files in the repo and returns a structured file summary."""

    async def run(self, ctx: RepoContext, task: str) -> AsyncGenerator[dict, None]:
        yield {"type": "thinking", "content": f"📂 FileReaderAgent: scanning {ctx.project_root}"}

        if not ctx.file_map:
            yield {"type": "error", "content": "No files found in project."}
            return

        yield {
            "type": "repo_scan",
            "content": f"Found {ctx.total_files} total files, read {ctx.read_files} source files.",
        }

        # Summarize each file
        file_summaries = []
        for rel_path, content in sorted(ctx.file_map.items()):
            size = len(content)
            lines = content.count("\n") + 1 if not content.startswith("[") else 0
            file_type, _ = mimetypes.guess_type(rel_path)
            file_summaries.append(f"- `{rel_path}` ({size} chars, ~{lines} lines, {file_type})")

        summary_text = "\n".join(file_summaries)

        yield {
            "type": "code",
            "content": (
                f"## 📁 Project File Map: `{ctx.project_root}`\n\n"
                f"**Total files scanned**: {ctx.total_files}  \n"
                f"**Source files read**: {ctx.read_files}\n\n"
                f"### Files\n{summary_text}\n\n"
                f"### File Tree\n