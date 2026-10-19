set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
swiftc -emit-library -module-name NativeTextInput "$HERE/native_text_input.swift" -o "$HERE/libNativeTextInput.dylib"
