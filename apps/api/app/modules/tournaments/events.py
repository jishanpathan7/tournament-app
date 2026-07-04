"""Tournament domain event / audit action names."""

TOURNAMENT_CREATED = "tournament.created"
TOURNAMENT_UPDATED = "tournament.updated"
TOURNAMENT_STATUS_CHANGED = "tournament.status_changed"
TOURNAMENT_PUBLISHED = "tournament.published"
TOURNAMENT_DELETED = "tournament.deleted"
DIVISION_CREATED = "division.created"
STAGE_CREATED = "stage.created"
STAGE_GENERATED = "stage.generated"  # draw generated + structure persisted
STAGE_DRAW_CLEARED = "stage.draw_cleared"  # draw wiped so it can be regenerated
