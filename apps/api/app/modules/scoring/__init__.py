"""Scoring domain — closes the competition loop: score → complete → advance → rank.

Thin orchestration over the pure engine. All score validation + outcome derivation is
delegated to the Sport Profile; bracket advancement to the AdvancementEngine (via the
tournaments module); standings to the StandingsEngine (run asynchronously by the worker).
Emits domain events that fan out to audit, realtime, and notifications.
"""
