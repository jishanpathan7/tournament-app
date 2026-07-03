"""SurveyMonkey CSV import source — the reference ``ImportSource``.

SurveyMonkey exports a header row of question text, sometimes followed by a *second*
header row of answer-choice sub-labels (blank under the fixed respondent-metadata
columns). Real answer rows always carry a "Respondent ID", so we treat a second row
whose first cell is blank as that sub-header and skip it. Pure — no I/O, no DB.
"""

from __future__ import annotations

import csv
import io

from app.modules.registration_ops.importers.base import ImportError_, ParsedTable


class SurveyMonkeyCsvSource:
    """Satisfies ``ImportSource`` for ``surveymonkey_csv``."""

    key = "surveymonkey_csv"
    label = "SurveyMonkey CSV export"

    def parse(self, raw: str) -> ParsedTable:
        text = raw.lstrip("﻿")  # strip a UTF-8 BOM if present
        reader = csv.reader(io.StringIO(text))
        try:
            all_rows = [row for row in reader]
        except csv.Error as exc:
            raise ImportError_(f"could not parse CSV: {exc}") from exc

        non_empty = [r for r in all_rows if any(cell.strip() for cell in r)]
        if not non_empty:
            raise ImportError_("the file has no rows")

        header = [c.strip() for c in non_empty[0]]
        columns = self._dedupe_headers(header)
        body = non_empty[1:]

        # SurveyMonkey's optional second header row is blank under the first (Respondent
        # ID) column; real answer rows always populate it, so skip such a leading row.
        if body and (not body[0] or not body[0][0].strip()):
            body = body[1:]

        rows: list[dict[str, str]] = []
        for raw_row in body:
            cells = [c.strip() for c in raw_row]
            rows.append(
                {columns[i]: (cells[i] if i < len(cells) else "") for i in range(len(columns))}
            )
        return ParsedTable(columns=columns, rows=rows)

    @staticmethod
    def _dedupe_headers(header: list[str]) -> list[str]:
        """Column names must be unique to key a row dict; SurveyMonkey can repeat blanks."""
        seen: dict[str, int] = {}
        out: list[str] = []
        for i, name in enumerate(header):
            base = name or f"Column {i + 1}"
            if base in seen:
                seen[base] += 1
                out.append(f"{base} ({seen[base]})")
            else:
                seen[base] = 1
                out.append(base)
        return out
