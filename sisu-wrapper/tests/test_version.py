"""Verify consistency of package and API versions."""

import sys
from pathlib import Path

from sisu_wrapper import __version__ as package_version

try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from core.config import API_VERSION  # noqa: E402


def test_version_consistency():
    with (ROOT / "pyproject.toml").open("rb") as file:
        config = tomllib.load(file)

    project_version = config["project"]["version"]
    bumpver_version = config["tool"]["bumpver"]["current_version"]

    assert project_version == bumpver_version
    assert project_version == package_version
    assert project_version == API_VERSION


def test_study_location_is_public():
    from sisu_wrapper import StudyLocation

    location = StudyLocation(id="example-room")
    assert location.id == "example-room"
