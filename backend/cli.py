"""cli.py — Command-line interface for the GitAI coding agent.

Usage:
  coding-agent --repo PATH --task explain --query "Explain this repo"
  coding-agent --repo PATH --task bug --query "Why does X crash?"
  coding-agent --repo PATH --task feature --query "Add authentication"
  coding-agent --repo PATH --task refactor --query "Improve the LLM pipeline"
  coding-agent --repo PATH --task security --query "Audit for vulnerabilities"
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Optional

import click

try:
    from rich.console import Console
    from rich.markdown import Markdown
    from rich.panel import Panel
    from rich.progress import Progress, SpinnerColumn, TextColumn
    from rich.syntax import Syntax
    _HAS_RICH = True
except ImportError:
    _HAS_RICH = False


def _print(msg: str, color: str = ""):
    """Print with color if rich is unavailable."""
    if _HAS_RICH:
        console.print(msg)
    else:
        print(msg)


if _HAS_RICH:
    console = Console()


def _handle_event(event: dict, verbose: bool = False) -> Optional[str]:
    """Handle a single pipeline event. Return streamed text or None."""
    etype = event.get("type", "")
    content = event.get("content", "")

    if etype == "stream":
        # Live streaming text — print without newline
        if _HAS_RICH:
            console.print(content, end="", highlight=False)
        else:
            print(content, end="", flush=True)
        return content

    elif etype in ("thinking", "repo_scan", "dep_map"):
        if _HAS_RICH:
            console.print(f"[dim cyan]{content}[/dim cyan]")
        else:
            print(f"  {content}")

    elif etype in ("stage1_start", "stage2_start", "stage3_start"):
        if _HAS_RICH:
            console.print(f"\n[bold blue]⟶ {content}[/bold blue]")
        else:
            print(f"\n>> {content}")

    elif etype == "stage1_progress":
        if verbose:
            cached = " [cached]" if event.get("cached") else ""
            if _HAS_RICH:
                console.print(f"[dim]  {content}{cached}[/dim]")
            else:
                print(f"  {content}{cached}")

    elif etype in ("stage1_cache",):
        if _HAS_RICH:
            console.print(f"[green]{content}[/green]")
        else:
            print(content)

    elif etype in ("stage1_complete", "stage2_complete", "stage3_complete"):
        if _HAS_RICH:
            console.print(f"[green]✓ {content}[/green]")
        else:
            print(f"✓ {content}")

    elif etype == "stage2_selecting":
        files = event.get("relevant_files", [])
        if _HAS_RICH:
            console.print(f"[yellow]  {content}[/yellow]")
            if verbose and files:
                for f in files[:10]:
                    console.print(f"[dim]    • {f}[/dim]")
        else:
            print(f"  {content}")

    elif etype == "files_written":
        files = event.get("files", [])
        if _HAS_RICH:
            console.print(f"\n[bold green]💾 {content}[/bold green]")
        else:
            print(f"\n{content}")

    elif etype in ("stage2_fallback", "stage3_fallback"):
        if _HAS_RICH:
            console.print(f"[bold yellow]⚠ {content}[/bold yellow]")
        else:
            print(f"WARNING: {content}")

    elif etype == "error":
        if _HAS_RICH:
            console.print(f"[bold red]❌ {content}[/bold red]")
        else:
            print(f"ERROR: {content}", file=sys.stderr)

    elif etype == "done":
        if _HAS_RICH:
            console.print(f"\n[bold green]✅ {content}[/bold green]")
        else:
            print(f"\n✅ {content}")

    elif etype == "agent_selected":
        if _HAS_RICH:
            console.print(f"[bold magenta]🤖 {content}[/bold magenta]")
        else:
            print(f"  Agent: {content}")

    return None


async def _run_agent(
    repo: str,
    task: str,
    query: str,
    no_cache: bool,
    verbose: bool,
):
    """Main async runner — scans repo, builds graph, runs agent pipeline."""
    # Add backend dir to sys.path
    backend_dir = Path(__file__).parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    from repo_scanner import scan_repo
    from graph_builder import build_graph
    from agents.router import AgentRouter

    if _HAS_RICH:
        console.print(
            f"\n[bold]GitAI Coding Agent[/bold] | "
            f"Repo: [cyan]{repo}[/cyan] | "
            f"Task: [magenta]{task}[/magenta]\n"
        )
    else:
        print(f"\nGitAI Coding Agent | Repo: {repo} | Task: {task}\n")

    # Scan repo
    if _HAS_RICH:
        console.print("[dim]Scanning repository...[/dim]")
    else:
        print("Scanning repository...")

    try:
        ctx = scan_repo(repo)
        ctx = build_graph(ctx)
    except (FileNotFoundError, NotADirectoryError) as e:
        if _HAS_RICH:
            console.print(f"[bold red]Error: {e}[/bold red]")
        else:
            print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if _HAS_RICH:
        console.print(
            f"[green]✓ Scanned {ctx.total_files} files, "
            f"reading {ctx.read_files} source files "
            f"({ctx.total_chars:,} chars)[/green]\n"
        )
    else:
        print(f"✓ Scanned: {ctx.read_files}/{ctx.total_files} files")

    # Route and run
    router = AgentRouter(ctx)
    full_response = ""

    # Set no_cache on ctx for pipeline
    async for event in router.route(query):
        text = _handle_event(event, verbose=verbose)
        if text:
            full_response += text

    if _HAS_RICH and full_response:
        console.print()


@click.command()
@click.option(
    "--repo",
    required=True,
    type=click.Path(exists=True, file_okay=False, resolve_path=True),
    help="Path to the repository to analyze.",
)
@click.option(
    "--task",
    default="explain",
    type=click.Choice(
        ["explain", "bug", "feature", "refactor", "security", "list"],
        case_sensitive=False,
    ),
    show_default=True,
    help="Task type for the agent.",
)
@click.option("--query", "-q", required=True, help="Your question or task description.")
@click.option(
    "--no-cache",
    is_flag=True,
    default=False,
    help="Bypass file summary cache (force re-read all files via Gemini).",
)
@click.option(
    "--verbose",
    "-v",
    is_flag=True,
    default=False,
    help="Show per-file progress during Stage 1.",
)
def main(repo: str, task: str, query: str, no_cache: bool, verbose: bool):
    """GitAI Coding Agent — analyze real repositories using Gemini→OpenRouter→Groq."""
    # Add backend dir to path
    backend_dir = Path(__file__).parent
    sys.path.insert(0, str(backend_dir))

    asyncio.run(_run_agent(repo, task, query, no_cache, verbose))


if __name__ == "__main__":
    main()
