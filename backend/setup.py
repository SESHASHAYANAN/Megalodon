"""setup.py — pip-installable package for the GitAI coding agent.

Install with: pip install -e .
Exposes CLI command: coding-agent
"""

from setuptools import setup, find_packages

setup(
    name="gitai-coding-agent",
    version="1.0.0",
    description="Production-grade coding agent: Gemini → OpenRouter → Groq pipeline",
    author="GitAI",
    python_requires=">=3.9",
    packages=find_packages(exclude=["sandbox_venv", "tests", "__pycache__"]),
    py_modules=[
        "cli", "config", "repo_context", "repo_scanner",
        "graph_builder", "chunker", "cache", "llm", "app",
    ],
    install_requires=[
        "fastapi>=0.110.0",
        "uvicorn[standard]>=0.27.0",
        "httpx>=0.27.0",
        "python-dotenv>=1.0.0",
        "jinja2>=3.1.0",
        "aiofiles>=23.2.0",
        "click>=8.1.0",
        "rich>=13.7.0",
        "pathspec>=0.12.0",
        "pydantic>=2.0.0",
    ],
    entry_points={
        "console_scripts": [
            "coding-agent=cli:main",
        ],
    },
    package_data={
        "": ["prompts/*.jinja", ".env.example"],
    },
)
