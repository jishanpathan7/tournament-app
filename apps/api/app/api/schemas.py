"""Base Pydantic models for the API contract.

`ApiModel` is the single place the wire casing is decided: JSON is **camelCase**
(idiomatic for the generated TS client and aligned with `packages/shared`) while
Python fields stay snake_case. Every request/response schema must extend it.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    """Base for every request/response schema.

    - camelCase on the wire (FastAPI serializes responses by alias by default);
    - also accepts snake_case input (`populate_by_name`);
    - validates straight off ORM rows (`from_attributes`).
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
