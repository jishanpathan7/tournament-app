"""Competition Engine — the pure, framework-free core of the tournament domain.

**Hard constraint:** this package imports only the standard library and its own
submodules. No FastAPI, no SQLAlchemy, no DB/HTTP, no other ``app.*`` package. It
speaks in abstract value objects and its own enum vocabulary; the core translates
to/from DB rows and enums at the boundary. This is what makes "add a sport/format =
a new file here, never a migration" hold.

Layers:
- ``types``        — value objects, plans, and the engine's enum vocabulary.
- ``source_refs``  — the finalized ``source_refs`` schema + validator (decision #1).
- ``advancement``  — the finalized ``Stage.config.advancement`` schema + validator (#2).
- ``contracts``    — the six engine ``Protocol``s + request objects + default validator.
- ``registry``     — the ``FormatRegistry`` extension point.
- ``errors``       — the error contracts.

Concrete formats (round_robin, single_elim, …) and sport profiles implement these
contracts and are added later — this module ships only the abstractions.
"""

from app.engine.advancement import (
    AdvancementRule,
    AdvancementSource,
    TakeSpec,
    parse_advancement,
)
from app.engine.contracts import (
    AdvancementEngine,
    AdvancementRequest,
    FormatEngine,
    GenerateRequest,
    PairingEngine,
    PairingRequest,
    ScheduleRequest,
    SchedulingEngine,
    SchemaValidator,
    StandingsEngine,
    StandingsRequest,
    TeamFormationEngine,
    TeamFormationRequest,
    ValidationEngine,
)
from app.engine.errors import (
    ContractError,
    EngineError,
    EngineValidationError,
    Issue,
    UnknownFormatError,
    UnknownSportError,
)
from app.engine.formats.round_robin import RoundRobinFormat
from app.engine.formats.single_elimination import SingleEliminationFormat
from app.engine.pairing import FoldPairingEngine, field_max_dev, pairing_confidence
from app.engine.progression import DefaultAdvancementEngine
from app.engine.registry import FormatRegistry, SportRegistry
from app.engine.source_refs import (
    ByeRef,
    LoserOfRef,
    ParticipantSideRef,
    SeedRef,
    SideRef,
    SourceRefs,
    WinnerOfRef,
    parse_source_refs,
)
from app.engine.sport import MatchMetadata, MatchReport, SportProfile
from app.engine.standings import DefaultStandingsEngine
from app.engine.types import (
    AdvancementResult,
    CourtWindow,
    FormatKey,
    GroupPlan,
    MatchPlan,
    MatchResult,
    Outcome,
    OutcomeKind,
    PairingConstraints,
    PairingEntrant,
    PairingPolicy,
    PairingStrategy,
    ParticipantKind,
    ParticipantRef,
    PointsPolicy,
    ResolvedSide,
    RoundPlan,
    SchedulePlan,
    SchedulingConstraints,
    SeedingMethod,
    SideOutcome,
    SideResult,
    SlotAssignment,
    StandingRow,
    StructurePlan,
    TeamFormationPlan,
    TeamProposal,
    TerminalReason,
    TiebreakPolicy,
)

__all__ = [
    # errors
    "Issue",
    "EngineError",
    "EngineValidationError",
    "UnknownFormatError",
    "UnknownSportError",
    "ContractError",
    # enums / ids
    "FormatKey",
    "SeedingMethod",
    "SideOutcome",
    "OutcomeKind",
    "ParticipantKind",
    "TerminalReason",
    # value objects
    "ParticipantRef",
    "Outcome",
    "SideResult",
    "MatchResult",
    "PointsPolicy",
    "TiebreakPolicy",
    "StandingRow",
    # plans
    "MatchPlan",
    "GroupPlan",
    "RoundPlan",
    "StructurePlan",
    # team formation
    "PairingStrategy",
    "PairingPolicy",
    "PairingEntrant",
    "PairingConstraints",
    "TeamProposal",
    "TeamFormationPlan",
    "CourtWindow",
    "SchedulingConstraints",
    "SlotAssignment",
    "SchedulePlan",
    "ResolvedSide",
    "AdvancementResult",
    # source_refs schema
    "SourceRefs",
    "SideRef",
    "SeedRef",
    "ParticipantSideRef",
    "WinnerOfRef",
    "LoserOfRef",
    "ByeRef",
    "parse_source_refs",
    # advancement schema
    "AdvancementRule",
    "AdvancementSource",
    "TakeSpec",
    "parse_advancement",
    # contracts
    "FormatEngine",
    "PairingEngine",
    "TeamFormationEngine",
    "StandingsEngine",
    "AdvancementEngine",
    "SchedulingEngine",
    "ValidationEngine",
    "SchemaValidator",
    "GenerateRequest",
    "PairingRequest",
    "TeamFormationRequest",
    "StandingsRequest",
    "ScheduleRequest",
    "AdvancementRequest",
    # sport profile contract
    "SportProfile",
    "MatchReport",
    "MatchMetadata",
    # registry
    "FormatRegistry",
    "SportRegistry",
    # concrete implementations
    "RoundRobinFormat",
    "SingleEliminationFormat",
    "DefaultStandingsEngine",
    "DefaultAdvancementEngine",
    "FoldPairingEngine",
    "field_max_dev",
    "pairing_confidence",
]
