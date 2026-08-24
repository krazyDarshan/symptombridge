from __future__ import annotations

import json
import sqlite3
from collections import defaultdict
from pathlib import Path


WORKSPACE = Path(__file__).resolve().parents[2]
DATABASE = WORKSPACE / "outputs" / "materia_medica_dataset" / "materia_medica.sqlite"
OUTPUT_DIRECTORY = WORKSPACE / "frontend" / "public" / "data"
INDEX_PATH = OUTPUT_DIRECTORY / "materia-medica-index.json"
METADATA_PATH = OUTPUT_DIRECTORY / "dataset-meta.json"


def read_metadata(connection: sqlite3.Connection) -> dict[str, object]:
    metadata: dict[str, object] = {}
    for key, value in connection.execute("SELECT key, value FROM metadata"):
        try:
            metadata[key] = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            metadata[key] = value
    return metadata


def main() -> None:
    if not DATABASE.exists():
        raise FileNotFoundError(f"Dataset database not found: {DATABASE}")

    database_uri = f"file:{DATABASE.as_posix()}?mode=ro"
    connection = sqlite3.connect(database_uri, uri=True)
    metadata = read_metadata(connection)

    aliases_by_preparation: dict[str, list[str]] = defaultdict(list)
    for preparation_id, alias_text in connection.execute(
        """
        SELECT preparation_id, alias_text
        FROM aliases
        WHERE preparation_id IS NOT NULL
          AND preparation_id <> ''
          AND alias_text IS NOT NULL
          AND alias_text <> ''
        ORDER BY alias_id
        """
    ):
        if alias_text not in aliases_by_preparation[preparation_id]:
            aliases_by_preparation[preparation_id].append(alias_text)

    preparations: list[dict[str, object]] = []
    preparation_lookup: dict[str, dict[str, object]] = {}
    for row in connection.execute(
        """
        SELECT preparation_id, remedy_code, preparation_name, scientific_heading
        FROM preparations
        ORDER BY preparation_id
        """
    ):
        preparation_id, remedy_code, preparation_name, scientific_heading = row
        preparation = {
            "id": preparation_id,
            "code": remedy_code,
            "name": preparation_name,
            "scientific": scientific_heading or preparation_name,
            "aliases": aliases_by_preparation.get(preparation_id, []),
            "symptoms": [],
        }
        preparations.append(preparation)
        preparation_lookup[preparation_id] = preparation

    for row in connection.execute(
        """
        SELECT symptom_id,
               preparation_id,
               symptom_number,
               symptom_text_original,
               emphasized_text,
               source_priority,
               source_page_start
        FROM symptoms
        ORDER BY preparation_id, symptom_number, symptom_id
        """
    ):
        (
            symptom_id,
            preparation_id,
            symptom_number,
            original_text,
            emphasized_text,
            source_priority,
            source_page,
        ) = row
        preparation_lookup[preparation_id]["symptoms"].append(
            [
                symptom_id,
                symptom_number,
                original_text,
                emphasized_text or "",
                source_priority,
                source_page,
            ]
        )

    connection.close()
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)

    index_payload = {
        "datasetVersion": metadata.get("dataset_version", "1.0.0"),
        "preparations": preparations,
    }
    INDEX_PATH.write_text(
        json.dumps(index_payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    public_metadata = {
        "datasetVersion": metadata.get("dataset_version", "1.0.0"),
        "sourceFile": metadata.get("source_file", "Materia-Medica-Pura.pdf"),
        "sourcePageCount": metadata.get("source_page_count", 1183),
        "sectionCount": metadata.get("section_count", 74),
        "preparationCount": metadata.get("preparation_count", len(preparations)),
        "symptomCount": metadata.get("symptom_count", 32031),
        "emphasisSpanCount": metadata.get("emphasis_span_count", 2673),
        "clinicalUseNote": metadata.get("clinical_use_note", ""),
    }
    METADATA_PATH.write_text(
        json.dumps(public_metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "index": str(INDEX_PATH),
                "index_bytes": INDEX_PATH.stat().st_size,
                "metadata": str(METADATA_PATH),
                "preparations": len(preparations),
                "symptoms": sum(len(item["symptoms"]) for item in preparations),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
