"""Feature flags: global / org / user flags with percentage rollout.

``service.is_enabled`` is the evaluation API future modules use instead of hardcoded
checks (also available as the ``require_flag`` route guard in ``app/api/deps.py``).
Precedence is user > org > global; rollout buckets are deterministic and sticky.
The management API here manages org-scoped flags; the evaluator honours all scopes.
"""
