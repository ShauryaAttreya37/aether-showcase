"""Build index.html from template.html.

Each {{snippet <path> <first> <last> <lang>}} marker is replaced by those lines
of the source repository, copied verbatim, with a link to the same lines on
GitHub. The page never holds a hand-edited copy of the code.

The interactive sections use the same rule. The app's dose, alert and config
modules are copied unchanged into app-js/, and the cached forecast is packed
into data/, so the demos on the page run the shipped logic on the shipped data.

    python build.py ../aether-smart-badge
"""
import html
import json
import math
import re
import shutil
import sys
import textwrap
from pathlib import Path

REPO_URL = "https://github.com/ShauryaAttreya37/aether-smart-badge/blob/main"
MARKER = re.compile(r"\{\{snippet (\S+) (\d+) (\d+) (\w+)\}\}")
APP_MODULES = ("config.mjs", "dose.mjs", "alerts.mjs")
FORECAST = "server/cache/latest_forecast.json"
FORECAST_META = ("valid_from", "horizon_hours", "grid", "model_kind", "data_mode", "warning")


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


def copy_app_modules(source: Path, here: Path) -> None:
    target = here / "app-js"
    target.mkdir(exist_ok=True)
    for name in APP_MODULES:
        shutil.copyfile(source / "app/js" / name, target / name)


def validate_forecast(forecast: dict) -> None:
    """Stop the build on any forecast the page could not draw."""
    missing = [key for key in (*FORECAST_META, "pm25") if key not in forecast]
    if missing:
        raise SystemExit(f"forecast is missing {', '.join(missing)}")

    hours, frames, size = forecast["horizon_hours"], forecast["pm25"], forecast["grid"]["size"]
    if not isinstance(hours, list) or len(hours) != len(frames):
        raise SystemExit(f"forecast has {len(frames)} frames, horizon_hours is {hours!r}")
    if any(len(frame) != size or any(len(row) != size for row in frame) for frame in frames):
        raise SystemExit(f"every forecast frame must be {size} × {size}")

    values = [value for frame in frames for row in frame for value in row]
    if not all(math.isfinite(value) for value in values):
        raise SystemExit("every forecast value must be finite")
    if min(values) < 0 or round(max(values)) > 255:
        raise SystemExit(f"forecast range {min(values)}–{max(values)} µg/m³ does not fit one byte")


def pack_forecast(forecast: dict, here: Path) -> None:
    """Write the forecast as one byte per cell (µg/m³, rounded) plus its metadata.

    Rows run south to north, columns west to east, as in the server's grid.
    """
    values = [round(v) for frame in forecast["pm25"] for row in frame for v in row]
    target = here / "data"
    target.mkdir(exist_ok=True)
    (target / "forecast.bin").write_bytes(bytes(values))
    meta = {key: forecast[key] for key in FORECAST_META}
    (target / "forecast.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    source = Path(sys.argv[1] if len(sys.argv) > 1 else "../aether-smart-badge")
    here = Path(__file__).parent
    template = (here / "template.html").read_text(encoding="utf-8")
    required = [source / FORECAST, *(source / "app/js" / name for name in APP_MODULES)]
    absent = [str(path) for path in required if not path.is_file()]
    if absent:
        raise SystemExit(f"source is missing {', '.join(absent)}")

    # Everything that can fail runs first, so a failed build changes no output.
    try:
        page = MARKER.sub(lambda m: render(m, source), template)
    except OSError as error:
        raise SystemExit(f"could not read a snippet source: {error}") from error
    forecast = json.loads((source / FORECAST).read_text(encoding="utf-8"))
    validate_forecast(forecast)

    (here / "index.html").write_text(page, encoding="utf-8")
    copy_app_modules(source, here)
    pack_forecast(forecast, here)
    print(f"wrote index.html with {len(MARKER.findall(template))} snippets, "
          f"{len(APP_MODULES)} app modules and the packed forecast")


if __name__ == "__main__":
    main()
