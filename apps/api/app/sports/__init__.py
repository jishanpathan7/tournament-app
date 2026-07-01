"""Sport Profiles — concrete implementations of the engine's ``SportProfile`` contract.

Each sport is one file that owns *every* rule for that sport (scoring, validation,
outcome derivation) and depends only on ``app.engine`` — never on FastAPI, SQLAlchemy,
the DB, or another sport. Badminton is the reference implementation; adding a sport is
a new file here + a registry entry, with no change to the engine or the core.
"""
