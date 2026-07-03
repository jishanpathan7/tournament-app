"""Import-source registry — adding a provider is one line here + one parser file."""

from __future__ import annotations

from app.modules.registration_ops.importers.base import ImportError_, ImportSource, ParsedTable
from app.modules.registration_ops.importers.surveymonkey import SurveyMonkeyCsvSource

_SOURCES: dict[str, ImportSource] = {src.key: src for src in (SurveyMonkeyCsvSource(),)}


def get_source(key: str) -> ImportSource | None:
    return _SOURCES.get(key)


def list_sources() -> list[ImportSource]:
    return list(_SOURCES.values())


__all__ = [
    "ImportError_",
    "ImportSource",
    "ParsedTable",
    "SurveyMonkeyCsvSource",
    "get_source",
    "list_sources",
]
