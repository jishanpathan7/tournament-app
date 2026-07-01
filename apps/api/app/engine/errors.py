"""Error contracts for the competition engine.

Pure domain errors — no framework, no HTTP status codes (the API layer maps these
to Problem Details at the boundary). ``EngineValidationError`` carries structured
``Issue``s so callers get machine-readable, path-anchored feedback.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class Issue:
    """A single validation problem. ``path`` is a dotted/indexed location
    (e.g. ``"sides[1].seed"``); ``code`` is a stable machine code."""

    path: str
    code: str
    message: str


class EngineError(Exception):
    """Base class for every engine error."""


class EngineValidationError(EngineError):
    """One or more schema/config validation problems."""

    def __init__(self, issues: Sequence[Issue]) -> None:
        self.issues: tuple[Issue, ...] = tuple(issues)
        detail = "; ".join(f"{i.path or '<root>'}: {i.message}" for i in self.issues)
        super().__init__(detail or "validation failed")


class UnknownFormatError(EngineError):
    """No engine is registered for the requested format key."""

    def __init__(self, key: str) -> None:
        self.key = key
        super().__init__(f"No format engine registered for {key!r}")


class UnknownSportError(EngineError):
    """No sport profile is registered for the requested sport key."""

    def __init__(self, key: str) -> None:
        self.key = key
        super().__init__(f"No sport profile registered for {key!r}")


class ContractError(EngineError):
    """An engine was called with structurally invalid input (programmer error,
    not user input) — e.g. a request that violates a documented precondition."""
