"""Build the homepage and maintain its dated log using only the standard library."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
LOG = ROOT / "log.json"


def read_log():
    entries = json.loads(LOG.read_text(encoding="utf-8"))["log"]
    seen = set()
    for entry in entries:
        if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*", entry["id"]):
            raise ValueError("Log IDs must use lowercase letters, numbers, dots, underscores or hyphens")
        if entry["id"] in seen:
            raise ValueError(f"Duplicate log ID: {entry['id']}")
        seen.add(entry["id"])
        dt.date.fromisoformat(entry["date"])
        if not isinstance(entry["text"], str) or not entry["text"].strip():
            raise ValueError("Each log entry needs nonempty Markdown text")
    return sorted(entries, key=lambda entry: entry["date"], reverse=True)


def write_log(entries):
    entries.sort(key=lambda entry: entry["date"], reverse=True)
    # Replace only after the complete JSON has been written successfully.
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=ROOT,
                                     suffix=".json", delete=False) as handle:
        temporary = Path(handle.name)
        json.dump({"log": entries}, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    try:
        temporary.replace(LOG)
    finally:
        temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["build-home", "update-log", "remove-log", "list-log"])
    parser.add_argument("--pandoc", default="pandoc")
    args = parser.parse_args()
    entries = read_log()
    if args.command == "build-home":
        for entry in entries:
            entry["display-date"] = dt.date.fromisoformat(entry["date"]).strftime("%d/%m/%y")
        with tempfile.TemporaryDirectory() as directory:
            metadata = Path(directory) / "log.json"
            output = Path(directory) / "index.html"
            metadata.write_text(json.dumps({"log": entries}), encoding="utf-8")
            subprocess.run([args.pandoc, "--from=markdown", "--to=html5", "--standalone",
                            "--template=templates/index.html", "--metadata=pagetitle:jadon mensah", f"--metadata-file={metadata}",
                            f"--output={output}"], input="", text=True, check=True, cwd=ROOT)
            (ROOT / "index.html").write_bytes(output.read_bytes())
    elif args.command == "list-log":
        for entry in entries:
            print(f"{entry['id']}\t{entry['date']}\t{entry['text']}")
    else:
        entry_id = os.environ.get("ID", "")
        if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*", entry_id):
            parser.error("Set ID to a log ID (run make log to see existing IDs)")
        existing = next((entry for entry in entries if entry["id"] == entry_id), None)
        if args.command == "remove-log":
            if existing is None:
                parser.error(f"No log entry named {entry_id}")
            entries.remove(existing)
        else:
            text = os.environ.get("TEXT", "").strip()
            date = os.environ.get("DATE", "").strip()
            if existing is None and not text:
                parser.error("New entries require TEXT containing Markdown")
            if not date:
                date = existing["date"] if existing else dt.date.today().isoformat()
            dt.date.fromisoformat(date)
            replacement = {"id": entry_id, "date": date,
                           "text": text or existing["text"]}
            if existing is not None:
                entries.remove(existing)
            entries.append(replacement)
        write_log(entries)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error)) from error
