"""Tournament domain — the orchestration layer between the pure Competition Engine,
the Sport Registry, and persistence.

Owns Tournament → Division → Stage structure + lifecycle + draw generation. Keeps the
application layer thin: it translates DB rows ↔ engine value objects, calls the engine
for all competition logic (fixtures, structure), and persists the result. The engine
stays pure and unaware of persistence.
"""
