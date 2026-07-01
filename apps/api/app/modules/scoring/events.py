"""Scoring domain event / audit action names."""

MATCH_SCORED = "match.scored"
MATCH_COMPLETED = "match.completed"
MATCH_CORRECTED = "match.corrected"
STANDINGS_RECOMPUTE = "standings.recompute"  # job trigger (consumed by the worker)
STANDINGS_RECOMPUTED = "standings.recomputed"

# realtime channel event types
RT_MATCH_COMPLETED = "match.completed"
RT_BRACKET_UPDATED = "bracket.updated"
RT_STANDINGS_UPDATED = "standings.updated"

# notification types
NOTIFY_MATCH_COMPLETED = "match.completed"
NOTIFY_NEXT_MATCH_READY = "match.ready"
