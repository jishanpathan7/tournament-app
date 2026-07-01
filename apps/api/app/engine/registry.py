"""Format registry — the extension point future formats plug into.

Round Robin, Single Elimination, Group+Knockout, Swiss, Ladder each register a
``FormatEngine`` here keyed by ``FormatKey``; the core looks one up by the stage's
format. Adding a format is a new registration, never a change to the core.
"""

from __future__ import annotations

from app.engine.contracts import FormatEngine
from app.engine.errors import EngineError, UnknownFormatError
from app.engine.types import FormatKey


class FormatRegistry:
    def __init__(self) -> None:
        self._formats: dict[FormatKey, FormatEngine] = {}

    def register(self, engine: FormatEngine) -> None:
        if engine.key in self._formats:
            raise EngineError(f"Format {engine.key.value!r} is already registered")
        self._formats[engine.key] = engine

    def get(self, key: FormatKey) -> FormatEngine:
        try:
            return self._formats[key]
        except KeyError:
            raise UnknownFormatError(key.value) from None

    def is_registered(self, key: FormatKey) -> bool:
        return key in self._formats

    def registered(self) -> frozenset[FormatKey]:
        return frozenset(self._formats)
