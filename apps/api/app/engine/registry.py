"""Registries — the extension points formats and sports plug into.

Formats (Round Robin, Single Elim, …) register a ``FormatEngine`` keyed by
``FormatKey``; sports (Badminton, …) register a ``SportProfile`` keyed by its string
key. Adding a format or sport is a new registration, never a change to the core.
"""

from __future__ import annotations

from app.engine.contracts import FormatEngine
from app.engine.errors import EngineError, UnknownFormatError, UnknownSportError
from app.engine.sport import SportProfile
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


class SportRegistry:
    def __init__(self) -> None:
        self._sports: dict[str, SportProfile] = {}

    def register(self, profile: SportProfile) -> None:
        if profile.key in self._sports:
            raise EngineError(f"Sport {profile.key!r} is already registered")
        self._sports[profile.key] = profile

    def get(self, key: str) -> SportProfile:
        try:
            return self._sports[key]
        except KeyError:
            raise UnknownSportError(key) from None

    def is_registered(self, key: str) -> bool:
        return key in self._sports

    def registered(self) -> frozenset[str]:
        return frozenset(self._sports)
