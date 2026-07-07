"""HTTP rate-limiter singleton.

Uses ``slowapi`` (backed by ``limits``) with in-memory storage at MVP.
When scaling to a second instance, pass ``storage_uri=settings.redis_url``
to move state to Redis/Upstash without changing any call-site code.

Key function: real client IP.  ``ProxyHeadersMiddleware`` (mounted in
``main.py``) has already unwrapped ``X-Forwarded-For`` by the time
``get_remote_address`` runs, so Railway's load-balancer IP is never used.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
