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

    def test_rejects_stable_target_reaching_visual_demo(self) -> None:
        self.target("HudsonStable")["dependencies"] = [
            {"byName": ["HudsonKitExperimentalVisualDemo", None]}
        ]
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

    def test_rejects_moved_experimental_source_target(self) -> None:
        self.target("HudsonKitExperimental")["path"] = (
            "packages/native/apple/HudsonKit/Sources/HudsonUI"
        )
        self.assertIn(
            "target HudsonKitExperimental must use path "
            "packages/native/apple/HudsonKit/Sources/HudsonKitExperimental",
            CHECKER.package_errors(self.package),
        )

    def test_rejects_experimental_target_outside_its_exact_path(self) -> None:
        self.target("HudsonKitExperimental")["path"] = "packages/native/apple/HudsonKit/Sources/HudsonStable"
        self.assertIn(
            "target HudsonKitExperimental must use path packages/native/apple/HudsonKit/Sources/HudsonKitExperimental",
            CHECKER.package_errors(self.package),
        )

    def source_errors_for(self, contents: str, relative_path: str = "Sources/HudsonStable/Stable.swift") -> list[str]:
        with tempfile.TemporaryDirectory() as temporary_directory:
            source_root = Path(temporary_directory)
            stable_source = source_root / relative_path
            stable_source.parent.mkdir(parents=True)
            stable_source.write_text(contents, encoding="utf-8")
            return CHECKER.source_errors(source_root)

    def test_rejects_stable_import(self) -> None:
        errors = self.source_errors_for("import HudsonKitExperimental\n")
        self.assertTrue(
            any("unauthorized source imports or re-exports" in error for error in errors)
        )

    def test_rejects_stable_reexport(self) -> None:
        errors = self.source_errors_for("@_exported import HudsonKitExperimental\n")
        self.assertTrue(any("unauthorized source imports or re-exports" in error for error in errors))

    def test_rejects_spi_escape_hatch(self) -> None:
        errors = self.source_errors_for("@_spi(Experimental) import HudsonStable\n")
        self.assertTrue(any("forbidden @_spi(Experimental)" in error for error in errors))

    def test_rejects_spi_escape_hatch_inside_experimental_target(self) -> None:
        errors = self.source_errors_for(
            "@_spi(Experimental) import HudsonStable\n",
            relative_path="Sources/HudsonKitExperimental/Stable.swift",
        )
        self.assertTrue(any("forbidden @_spi(Experimental)" in error for error in errors))

    def test_ignores_non_code_boundary_mentions(self) -> None:
        errors = self.source_errors_for(
            "// Do not import HudsonKitExperimental or use @_spi(Experimental).\n"
            "let guidance = \"import HudsonKitExperimental\"\n"
        )
        self.assertEqual(errors, [])

    def test_allows_import_only_in_exact_experimental_paths(self) -> None:
        for relative_path in (
            "Sources/HudsonKitExperimental/Allowed.swift",
            "Tests/HudsonKitExperimentalTests/Allowed.swift",
            "Demo/HudsonKitExperimentalDemo/main.swift",
            "Demo/HudsonKitExperimentalVisualDemo/main.swift",
        ):
            with self.subTest(relative_path=relative_path):
                self.assertEqual(
                    self.source_errors_for("import HudsonKitExperimental\n", relative_path),
                    [],
                )

    def test_rejects_unauthorized_demo_import_path(self) -> None:
        errors = self.source_errors_for(
            "import HudsonKitExperimental\n",
            relative_path="Demo/HudsonKitDemo/Leak.swift",
        )
        self.assertTrue(any("unauthorized source imports or re-exports" in error for error in errors))

    def test_rejects_visual_demo_sibling_import_path(self) -> None:
        errors = self.source_errors_for(
            "import HudsonKitExperimental\n",
            relative_path="Demo/HudsonKitExperimentalVisualDemoCopy/main.swift",
        )
        self.assertTrue(any("unauthorized source imports or re-exports" in error for error in errors))

    def test_rejects_invalid_experimental_demo_contract(self) -> None:
        self.target("HudsonKitExperimentalDemo")["dependencies"].append(
            {"byName": ["HudsonStable", None]}
        )
        self.assertIn(
            "demo target HudsonKitExperimentalDemo must depend only on HudsonKitExperimental",
            CHECKER.package_errors(self.package),
        )

    def test_rejects_invalid_experimental_visual_demo_contract(self) -> None:
        self.target("HudsonKitExperimentalVisualDemo")["dependencies"].append(
            {"byName": ["HudsonStable", None]}
        )
        self.assertIn(
            "visual demo target HudsonKitExperimentalVisualDemo must depend only on HudsonKitExperimental",
            CHECKER.package_errors(self.package),
        )

    def test_rejects_moved_experimental_visual_demo(self) -> None:
        self.target("HudsonKitExperimentalVisualDemo")["path"] = "Demo/HudsonKitDemo"
        self.assertIn(
            "visual demo target HudsonKitExperimentalVisualDemo must use path "
            "packages/native/apple/HudsonKit/Demo/HudsonKitExperimentalVisualDemo",
            CHECKER.package_errors(self.package),
        )


if __name__ == "__main__":
    unittest.main()
