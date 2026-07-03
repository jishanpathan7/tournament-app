"""SurveyMonkey CSV import source — the reference ``ImportSource``.

SurveyMonkey exports a header row of question text, sometimes followed by a *second*
header row of answer-choice sub-labels (blank under the fixed respondent-metadata
columns, e.g. "Open-ended response" under question columns). Real answer rows always
carry a "Respondent ID", so we skip a leading body row whose first cell is blank AND
whose remaining non-blank cells are exclusively SM response-type labels. Pure — no I/O,
no DB.
"""

from __future__ import annotations

import csv
import io

from app.modules.registration_ops.importers.base import ImportError_, ParsedTable

# Sub-label values SurveyMonkey places in the second header row.
_SM_SUB_LABELS: frozenset[str] = frozenset(
    {
        "open-ended response",
        "single choice",
        "multiple choice",
        "rating",
        "matrix/rating scale",
        "file upload",
        "date",
        "slider",
        "ranking",
        "net promoter score",
    }
)


def _is_sm_second_header(row: list[str]) -> bool:
    """Return True only when *row* looks like a SurveyMonkey sub-label row.

    A real SM second header has a blank first cell and every other non-blank
    cell is one of the known SM response-type labels.  A data row whose first
    field happens to be empty (e.g. a respondent with no name) will have real
    values (email, skill level, …) that don't match, so it won't be skipped.
    """
    if not row or row[0].strip():
        return False
    non_blank_rest = [c.strip() for c in row[1:] if c.strip()]
    # All blank after first → likely a degenerate SM header with no labels
    if not non_blank_rest:
        return True
    return all(c.lower() in _SM_SUB_LABELS for c in non_blank_rest)


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

        # Skip the optional SurveyMonkey second header row (response-type sub-labels).
        if body and _is_sm_second_header(body[0]):
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
