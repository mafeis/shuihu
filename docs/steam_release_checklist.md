# 《星命水浒》Steam 发行门禁

## 当前候选包

版本：`1.0.2`，候选构建日期：`2026-10-19`

| 平台 | 产物 | 大小 | 状态 |
| --- | --- | ---: | --- |
| macOS ARM64 | `release/mac-arm64/星命水浒.app` | 445 MiB | 显式 ad-hoc 签名与 Hardened Runtime，未公证 |
| macOS ARM64 | `release/XingmingShuihu-1.0.2-mac-arm64.dmg` | 244.33 MiB | 显式 ad-hoc 签名与 Hardened Runtime，未公证 |
| macOS ARM64 | `release/XingmingShuihu-1.0.2-mac-arm64.zip` | 254.67 MiB | 免安装包 |
| Windows x64 | `release/XingmingShuihu-1.0.2-win-x64.exe` | 238.89 MiB | NSIS 安装包，未使用 Authenticode 证书 |
| Windows x64 | `release/XingmingShuihu-1.0.2-win-x64.zip` | 279.38 MiB | 免安装包 |

当前产物用于内部测试、公开发行与商店材料制作，不应直接作为正式 Steam 构建上传。1.0.2 起不再发布 Windows ARM64 产物。

## 已完成验收

- `npm run verify`：JavaScript、Python、Swift 静态检查、桌面发行安全加固、189 项运行时资产、10 首配乐与 10 枚战斗音效、Steamworks 配置、生成式 AI 披露、136 项单元测试与 Vite 生产构建通过。
- 1.0.2 发布前的完整战役 E2E 已执行到战斗特效与移动端布局断言，但后续在“玉麟出府”和“连环退军鼓”出现随机自动战败超时，因此不把该次运行记作完整 E2E 通过；相关目标选择、辅助循环、推荐阵型与残局规则由单元测试和运行态检查覆盖。
- 星劫浏览器回归覆盖六道风险规则展示、按最高波次解锁、三道同时启用上限、出阵确认、战斗 HUD、军功与资源倍率、永久纪录、奖励页保留和跨重启续局。
- `npm run test:web`：生产构建中的 Web App Manifest、192px/512px 安装图标、Service Worker 激活与断网刷新进入标题界面通过；开发态不会注册 Service Worker。
- `npm run release:browser`：生成 214 文件、136,179,776 字节的可部署浏览器站点与 135,271,542 字节 ZIP；角色制作转身图与内部生成提示词清单不进入玩家包。
- `npm run release:browser:verify`：逐文件 SHA-256、ZIP 校验和、PWA 入口、四份发行文档、40 位好汉三套运行时资产、Service Worker 版本与敏感文件排除规则通过。
- `npm run steam:screenshots`：由真实浏览器战役回归重新生成 5 张 1920×1080 商店实机图；当前内容为 9 回、40 位好汉、38 组兄弟契、27 枚评鉴、8 种官军军势与 19 项战功。
- `npm run visual:qa:xuning`：徐宁招贤卡、剧情立绘、招募战、正式战斗立绘与 40 人星图在 1920px 和 390px 下保持 `object-fit: contain`、完整可见、无横向溢出、无节点重叠。
- `npm run release:checksums`：由当前桌面包重新生成 4 条 SHA-256。
- `npm run release:verify`：4 条 SHA-256、12 个发行产物、214 个构建文件与 2 个 `app.asar` 内容对比通过。
- Windows x64 安装包和免安装包均已从最新生产构建重新生成，macOS 与 Windows x64 两个桌面包内的 214 个构建文件与当前 `dist` 逐文件哈希一致。
- 桌面包通过自定义 `game://` 协议启动。
- 最新 macOS 原生包在隔离配置下使用不可用代理断网启动成功，首战教学与自动战斗正常推进。
- 当前源码存档版本为 27；1.0.2 的 macOS 与 Windows x64 桌面包均已用当前源码重新打包。
- 最新 macOS 原生包在隔离存档中破坏主存档后，可从备份恢复到“黄河夜渡”进度。
- `assets/manifest.json` 中 189 项运行时资产均可读取，共 212,718,159 字节。
- 最终战 17 张可见图片无损坏；敌我与好汉立绘均保持等比缩放。
- 星图 40 个节点与 9 章评鉴总览对齐，可见图片无损坏、无 `fill` 拉伸。
- 390px 视口下星图 40 个节点无重叠、9 章评鉴标签无截断、无横向溢出。
- 390px 异闻页与群英列传临阵页无横向溢出；列传卡、背景图和出征按钮不裁切、不拉伸，按钮完整位于视口内。
- 390px 演武战斗与奖励页中，军势 HUD、悬赏、S/A/B 战报、当先立绘、三选一军令和建议按钮无重叠、无文字裁切、无图标错位、无横向溢出；可见图片均保持原始宽高比，并输出截图供人工目检。
- `1x / 2x / 4x` 自动战斗完成最终战并进入奖励页。
- 沧州押差与江州行刑官半血阶段均触发正确状态与战报。
- 十首音乐与标题、江湖、聚义帖、清风寨、江州、普通战斗、首领战、终卷场景路由通过；十枚战斗一次性音效的开战、刀击、重击、齐射、守御、闪避、恢复、终式、胜利与败北事件均完成解码和母带验收。
- 19 项永久战功可解锁、只发一次奖励，并在新周目保留。
- 九回共 27 枚战卷评鉴可累计、只发一次奖励，并在新周目保留。
- 40 场群英列传均有独立剧情、敌阵、场景、敌人修正、专属战意与唯一奖励；二十八帖聚义招贤按回目动态开放，各有一次剧情取舍、专属战意、唯一装备且奖励只结算一次。残血守阵、前阵反击、龙纹追枪、群体破势、飞石弹射、钩镰锁阵、义气护援、云龙护阵、满血增伤、水战闪避、开局护御、鼓舞开阵、敌方预破甲、状态延展、自损追斩与击杀回血等规则由引擎触发，临阵页和战斗 HUD 可读，解锁条件、非法存档清洗、胜利结算、永久归档、Steam Deck 布局和二周目继承通过单元与浏览器回归。
- 标题视频暂停、加载失败或后台播放受阻时，静态汴京原画保持可见。
- 22 项 Steam 商店素材通过尺寸、透明通道和视频编码校验。
- `npm run steamworks:verify`：19 项成就、38 张 64x64 成就图标、6 项统计、3 个原生模块目标与 15 个手柄动作映射通过。
- `npm run steam:ai:verify`：189 项运行时资产中的 177 项生成式资产披露清单通过，22 个运行时文件确认不含 ComfyUI、生成节点或模型端点。
- `npm run security:verify`：93 项 CSP、PWA 安装边界、离线 Worker、权限拒绝、Electron 沙箱、macOS 显式 ad-hoc 身份、Hardened Runtime、主程序与辅助进程权限、Windows SHA-256 时间戳和第三方许可检查通过。
- 设置页可读取 `THIRD_PARTY_NOTICES.txt`，其中包含 Electron、Chromium、steamworks.js、Valve Steamworks SDK 与 Lucide 许可说明。
- Steam Achievements、Stats、Cloud、Rich Presence 与 Overlay 的桥接层已实现，无 Steam 环境自动降级为本地存档。
- 本地诊断日志、渲染故障页、资源加载错误与存档写入失败提示已实现。

## 正式上传前必须完成

正式候选包使用以下门禁复核。任何外部信息、证书或原生设备回执缺失时都会返回 `blocked`，不会把内部测试包误判为可上传包：

```bash
npm run steam:preflight
```

输入模板：

- `steam/release_identity.example.json`：发行主体、支持信息、真实 AppID 与 DepotID。
- `steam/qa_attestations.example.json`：签名候选包的 Windows、macOS、Steam 客户端、手柄、触屏与 Steam Deck 回执。

### 账号与签名

- [ ] 获取真实 Steam AppID 与 DepotID。
- [ ] 使用 Apple Developer ID Application 证书签名 macOS 包。
- [ ] 完成 macOS notarization 与 stapling。
- [ ] 使用 Windows Authenticode 代码签名证书签署安装包与主程序。
- [ ] 为 Windows 签名配置可信时间戳。
- [x] 预配置 macOS 显式 ad-hoc 签名、Hardened Runtime 与 Electron 主程序/辅助进程权限文件；本版本不声明 Developer ID 签名或公证。
- [x] 预配置 Windows Authenticode SHA-256 与 RFC 3161 时间戳。
- [ ] 在干净 macOS 与 Windows 机器或虚拟机上完成安装、卸载和启动测试。

### Steamworks

- [ ] 配置 SteamPipe 的 `app_build.vdf` 与 `depot_build.vdf`。
- [x] 决定接入 Steam Achievements、Stats、Cloud Saves 与 Rich Presence。
- [x] 完成成就、统计、云存档、Rich Presence 与 Overlay 代码桥接。
- [x] 完成 19 项成就中英文元数据与 38 张正式成就图标。
- [x] 完成标准手柄动作清单与浏览器 Gamepad API 映射。
- [ ] 在 Steamworks 后台创建真实成就、统计、Cloud 路径与 Rich Presence 本地化键。
- [ ] 使用真实 AppID 从 Steam 客户端验证成就、Overlay、Cloud 冲突与离线回退。
- [ ] 在 Steam Input 配置器中保存并实机验证标准手柄模板。
- [ ] 配置支持的语言、启动参数和默认分支。
- [ ] 生成并核对每个 Depot 的文件清单。

### 商店页面

- [x] 商店胶囊图、库页图、主视觉与背景图。
- [x] 5 张 1920×1080 实机截图。
- [x] 29 秒 H.264 1080p 首发预告片母版。
- [x] 英文 Header、Small、Main、Vertical、Library、Hero、Logo 与背景胶囊图。
- [x] 中文与英文商店简介、玩法说明、标签和系统需求草案。
- [ ] 内容调查、年龄分级与地区合规确认。
- [x] 隐私说明与最终用户许可协议草案。
- [x] 生成式 AI 内容调查稿、资产披露清单与运行时无生成端点校验。
- [ ] 发行主体、支持联系方式与 EULA 法律审阅。
- [x] 中英文可访问性说明，包括音量、文字速度、降低动态效果和自动战斗。
- [ ] 英文实机截图、英文预告片与最终市场本地化审校。

### 最终 QA

- [x] 用当前源码生成 macOS ARM64 与 Windows x64 最终包，并复核存档版本 27、四套自动战法、二十八帖聚义、40 位好汉与全部 214 个当前构建文件已进入桌面包。
- [ ] Windows x64 原生环境完整九章通关。
- [ ] macOS 签名包完整九章通关。
- [x] 存档导出、损坏导入拒绝、有效导入安全副本与主存档损坏恢复已通过真实浏览器回归；旧档迁移由单元测试覆盖。
- [ ] 当前 ad-hoc 签名候选包仍需完成断网启动与打包态存档恢复复验。
- [x] 1080p、1440p、4K、16:10 与 390px 视口下，最大字号和高对比的地图、设置页无横向溢出或卡片裁切。
- [x] 自动战斗、均衡 / 破阵 / 守势 / 追残战法、`1x / 2x / 4x`、演武自动续阵、奇遇暂停、键盘切换与触屏按钮回归。
- [ ] 标准手柄全流程与实体触屏设备回归。
- [x] 浏览器标准 Gamepad 虚拟回归：方向导航、确认、返回、自动战斗、战法轮换、倍速、暂停与战功入口。
- [x] 浏览器 PWA 安装清单、根作用域、独立窗口模式、安装图标与生产 Service Worker 校验。
- [x] 浏览器版在生产构建中完成 Service Worker 接管后的断网刷新。
- [x] 十首配乐与十枚战斗音效的编码、时长、响度、真峰值、解码峰值、循环边界、切歌、静音与音量持久化回归。
- [x] 本地诊断日志、白屏恢复页、资源加载错误与存档写入失败提示。
- [ ] 在真实 Steam 运行环境验证诊断日志与崩溃恢复。
- [ ] 为浏览器版配置正式 HTTPS 域名、CDN 缓存策略与版本更新通道。
- [x] Playwright Firefox 157 与 WebKit 27.2 完成浏览器兼容性回归。
- [ ] 完成真实 Safari、iOS 与 Android 设备的浏览器兼容性回执。

## 发布判定

只有以上“账号与签名”“Steamworks”和“最终 QA”全部完成后，候选包才可以进入 Steam 审核。商店文案、截图和内部功能验收不能替代真实证书、AppID、平台原生测试和 Valve 审核。
