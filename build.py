"""Build index.html from template.html.

Each {{snippet <path> <first> <last> <lang>}} marker is replaced by those lines
of the source repository, copied verbatim, with a link to the same lines on
GitHub. The page never holds a hand-edited copy of the code.

    python build.py ../aether-smart-badge
"""
import html
import re
import sys
import textwrap
from pathlib import Path

REPO_URL = "https://github.com/ShauryaAttreya37/aether-smart-badge/blob/main"
MARKER = re.compile(r"\{\{snippet (\S+) (\d+) (\d+) (\w+)\}\}")


def render(match: re.Match, source: Path) -> str:
    path, first, last, lang = match[1], int(match[2]), int(match[3]), match[4]
    lines = (source / path).read_text(encoding="utf-8").splitlines()
    if last > len(lines):
        raise SystemExit(f"{path} has {len(lines)} lines, snippet asks for {last}")
    code = html.escape(textwrap.dedent("\n".join(lines[first - 1:last])))
    link = f"{REPO_URL}/{path}#L{first}-L{last}"
    return (
        f'<div class="code">\n'
        f'  <div class="code-head"><code>{path}</code>'
        f'<a href="{link}">lines {first}–{last} on GitHub</a></div>\n'
        f'  <pre><code class="language-{lang}">{code}</code></pre>\n'
        f'</div>'
    )


def main() -> None:
    source = Path(sys.argv[1] if len(sys.argv) > 1 else "../aether-smart-badge")
    here = Path(__file__).parent
    template = (here / "template.html").read_text(encoding="utf-8")
    page = MARKER.sub(lambda m: render(m, source), template)
    (here / "index.html").write_text(page, encoding="utf-8")
    print(f"wrote index.html with {len(MARKER.findall(template))} snippets")


if __name__ == "__main__":
    main()
