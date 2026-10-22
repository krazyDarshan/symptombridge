"""Extract the supplied Chronic Diseases edition without changing its wording.

Only hyphen-led entries inside explicitly headed remedy symptom sections are
searchable. Introductory prose is excluded. All page numbers are PDF indices.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--cached", action="store_true")
    args = parser.parse_args()
    output = ROOT / "outputs/chronic_diseases_dataset"
    output.mkdir(parents=True, exist_ok=True)
    pages = (json.loads((output / "pages.json").read_text(encoding="utf-8"))
             if args.cached else [(page.extract_text() or "") for page in PdfReader(args.pdf).pages])
    # Preserve a reviewable text snapshot. This is never used as search data.
    (output / "pages.json").write_text(json.dumps(pages, ensure_ascii=False), encoding="utf-8")
    headings = []
    for page, text in enumerate(pages, 1):
        for line in text.splitlines():
            line = line.strip()
            if re.fullmatch(r"[A-Z][A-Z ,.-]{3,65}", line):
                headings.append({"page": page, "heading": line})
    (output / "headings.json").write_text(json.dumps(headings, indent=2), encoding="utf-8")
    lines = [(page, line.strip()) for page, text in enumerate(pages, 1)
             for line in text.splitlines() if line.strip()]
    starts = [(i, name) for i, (page, name) in enumerate(lines)
              if page >= 90 and re.fullmatch(r"[A-Z][a-z]+(?: [a-z]+){0,3}", name)
              and name not in {"Lime", "Antipsoric medicines"}]
    assert len(starts) == 47, f"Unexpected section count: {len(starts)}"
    preparations = []
    for section, (begin, name) in enumerate(starts):
        end = starts[section + 1][0] if section + 1 < len(starts) else len(lines)
        block = lines[begin:end]
        # Explicit symptom-list starts avoid hyphenated editorial prefaces.
        overrides = {"Anacardium orientale": "- Sadness.",
                     "Conium maculatum": "- More inclined to be sad",
                     "Cuprum metallicum": "- Melancholy; she shuns",
                     "Iodium": "- Dejection.",
                     "Natrium carbonicum": "- Sad, dejected",
                     "Sepia officinalis": "- Dejected, sad.",
                     "Silicea terra": "- Dejected.",
                     "Sulphur": "- Dejection."}
        prefix = overrides.get(name, "- ")
        first = next(i for i, (_, line) in enumerate(block) if line.startswith(prefix))
        records, current = [], None
        for page, line in block[first:]:
            if re.fullmatch(r"\([a-z.-]+\)", line) or line in {name.upper(), "AURUM FOLIATUM"}:
                continue
            if line.startswith("- "):
                if current:
                    records.append(current)
                current = {"text": line[2:], "page": page, "pageEnd": page}
            elif current:
                current["text"] += " " + line
                current["pageEnd"] = page
        if current:
            records.append(current)
        code = next((line[1:-1].rstrip('.') for _, line in block
                     if re.fullmatch(r"\([a-z.-]+\)", line)), name.lower().replace(' ', '-'))
        pid = f"CD-{section + 1:03}"
        preparations.append({"id": pid, "name": name, "scientific": name,
                             "code": code, "aliases": [], "symptoms": [
                                 [f"{pid}-{i + 1:05}", i + 1, r["text"], "", 1, r["page"],
                                  "chronic-diseases", r["pageEnd"]]
                                 for i, r in enumerate(records)]})
    payload = {"datasetVersion": "chronic-diseases-1", "sources": {
        "chronic-diseases": {"title": "Chronic Diseases", "filename": args.pdf.name,
        "pageCount": len(pages), "sha256": hashlib.sha256(args.pdf.read_bytes()).hexdigest(),
        "priorityNote": "Emphasis not established in this plain-text edition; neutral priority only.",
        "reviewStatus": "Automated extraction; practitioner source audit pending"}},
        "preparations": preparations}
    (output / "chronic-diseases-index.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    summary = {"pages": len(pages), "preparations": len(preparations),
               "symptoms": sum(len(p['symptoms']) for p in preparations),
               "sections": [{"name": p['name'], "count": len(p['symptoms']),
                             "start": p['symptoms'][0][5], "end": p['symptoms'][-1][7]} for p in preparations]}
    (output / "extraction-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
