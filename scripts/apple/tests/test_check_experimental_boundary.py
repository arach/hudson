#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest


SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = SCRIPTS_ROOT / "check-experimental-boundary.py"
FIXTURE_PATH = Path(__file__).parent / "fixtures/experimental-boundary/valid-package.json"
sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("experimental_boundary", CHECKER_PATH)
assert SPEC is not None and SPEC.loader is not None
CHECKER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECKER)


class ExperimentalBoundaryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.package = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    def target(self, name: str) -> dict:
        return next(target for target in self.package["targets"] if target["name"] == name)

    def test_valid_fixture_passes(self) -> None:
        self.assertEqual(CHECKER.package_errors(self.package), [])

    def test_rejects_direct_stable_target_dependency(self) -> None:
        self.target("HudsonStable")["dependencies"] = [{"byName": ["HudsonKitExperimental", None]}]
        self.assertIn(
            "stable product HudsonStable transitively depends on HudsonKitExperimental",
            CHECKER.package_errors(self.package),
        )

    def test_rejects_explicit_target_dependency_spelling(self) -> None:
        self.target("HudsonStable")["dependencies"] = [{"target": ["HudsonKitExperimental", None]}]
        self.assertIn(
            "stable product HudsonStable transitively depends on HudsonKitExperimental",
            CHECKER.package_errors(self.package),
        )

    def test_rejects_product_dependency_spelling(self) -> None:
        self.target("HudsonStable")["dependencies"] = [{"product": ["HudsonKitExperimental", "Hudson"]}]
        self.assertIn(
            "stable product HudsonStable transitively depends on HudsonKitExperimental",
            CHECKER.package_errors(self.package),
        )

    def test_rejects_transitive_stable_product_dependency(self) -> None:
        self.package["targets"].append(
            {"name": "StableHelper", "type": "regular", "dependencies": [{"byName": ["HudsonKitExperimental", None]}]}
        )
        self.target("HudsonStable")["dependencies"] = [{"byName": ["StableHelper", None]}]
        self.assertIn(
            "stable product HudsonStable transitively depends on HudsonKitExperimental",
            CHECKER.package_errors(self.package),
        )

    def test_rejects_missing_empty_target_contract(self) -> None:
        self.target("HudsonKitExperimental")["dependencies"] = [{"byName": ["HudsonStable", None]}]
        self.assertIn(
            "target HudsonKitExperimental must have no dependencies",
            CHECKER.package_errors(self.package),
        )

    def source_errors_for(self, contents: str, target_name: str = "HudsonStable") -> list[str]:
        with tempfile.TemporaryDirectory() as temporary_directory:
            source_root = Path(temporary_directory)
            stable_source = source_root / target_name / "Stable.swift"
            stable_source.parent.mkdir()
            stable_source.write_text(contents, encoding="utf-8")
            return CHECKER.source_errors(source_root)

    def test_rejects_stable_import(self) -> None:
        errors = self.source_errors_for("import HudsonKitExperimental\n")
        self.assertTrue(any("imports or re-exports" in error for error in errors))

    def test_rejects_stable_reexport(self) -> None:
        errors = self.source_errors_for("@_exported import HudsonKitExperimental\n")
        self.assertTrue(any("imports or re-exports" in error for error in errors))

    def test_rejects_spi_escape_hatch(self) -> None:
        errors = self.source_errors_for("@_spi(Experimental) import HudsonStable\n")
        self.assertTrue(any("forbidden @_spi(Experimental)" in error for error in errors))

    def test_rejects_spi_escape_hatch_inside_experimental_target(self) -> None:
        errors = self.source_errors_for(
            "@_spi(Experimental) import HudsonStable\n",
            target_name="HudsonKitExperimental",
        )
        self.assertTrue(any("forbidden @_spi(Experimental)" in error for error in errors))

    def test_ignores_non_code_boundary_mentions(self) -> None:
        errors = self.source_errors_for(
            "// Do not import HudsonKitExperimental or use @_spi(Experimental).\n"
            "let guidance = \"import HudsonKitExperimental\"\n"
        )
        self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
