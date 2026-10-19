# Godot 游戏版本

这是《星命水浒：风雪山神庙》的 Godot 4.7 原生游戏工程。战役内容来自仓库现有 `src/data.js`，通过以下命令生成：

```bash
node tools/build_godot_data.mjs
/Applications/Godot.app/Contents/MacOS/Godot --path godot --editor
```

推荐窗口为 `1440 × 900`。设置页的“江湖称号”使用 Godot 原生 `LineEdit` 接收系统文字输入，并提供复制中文、直接粘贴和保存。系统输入法没有进入游戏时，可用“粘贴中文”继续设置。旧版实验性 Swift 桥接源码暂不参与构建：

```bash
./godot/native_text_input/build.sh
/Applications/Godot.app/Contents/MacOS/Godot --path godot res://scenes/native_ime_runner.tscn
```

界面使用 Godot 原生 Control 节点和场景切换，不加载 Web 页面。运行所需图片和音频复制到 `godot/assets/`，再由上面的数据命令同步。
Godot 素材与源素材分开管理，两者都通过 Git LFS 提交。

界面组件使用固定版本的开源 Godot 项目，来源、许可证与文件哈希记录在 `godot/addons/*/UPSTREAM.md`：

- [Naddy's Extra Controls](https://github.com/don-tnowe/godot-extra-controls)：可折叠设置分区与表单控件，MIT。
- [ProtonControlAnimation](https://github.com/HungryProton/proton_control_animation)：现有 Control 节点的界面动画，MIT。

重新获取固定版本：

```bash
node tools/vendor_godot_ui_addons.mjs
```

角色列传包含三段异闻和独立终章战。终章会检查列传进度、章节和等级，胜利后把奖励与完成记录写入存档。

主工程可以双击 `godot/project.godot` 在 Godot 4.7 中打开。欢迎页、行军图、剧情、战斗、奖励、营寨、好汉和设置都是原生场景；设置页的“称号”输入框会自动聚焦。

```bash
/Applications/Godot.app/Contents/MacOS/Godot --path godot
/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot res://scenes/smoke_runner.tscn
/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot res://scenes/input_runner.tscn
/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot res://scenes/battle_runner.tscn
/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot res://scenes/save_runner.tscn
```

`export_presets.cfg` 提供 macOS 和 Windows 桌面导出预设，测试场景不会打包进正式游戏。导出的 Windows 版需要将同目录的 `星命水浒.exe` 与 `星命水浒.pck` 一起分发。
