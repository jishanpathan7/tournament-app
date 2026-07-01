# @tournament/api-client

The **generated** TypeScript contract for the FastAPI backend. `src/schema.d.ts` is
produced by [`openapi-typescript`](https://openapi-ts.dev) from `openapi.json` — never
hand-edited, never allowed to drift. `src/index.ts` re-exports the generated
`paths`/`operations`/`components` plus ergonomic aliases (e.g. `MeResponse`,
`TournamentResponse`). Consume these types from web feature hooks; the axios transport
lives in `apps/web/src/lib/api.ts`.

## Refreshing after backend changes

Two steps — dump the OpenAPI snapshot, then regenerate types:

```bash
# 1) dump the live schema from the API (run from repo root)
cd apps/api && .venv/bin/python -c \
  "import json; from app.main import create_app; \
   open('../../packages/api-client/openapi.json','w').write(json.dumps(create_app().openapi(), indent=2))"

# 2) regenerate the TypeScript types
cd ../.. && yarn workspace @tournament/api-client generate
```

Commit both `openapi.json` and `src/schema.d.ts`. Type-check (`yarn typecheck`) will fail
if any consumer relies on a shape the new contract no longer provides.
