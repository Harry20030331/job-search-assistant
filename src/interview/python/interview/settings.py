"""Read shared experimental settings without judge credentials or network access."""
from pathlib import Path
import tomllib

ROOT = Path(__file__).resolve().parents[1]


def load_settings() -> dict:
    return tomllib.loads((ROOT / "configs/midpoint.toml").read_text(encoding="utf-8"))
