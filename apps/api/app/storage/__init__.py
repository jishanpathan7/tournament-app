"""Concrete ``Storage`` port implementations (see ``app.core.ports.Storage``).

``R2Storage`` (Cloudflare R2 via the S3 API) is the production backend;
``LocalStorage`` is the zero-dependency dev fallback that keeps objects on disk and
serves them through signed local endpoints. The active backend is chosen from
settings by ``app.core.factory.get_storage`` — a config swap, never a code change.
"""
