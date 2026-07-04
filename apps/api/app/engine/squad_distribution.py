"""Pure squad distribution — serpentine (snake) draft into a fixed number of buckets.

Used to balance skill across franchise teams before pairing or draw. Framework-free.
"""

from __future__ import annotations


def snake_distribute(
    ordered_member_ids: list[str],
    bucket_count: int,
    *,
    locked: dict[str, int] | None = None,
) -> list[list[str]]:
    """Deal ``ordered_member_ids`` (strongest-first) into ``bucket_count`` squads.

    ``locked`` maps a member id to a bucket index (0-based) that must be preserved;
    remaining members are snake-drafted into buckets starting from the lightest load.
    """
    if bucket_count < 1:
        raise ValueError("bucket_count must be at least 1")

    buckets: list[list[str]] = [[] for _ in range(bucket_count)]
    locked = locked or {}

    for member_id, bucket_idx in locked.items():
        if bucket_idx < 0 or bucket_idx >= bucket_count:
            raise ValueError(f"locked bucket index out of range for {member_id}")
        buckets[bucket_idx].append(member_id)

    remaining = [mid for mid in ordered_member_ids if mid not in locked]
    if not remaining:
        return buckets

    # Start snake from the bucket with the fewest members so loads stay even.
    idx = min(range(bucket_count), key=lambda i: len(buckets[i]))
    forward = True

    for member_id in remaining:
        buckets[idx].append(member_id)
        if bucket_count == 1:
            continue
        if forward:
            if idx == bucket_count - 1:
                forward = False
            else:
                idx += 1
        else:
            if idx == 0:
                forward = True
            else:
                idx -= 1

    return buckets
