"""The pluggable import-source seam.

An ``ImportSource`` turns a raw upload (CSV text today; a Google Sheets range or an
Excel blob tomorrow) into a normalized ``ParsedTable`` of columns + string rows. Every
step after parsing — column mapping, row validation, duplicate detection, commit — is
source-agnostic and lives in the service, so adding a provider is a new parser here and
one registry line, never a change to the pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


@dataclass(frozen=True)
class ParsedTable:
    """A source reduced to a header + string rows. Each row maps column → cell value."""

    columns: list[str] = field(default_factory=list)
    rows: list[dict[str, str]] = field(default_factory=list)


class ImportError_(Exception):
    """Raised by a source when the raw payload can't be parsed at all (not a row-level
    problem — those surface as invalid rows in the preview)."""


@runtime_checkable
class ImportSource(Protocol):
    """Parses one provider's export format into a ``ParsedTable``."""

    key: str  # stable identifier, e.g. "surveymonkey_csv"
    label: str  # human label for the picker

    def parse(self, raw: str) -> ParsedTable: ...
