"""Additive backend config. New modules stay off unless explicitly enabled."""

import os


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


QC_ENGINE_ENABLED = _env_bool("QC_ENGINE_ENABLED", False)
