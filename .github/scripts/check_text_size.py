"""화면의 글자가 text-base(1rem = 16px)보다 작아지지 않았는지 본다.

작은 글씨는 읽기 힘들어 이 저장소에서는 쓰지 않는다. 루트와 각 도구의 index.html을
훑어 tailwind의 text-sm·text-xs와, style에 직접 쓴 1rem 미만 font-size를 찾아낸다.

    python .github/scripts/check_text_size.py

배포할 때 Actions가 함께 돌린다. 찾으면 그 자리를 알려 주고 1로 끝난다.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SMALL_CLASS = re.compile(r"\btext-(xs|sm)\b")
FONT_SIZE = re.compile(r"font-size:\s*([\d.]+)(rem|em|px)")
MIN_PX = 16.0


def to_px(value: str, unit: str) -> float:
    return float(value) if unit == "px" else float(value) * 16


def check(path: Path) -> list[str]:
    found = []
    for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        where = f"{path.relative_to(ROOT).as_posix()}:{lineno}"
        for m in SMALL_CLASS.finditer(line):
            found.append(f"{where} {m.group(0)}")
        for m in FONT_SIZE.finditer(line):
            if to_px(m.group(1), m.group(2)) < MIN_PX:
                found.append(f"{where} font-size: {m.group(1)}{m.group(2)}")
    return found


def main() -> None:
    pages = sorted(
        p for p in [ROOT / "index.html", *ROOT.glob("*/index.html")]
        if p.is_file() and not p.parent.name.startswith((".", "_"))
    )
    found = [hit for page in pages for hit in check(page)]
    if found:
        print("text-base(1rem)보다 작은 글자:")
        print("\n".join("  " + f for f in found))
        sys.exit(1)
    print(f"{len(pages)}개 쪽 모두 text-base 이상")


if __name__ == "__main__":
    main()
