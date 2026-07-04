"""Tests for snake squad distribution."""

from app.engine.squad_distribution import snake_distribute


def test_snake_distribute_balances_count():
    ids = [f"p{i}" for i in range(12)]
    buckets = snake_distribute(ids, 4)
    assert len(buckets) == 4
    assert all(len(b) == 3 for b in buckets)
    assert {mid for b in buckets for mid in b} == set(ids)


def test_snake_distribute_preserves_locked_members():
    ids = ["a", "b", "c", "d", "e", "f"]
    buckets = snake_distribute(ids, 3, locked={"a": 0, "f": 2})
    assert "a" in buckets[0]
    assert "f" in buckets[2]
    assert {mid for b in buckets for mid in b} == set(ids)
