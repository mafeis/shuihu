# Steamworks 接入说明

## 已实现范围

桌面版已经接入可选的 `steamworks.js` 桥接层：

- Steam Achievements：19 项游戏战功映射到 Steam API 名称。
- Steam 成就资产：19 组中英文名称与说明，以及 38 张 64×64 已解锁/未解锁图标。
- Steam Stats：战斗、招募、演武、评鉴与二周目数据同步。
- Steam Cloud：保存当前 JSON 战卷，并在启动时比较本地与云端时间。
- Rich Presence：同步主菜单、章节、战斗、演武和终卷状态。
- Steam Overlay：配置 AppID 后启用，并可从设置页打开成就面板。
- 本地降级：没有 AppID、Steam 客户端未运行或平台不受支持时，游戏继续使用本地存档。

映射文件：

- `steam/steamworks.json`
- `steam/achievement_metadata.json`
- `steam/input_manifest.json`
- `store/steam_achievements/`

桥接代码：

- `electron/steam.cjs`
- `electron/main.cjs`
- `electron/preload.cjs`

## 云存档规则

1. 只有 Steam 客户端报告账号与应用均已启用 Cloud 时才会读写云端。
2. 启动时分别验证本地与云端 JSON，按 `lastSavedAt` 选择较新的有效存档。
3. 云端更新时，原本地战卷写入安全副本。
4. 本地更新时，在自动存档后延迟上传，减少连续操作产生的写入。
5. 删除存档会同时删除 Steam Cloud 文件。
6. 云存档上限由客户端限制，本作单份存档远低于 1 MiB。

## Steamworks 后台配置

在 Steamworks App Admin 中完成以下配置：

1. 按 `steam/steamworks.json` 的 `achievements` 值创建 19 个 API Name。
2. 按 `steam/achievement_metadata.json` 填写简中、英文本地化名称和说明。
3. 为每项成就上传 `store/steam_achievements/` 中对应的已解锁和未解锁 64×64 图标。
4. 按 `stats` 值创建 6 项整数统计。
5. 启用 Steam Cloud，并把文件模式配置为 `xingming-shuihu-save-v1.json`。
6. 配置 Rich Presence 本地化键，推荐使用 `#Status`、`#Mode`、`#Chapter` 与 `#Progress`。
7. 使用标准手柄布局接受自动映射；按键定义见 `steam/input_manifest.json`。

真实 AppID 与 DepotID 不属于仓库内容，不能使用占位值上传。取得后台 ID 后运行：

```bash
npm run steam:configure -- \
  --app-id 123456 \
  --windows-depot 123457 \
  --macos-depot 123458
```

该命令生成：

- `steam/steam_appid.txt`
- `steam/app_build.vdf`
- `steam/depot_build_windows.vdf`
- `steam/depot_build_macos.vdf`

随后重新构建桌面包。生成文件会进入桌面包，启动时用于初始化 Steamworks。

成就素材可随时从游戏数据重新生成：

```bash
npm run steam:achievements
npm run steamworks:verify
```

## 验收边界

`npm run steamworks:verify` 可以验证代码映射、原生模块、平台二进制和输入清单，但不能替代以下外部步骤：

- 在 Steamworks 后台创建成就与统计。
- 使用真实 AppID 从 Steam 客户端启动。
- 验证 Overlay、Cloud 冲突和成就服务器写入。
- 在干净 Windows x64 与签名 macOS 环境完成上传分支测试。

Windows 发行只使用 x64 Depot。1.0.2 起不再构建或发布 Windows ARM64 产物，1.0.3 延续此范围，避免维护缺少 Steamworks 原生绑定的额外兼容包。
