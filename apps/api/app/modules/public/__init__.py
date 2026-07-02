"""Public microsite — anonymous, read-only access to non-private tournaments.

No mutations, no authentication. Every endpoint resolves a tournament by slug first
(the only table with a public-read RLS exception — see `app.db.rls`), validates
`visibility != 'private'`, then sets org context for that tournament's real org before
running any further query, so every other table's normal org-isolation policy holds.
Reuses `scoring`/`tournaments`/`registrations` repositories directly wherever their
existing shape is already safe to expose; only adds new schemas/queries where the
authenticated shape carries PII (participant/team internals) or spans a security
boundary the authenticated code never needed to cross (cross-org search).
"""
