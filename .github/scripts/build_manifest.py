"""루트 바로 아래 폴더 중 index.html이 있는 것을 모아 manifest.json으로 쓴다.

루트 index.html이 이 파일을 읽어 바로가기 카드를 그린다.
manifest.json은 커밋하지 않는다 - 배포할 때마다 Actions가 새로 만든다.
로컬에서 확인하려면 저장소 루트에서 `python .github/scripts/build_manifest.py`.
"""

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


def read_title(index_file: Path) -> str | None:
    match = TITLE_RE.search(index_file.read_text(encoding="utf-8", errors="replace"))
    if not match:
        return None
    title = " ".join(html.unescape(match.group(1)).split())
    return title or None


def main() -> None:
    entries = []
    for folder in sorted(ROOT.iterdir(), key=lambda p: p.name.lower()):
        # .git, .github 같은 숨은 폴더와 _로 시작하는 작업용 폴더는 건너뛴다
        if not folder.is_dir() or folder.name.startswith((".", "_")):
            continue
        index_file = folder / "index.html"
        if not index_file.is_file():
            continue
        entries.append({
            "path": folder.name,
            "title": read_title(index_file) or folder.name,
        })

    out = ROOT / "manifest.json"
    out.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(entries)} entries -> {out.name}")


if __name__ == "__main__":
    main()
