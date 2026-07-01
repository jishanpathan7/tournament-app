"""Concrete ``FormatEngine`` implementations — pure, one module per format.

Round Robin is the reference implementation; Single Elimination, Group+Knockout,
Swiss, and Ladder follow the same shape (validate → generate a ``StructurePlan``).
Each registers in a ``FormatRegistry`` keyed by ``FormatKey``.
"""
