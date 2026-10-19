#!/bin/sh
set -e
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$here"
mkdir -p export/xingming-shuihu-macos export/xingming-shuihu-windows
/Applications/Godot.app/Contents/MacOS/Godot --headless --path "$here" --import
/Applications/Godot.app/Contents/MacOS/Godot --headless --path "$here" --export-release macOS export/xingming-shuihu-macos/星命水浒.app
/Applications/Godot.app/Contents/MacOS/Godot --headless --path "$here" --export-release Windows export/xingming-shuihu-windows/星命水浒.exe
codesign --force --deep --sign - export/xingming-shuihu-macos/星命水浒.app
ditto -c -k --sequesterRsrc --keepParent export/xingming-shuihu-macos/星命水浒.app export/xingming-shuihu-macos.zip
ditto -c -k --keepParent export/xingming-shuihu-windows export/xingming-shuihu-windows.zip
echo "macOS: $here/export/xingming-shuihu-macos.zip"
echo "Windows: $here/export/xingming-shuihu-windows.zip"
