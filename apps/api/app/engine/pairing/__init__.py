"""Team-formation engines — combine solo entrants into balanced teams before the draw."""

from app.engine.pairing.fold import FoldPairingEngine, field_max_dev, pairing_confidence

__all__ = ["FoldPairingEngine", "field_max_dev", "pairing_confidence"]
