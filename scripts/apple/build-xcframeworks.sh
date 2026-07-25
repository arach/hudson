#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Build Hudson Apple binary targets as XCFramework zip artifacts.

Usage:
  scripts/apple/build-xcframeworks.sh --version 1.2.0 [options]

Options:
  --version VERSION       Version string used in zip names and release URLs.
  --base-url URL          Public URL prefix for generated Package.swift.
                          Defaults to https://github.com/arach/hudsonkit-xcframework/releases/download/VERSION
  --output-dir DIR        Artifact output directory.
                          Defaults to dist/apple-xcframeworks/VERSION
  --products LIST         Comma-separated public products to expose.
                          Defaults to HudsonUI,HudsonShell
  --macos-archs LIST      Comma-separated macOS architectures.
                          Defaults to arm64,x86_64
  --package-name NAME     Generated package name. Defaults to HudsonKitXCFramework.
  --keep-intermediates    Keep archives, DerivedData, and xcodebuild logs.
  -h, --help              Show this help.

Each target is staged in an isolated Swift package. Previously built dependencies
are consumed as binary targets, so downstream frameworks link them dynamically
instead of copying their implementations into every XCFramework.
USAGE
}

die() {
  echo "error: $*" >&2
  exit 1
}

split_csv() {
  local raw="$1"
  local item
  local -a values=()

  raw="${raw//,/ }"
  for item in $raw; do
    [[ -n "$item" ]] && values+=("$item")
  done

  printf '%s\n' "${values[@]}"
}

join_by_space() {
  local first=1
  local item
  for item in "$@"; do
    if [[ $first -eq 1 ]]; then
      printf '%s' "$item"
      first=0
    else
      printf ' %s' "$item"
    fi
  done
}

swift_array_literal() {
  local first=1
  local item
  printf '['
  for item in "$@"; do
    if [[ $first -eq 1 ]]; then
      printf '"%s"' "$item"
      first=0
    else
      printf ', "%s"' "$item"
    fi
  done
  printf ']'
}

product_target_closure() {
  case "$1" in
    HudsonUI)
      printf '%s\n' HudsonLive HudsonObservability HudsonUI
      ;;
    HudsonShell)
      printf '%s\n' HudsonLive HudsonObservability HudsonUI HudsonShell
      ;;
    *)
      printf '%s\n' "$1"
      ;;
  esac
}

target_dependencies() {
  case "$1" in
    HudsonUI)
      printf '%s\n' HudsonLive HudsonObservability
      ;;
    HudsonShell)
      # HudsonLive is a public-interface dependency of HudsonUI, so it must be
      # available while compiling HudsonShell even though Shell does not import it directly.
      printf '%s\n' HudsonLive HudsonObservability HudsonUI
      ;;
  esac
}

write_isolated_package() {
  local target="$1"
  local package_dir="$2"
  local source_dir="$repo_root/packages/native/apple/HudsonKit/Sources/$target"
  local dependency
  local -a target_deps=()

  [[ -d "$source_dir" ]] || die "missing source directory for $target at $source_dir"
  mkdir -p "$package_dir/Sources/$target" "$package_dir/Artifacts"
  ditto "$source_dir" "$package_dir/Sources/$target"

  while IFS= read -r dependency; do
    [[ -n "$dependency" ]] || continue
    [[ -d "$output_dir/$dependency.xcframework" ]] || \
      die "$target requires $dependency.xcframework to be built first"
    ditto "$output_dir/$dependency.xcframework" "$package_dir/Artifacts/$dependency.xcframework"
    target_deps+=("$dependency")
  done < <(target_dependencies "$target")

  {
    echo "// swift-tools-version: 5.9"
    echo "import PackageDescription"
    echo
    echo "let package = Package("
    echo "    name: \"${target}BinaryBuild\","
    echo "    platforms: [.macOS(.v14)],"
    echo "    products: ["
    echo "        .library(name: \"$target\", type: .dynamic, targets: [\"$target\"]),"
    echo "    ],"
    echo "    targets: ["
    if [[ ${#target_deps[@]} -gt 0 ]]; then
      for dependency in "${target_deps[@]}"; do
        echo "        .binaryTarget(name: \"$dependency\", path: \"Artifacts/$dependency.xcframework\"),"
      done
    fi
    printf '        .target(name: "%s", dependencies: ' "$target"
    if [[ ${#target_deps[@]} -gt 0 ]]; then
      swift_array_literal "${target_deps[@]}"
    else
      printf '[]'
    fi
    echo ", path: \"Sources/$target\"),"
    echo "    ]"
    echo ")"
  } > "$package_dir/Package.swift"
}

framework_binary() {
  local framework_path="$1"
  local target="$2"
  if [[ -f "$framework_path/Versions/A/$target" ]]; then
    printf '%s' "$framework_path/Versions/A/$target"
  else
    printf '%s' "$framework_path/$target"
  fi
}

verify_dynamic_dependencies() {
  local target="$1"
  local framework_path="$2"
  local binary
  local dependency
  local dependency_binary
  local dependency_path
  local arch
  local class_violations
  local ownership_violations

  binary="$(framework_binary "$framework_path" "$target")"
  [[ -f "$binary" ]] || die "missing framework binary for $target at $binary"
  if ! lipo "$binary" -verify_arch "${macos_archs[@]}"; then
    die "$target does not contain every requested architecture: ${macos_archs[*]}"
  fi

  while IFS= read -r dependency; do
    [[ -n "$dependency" ]] || continue
    dependency_binary="$(
      find "$output_dir/$dependency.xcframework" -type f -name "$dependency" -print -quit
    )"
    [[ -f "$dependency_binary" ]] || \
      die "missing dependency framework binary for $dependency"
    dependency_path="@rpath/$dependency.framework/Versions/A/$dependency"
    if ! otool -L "$binary" | grep -Fq "$dependency_path"; then
      otool -L "$binary" >&2
      die "$target does not dynamically link $dependency"
    fi

    for arch in "${macos_archs[@]}"; do
      ownership_violations="$(
        nm -arch "$arch" -U "$binary" \
          | awk '{print $3}' \
          | xcrun swift-demangle --compact \
          | grep -E "^${dependency}\\." \
          | head -n 20 \
          || true
      )"
      if [[ -n "$ownership_violations" ]]; then
        echo "$ownership_violations" >&2
        die "$target ($arch) contains definitions owned by dependency $dependency"
      fi

      class_violations="$(
        comm -12 \
          <(otool -arch "$arch" -v -s __TEXT __objc_classname "$binary" \
              | awk '$2 ~ /^[_A-Za-z]/ { print $2 }' | sort -u) \
          <(otool -arch "$arch" -v -s __TEXT __objc_classname "$dependency_binary" \
              | awk '$2 ~ /^[_A-Za-z]/ { print $2 }' | sort -u)
      )"
      if [[ -n "$class_violations" ]]; then
        echo "$class_violations" >&2
        die "$target ($arch) duplicates Objective-C classes from $dependency"
      fi
    done
  done < <(target_dependencies "$target")
}

append_unique() {
  local item="$1"
  local existing
  if [[ ${#build_targets[@]} -gt 0 ]]; then
    for existing in "${build_targets[@]}"; do
      [[ "$existing" == "$item" ]] && return 0
    done
  fi
  build_targets+=("$item")
}

checksum_for() {
  local target="$1"
  local i
  for ((i = 0; i < ${#checksum_targets[@]}; i++)); do
    if [[ "${checksum_targets[$i]}" == "$target" ]]; then
      printf '%s' "${checksum_values[$i]}"
      return 0
    fi
  done
  return 1
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
version=""
base_url=""
output_dir=""
products_csv="HudsonUI,HudsonShell"
macos_archs_csv="arm64,x86_64"
package_name="HudsonKitXCFramework"
keep_intermediates=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      [[ $# -ge 2 ]] || die "--version requires a value"
      version="$2"
      shift 2
      ;;
    --base-url)
      [[ $# -ge 2 ]] || die "--base-url requires a value"
      base_url="$2"
      shift 2
      ;;
    --output-dir)
      [[ $# -ge 2 ]] || die "--output-dir requires a value"
      output_dir="$2"
      shift 2
      ;;
    --products)
      [[ $# -ge 2 ]] || die "--products requires a value"
      products_csv="$2"
      shift 2
      ;;
    --macos-archs)
      [[ $# -ge 2 ]] || die "--macos-archs requires a value"
      macos_archs_csv="$2"
      shift 2
      ;;
    --package-name)
      [[ $# -ge 2 ]] || die "--package-name requires a value"
      package_name="$2"
      shift 2
      ;;
    --keep-intermediates)
      keep_intermediates=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

[[ -n "$version" ]] || die "--version is required"

if [[ -z "$base_url" ]]; then
  base_url="https://github.com/arach/hudsonkit-xcframework/releases/download/$version"
fi

if [[ -z "$output_dir" ]]; then
  output_dir="$repo_root/dist/apple-xcframeworks/$version"
elif [[ "$output_dir" != /* ]]; then
  output_dir="$repo_root/$output_dir"
fi

requested_products=()
while IFS= read -r product; do
  requested_products+=("$product")
done < <(split_csv "$products_csv")

macos_archs=()
while IFS= read -r arch; do
  macos_archs+=("$arch")
done < <(split_csv "$macos_archs_csv")

[[ ${#requested_products[@]} -gt 0 ]] || die "at least one product is required"
[[ ${#macos_archs[@]} -gt 0 ]] || die "at least one macOS architecture is required"

build_targets=()
for product in "${requested_products[@]}"; do
  while IFS= read -r target; do
    append_unique "$target"
  done < <(product_target_closure "$product")
done

cache_root="$HOME/Library/Caches/codex-builds"
mkdir -p "$cache_root" "$output_dir"
run_dir="$(mktemp -d "$cache_root/hudson-xcframeworks.$version.XXXXXXXX")"
derived_data_dir="$run_dir/DerivedData"
archive_dir="$run_dir/archives"
log_dir="$run_dir/logs"
mkdir -p "$archive_dir" "$log_dir"

cleanup() {
  local status=$?
  if [[ $keep_intermediates -eq 1 ]]; then
    echo "Preserved intermediates: $run_dir" >&2
  else
    rm -rf "$run_dir"
  fi
  exit "$status"
}
trap cleanup EXIT

archs="$(join_by_space "${macos_archs[@]}")"
checksums_file="$output_dir/checksums.txt"
rm -f "$checksums_file"

checksum_targets=()
checksum_values=()

echo "Output: $output_dir"
echo "Building targets: ${build_targets[*]}"
echo "macOS ARCHS: $archs"

for target in "${build_targets[@]}"; do
  archive_scheme="${target}BinaryBuild"
  package_dir="$run_dir/packages/$target"
  target_derived_data_dir="$derived_data_dir/$target"
  archive_path="$archive_dir/$target.xcarchive"
  xcframework_path="$output_dir/$target.xcframework"
  zip_path="$output_dir/$target-$version.xcframework.zip"
  log_path="$log_dir/$target.archive.log"

  rm -rf "$archive_path" "$xcframework_path" "$zip_path"

  write_isolated_package "$target" "$package_dir"

  echo "Archiving $target..."
  if ! (
    cd "$package_dir"
    xcodebuild archive \
      -scheme "$archive_scheme" \
      -configuration Release \
      -destination "generic/platform=macOS" \
      -archivePath "$archive_path" \
      -derivedDataPath "$target_derived_data_dir" \
      SKIP_INSTALL=NO \
      BUILD_LIBRARY_FOR_DISTRIBUTION=YES \
      ONLY_ACTIVE_ARCH=NO \
      CODE_SIGNING_ALLOWED=NO \
      CODE_SIGNING_REQUIRED=NO \
      ARCHS="$archs"
  ) >"$log_path" 2>&1; then
    tail -n 120 "$log_path" >&2
    die "archive failed for $target; full log at $log_path"
  fi

  frameworks=()
  while IFS= read -r framework; do
    frameworks+=("$framework")
  done < <(find "$archive_path/Products" -type d -name "$target.framework" -prune)

  if [[ ${#frameworks[@]} -ne 1 ]]; then
    find "$archive_path" -maxdepth 6 -print >&2
    die "expected one $target.framework in $archive_path, found ${#frameworks[@]}"
  fi

  module_source="$target_derived_data_dir/Build/Intermediates.noindex/ArchiveIntermediates/$archive_scheme/BuildProductsPath/Release/$target.swiftmodule"
  [[ -d "$module_source" ]] || die "missing Swift module files for $target at $module_source"

  framework_path="${frameworks[0]}"
  verify_dynamic_dependencies "$target" "$framework_path"
  if [[ -d "$framework_path/Versions/A" ]]; then
    modules_parent="$framework_path/Versions/A/Modules"
    mkdir -p "$modules_parent"
    rm -rf "$modules_parent/$target.swiftmodule" "$framework_path/Modules"
    cp -R "$module_source" "$modules_parent/"
    ln -s "Versions/Current/Modules" "$framework_path/Modules"
  else
    modules_parent="$framework_path/Modules"
    mkdir -p "$modules_parent"
    rm -rf "$modules_parent/$target.swiftmodule"
    cp -R "$module_source" "$modules_parent/"
  fi

  echo "Creating $target.xcframework..."
  xcodebuild -create-xcframework \
    -framework "$framework_path" \
    -output "$xcframework_path" \
    >/dev/null

  echo "Zipping $target..."
  ditto -c -k --sequesterRsrc --keepParent "$xcframework_path" "$zip_path"

  checksum="$(swift package compute-checksum "$zip_path")"
  checksum_targets+=("$target")
  checksum_values+=("$checksum")
  printf '%s  %s\n' "$checksum" "$(basename "$zip_path")" >> "$checksums_file"

  if [[ $keep_intermediates -eq 0 ]]; then
    rm -rf "$archive_path" "$target_derived_data_dir" "$package_dir"
  fi
done

package_manifest="$output_dir/Package.swift"
{
  echo "// swift-tools-version: 5.9"
  echo "import PackageDescription"
  echo
  echo "let package = Package("
  echo "    name: \"$package_name\","
  echo "    platforms: [.macOS(.v14)],"
  echo "    products: ["
  for product in "${requested_products[@]}"; do
    product_targets=()
    while IFS= read -r target; do
      product_targets+=("$target")
    done < <(product_target_closure "$product")
    printf '        .library(name: "%s", targets: ' "$product"
    swift_array_literal "${product_targets[@]}"
    echo "),"
  done
  echo "    ],"
  echo "    targets: ["
  for target in "${build_targets[@]}"; do
    checksum="$(checksum_for "$target")"
    artifact_url="${base_url%/}/$target-$version.xcframework.zip"
    echo "        .binaryTarget("
    echo "            name: \"$target\","
    echo "            url: \"$artifact_url\","
    echo "            checksum: \"$checksum\""
    echo "        ),"
  done
  echo "    ]"
  echo ")"
} > "$package_manifest"

echo
echo "Wrote:"
echo "  $package_manifest"
echo "  $checksums_file"
for target in "${build_targets[@]}"; do
  echo "  $output_dir/$target-$version.xcframework.zip"
done
