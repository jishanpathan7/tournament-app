"""Generic file-storage module: presigned uploads, validation, secure downloads.

Sport-agnostic and reused by every future module (org/tournament logos, rules docs,
exports, avatars). HTTP shape only lives here; the storage backend is chosen behind
the ``Storage`` port (``app.core.factory.get_storage``).
"""
