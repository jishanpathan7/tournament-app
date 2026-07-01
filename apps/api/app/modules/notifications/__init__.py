"""Notification framework: in-app + email now, WhatsApp/Slack/Push-ready.

A notification ``type`` maps (via ``templates``) to the channels it fans out on and
how it renders; ``service.notify`` is the producer API other modules call. In-app
notifications are stored immediately; other channels are delivered asynchronously by
the ``notification.dispatch`` job handler through per-channel deliverers
(``channels``). Adding a channel = a new deliverer + enum value, no core change.
"""
