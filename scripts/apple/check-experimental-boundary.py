#!/usr/bin/env python3
"""Validate that HudsonKitExperimental remains a quarantined SwiftPM rail.

The checker accepts JSON and source-root overrides so its graph and source
rules can be exercised with small, deterministic fixtures. With no overrides,
it evaluates the root manifest with HudsonVoice disabled and scans the native
HudsonKit source tree.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Any


EXPERIMENTAL_PRODUCT = "HudsonKitExperimental"
EXPERIMENTAL_TARGET = "HudsonKitExperimental"
EXPERIMENTAL_TEST_TARGET = "HudsonKitExperimentalTests"


def dependency_names(dependencies: list[dict[str, Any]]) -> list[str]:
    """Return dependency names from every SwiftPM target-dependency spelling."""
    names: list[str] = []
    for dependency in dependencies:
        for dependency_kind in ("byName", "target", "product"):
            value = dependency.get(dependency_kind)
            if isinstance(value, list) and value and isinstance(value[0], str):
                names.append(value[0])
    return names


def package_errors(package: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    products = package.get("products", [])
    targets = package.get("targets", [])
    product_by_name = {product.get("name"): product for product in products}
    target_by_name = {target.get("name"): target for target in targets}

    experimental_product = product_by_name.get(EXPERIMENTAL_PRODUCT)
    if experimental_product is None:
        errors.append(f"missing product {EXPERIMENTAL_PRODUCT}")
    elif experimental_product.get("targets") != [EXPERIMENTAL_TARGET]:
        errors.append(
            f"product {EXPERIMENTAL_PRODUCT} must expose exactly [{EXPERIMENTAL_TARGET}]"
        )
    elif "library" not in experimental_product.get("type", {}):
        errors.append(f"product {EXPERIMENTAL_PRODUCT} must be a library")

    experimental_target = target_by_name.get(EXPERIMENTAL_TARGET)
    if experimental_target is None:
        errors.append(f"missing target {EXPERIMENTAL_TARGET}")
    else:
        if experimental_target.get("type") != "regular":
            errors.append(f"target {EXPERIMENTAL_TARGET} must be a regular target")
        if dependency_names(experimental_target.get("dependencies", [])):
            errors.append(f"target {EXPERIMENTAL_TARGET} must have no dependencies")

    experimental_tests = target_by_name.get(EXPERIMENTAL_TEST_TARGET)
    if experimental_tests is None:
        errors.append(f"missing dedicated test target {EXPERIMENTAL_TEST_TARGET}")
    elif experimental_tests.get("type") != "test":
        errors.append(f"target {EXPERIMENTAL_TEST_TARGET} must be a test target")
    elif dependency_names(experimental_tests.get("dependencies", [])) != [EXPERIMENTAL_TARGET]:
        errors.append(
            f"test target {EXPERIMENTAL_TEST_TARGET} must depend only on {EXPERIMENTAL_TARGET}"
        )

    graph = {
        name: dependency_names(target.get("dependencies", []))
        for name, target in target_by_name.items()
        if isinstance(name, str)
    }

    def reaches_experimental(name: str, visited: set[str]) -> bool:
        if name == EXPERIMENTAL_TARGET:
            return True
        if name in visited:
            return False
        return any(reaches_experimental(child, visited | {name}) for child in graph.get(name, []))

    for product in products:
        product_name = product.get("name")
        if product_name == EXPERIMENTAL_PRODUCT:
            continue
        for root_target in product.get("targets", []):
            if reaches_experimental(root_target, set()):
                errors.append(
                    f"stable product {product_name} transitively depends on {EXPERIMENTAL_TARGET}"
                )
                break

    for target_name, dependencies in graph.items():
        if target_name in {EXPERIMENTAL_TARGET, EXPERIMENTAL_TEST_TARGET}:
            continue
        if reaches_experimental(target_name, set()):
            errors.append(
                f"stable target {target_name} transitively depends on {EXPERIMENTAL_TARGET}"
            )

    return errors


def source_without_comments_and_strings(source: str) -> str:
    """Remove non-code mentions so documentation cannot trip an import rule."""
    return re.sub(
        r'//[^\n]*|/\*.*?\*/|"(?:\\.|[^"\\])*"',
        "",
        source,
        flags=re.DOTALL,
    )


def source_errors(sources_root: Path) -> list[str]:
    errors: list[str] = []
    if not sources_root.is_dir():
        return [f"source root does not exist: {sources_root}"]

    import_pattern = re.compile(r"\bimport\s+HudsonKitExperimental\b")
    spi_pattern = re.compile(r"@_spi\s*\(\s*Experimental\s*\)")
    for source_file in sorted(sources_root.rglob("*.swift")):
        contents = source_without_comments_and_strings(source_file.read_text(encoding="utf-8"))
        if spi_pattern.search(contents):
            errors.append(f"Apple source uses forbidden @_spi(Experimental): {source_file}")
        if EXPERIMENTAL_TARGET in source_file.relative_to(sources_root).parts:
            continue
        if import_pattern.search(contents):
            errors.append(f"stable source imports or re-exports experimental module: {source_file}")
    return errors


def load_package(package_json: Path | None, repository_root: Path) -> dict[str, Any]:
    if package_json is not None:
        return json.loads(package_json.read_text(encoding="utf-8"))

    environment = os.environ.copy()
    environment.setdefault("HUDSONKIT_WITH_VOICE", "0")
    result = subprocess.run(
        ["swift", "package", "dump-package"],
        cwd=repository_root,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def main(argv: list[str]) -> int:
    repository_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package-json", type=Path, help="SwiftPM dump-package JSON fixture")
    parser.add_argument(
        "--sources-root",
        type=Path,
        default=repository_root / "packages/native/apple/HudsonKit/Sources",
        help="native source root to scan",
    )
    arguments = parser.parse_args(argv)

    try:
        package = load_package(arguments.package_json, repository_root)
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        print(f"experimental boundary check could not load package graph: {error}", file=sys.stderr)
        return 2

    errors = package_errors(package) + source_errors(arguments.sources_root)
    if errors:
        print("HudsonKit experimental boundary check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("HudsonKit experimental boundary check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
