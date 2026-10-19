# Godot 游戏版本

这是《星命水浒：风雪山神庙》的 Godot 4.7 原生游戏工程。战役内容来自仓库现有 `src/data.js`，通过以下命令生成：

```bash
node tools/build_godot_data.mjs
/Applications/Godot.app/Contents/MacOS/Godot --path godot --editor
```

推荐窗口为 `1440 × 900`。设置页的“江湖称号”提供原生中文输入、输入法候选显示、复制中文、直接粘贴和保存；若 macOS 输入法候选未跟随到游戏，可点击输入框重新聚焦或使用“粘贴中文”。原生桥接源码使用 Swift，可在 macOS 上重新构建：

```bash
./godot/native_text_input/build.sh
/Applications/Godot.app/Contents/MacOS/Godot --path godot res://scenes/native_ime_runner.tscn
```

界面使用 Godot 原生 Control 节点和场景切换，不加载 Web 页面。运行所需图片和音频复制到 `godot/assets/`，再由上面的数据命令同步。
Godot 素材与源素材分开管理，两者都通过 Git LFS 提交。

主工程可以双击 `godot/project.godot` 在 Godot 4.7 中打开。欢迎页、行军图、剧情、战斗、奖励、营寨、好汉和设置都是原生场景；设置页的“称号”输入框会自动聚焦。

```bash
/Applications/Godot.app/Contents/MacOS/Godot --path godot
/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot res://scenes/smoke_runner.tscn
/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot res://scenes/input_runner.tscn
/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot res://scenes/battle_runner.tscn
/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot res://scenes/save_runner.tscn
```

`export_presets.cfg` 提供 macOS 和 Windows 桌面导出预设，测试场景不会打包进正式游戏。导出的 Windows 版需要将同目录的 `星命水浒.exe` 与 `星命水浒.pck` 一起分发。
