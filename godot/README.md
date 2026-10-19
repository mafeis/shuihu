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

- [TNowe Extra Controls](https://github.com/don-tnowe/godot-extra-controls)：可折叠设置分区与表单控件，MIT。
- [ProtonControlAnimation](https://github.com/HungryProton/proton_control_animation)：现有 Control 节点的界面动画，MIT。

主界面沿用 Godot 原生 `Control` 布局和可聚焦按钮，不引入整套仿 Web 的 UI 框架。这样键盘、手柄、鼠标和触屏可以共用同一套焦点与操作逻辑；开源插件只承担动效和少量表单控件，减少上游框架与战斗界面的耦合。

营寨中的“星命研学”包含三项好汉试炼和两条命途，试炼与命途会进入战斗；“梁山功簿”收录 19 项跨周目成就；“聚义帖”包含 28 份带前置条件、剧情抉择和独立战斗的招贤帖。首通章回会收录临阵战意，通关后可携星图开启新周目，并保留功簿、试炼、命途、战术与设置。

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
/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot res://scenes/campaign_runner.tscn
```

`export_presets.cfg` 提供 macOS 和 Windows 桌面导出预设，测试场景不会打包进正式游戏。导出目录位于工程外的 `artifacts/`，避免 Godot 扫描导出临时目录后把错误内容打进包中。导出的 Windows 版需要将同目录的 `xingming-shuihu-windows.exe` 与 `xingming-shuihu-windows.pck` 一起分发。
