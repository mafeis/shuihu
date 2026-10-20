# AGENTS.md — 星命水浒：风雪山神庙

本文件是本仓库的**基础规则**，面向所有在此仓库工作的开发者与 AI 代理。它只规定「最基础、最不该被反复讨论」的部分：分支、门禁、目录职责、代码底线、存档与素材纪律、发行纪律。

更细的专题规则不写在这里，见文末[文档地图](#文档地图)。

**冲突时的优先级**：本文件 > `docs/` 下专题文档 > 历史提交习惯。发现本文件与现实不符（脚本改名、目录调整），先改本文件再改代码。

---

## 1. 项目是什么

一款以《水浒传》与北宋末年为背景的单机回合制 RPG。浏览器版（PWA 离线可玩）与 Electron 桌面版**共用同一套 `src/` 游戏源码**，不存在第二套渲染实现。

| 项 | 事实 |
| --- | --- |
| 语言 | JavaScript（ES Modules，`"type": "module"`）。**不引入 TypeScript** |
| 构建 | Vite 7，产物到 `dist/` |
| 前端框架 | **无**。DOM + Canvas 手写渲染，`src/main.js` 是视图与路由中枢 |
| 桌面壳 | Electron 44，`electron/main.cjs` + 沙箱化 `preload.cjs` |
| 单元测试 | `node:test` + `node:assert/strict`（无 Jest/Vitest） |
| 浏览器测试 | Playwright（`chromium`）+ 原生 Chrome CDP |
| 代码检查 | 只有 `node --check` 语法检查，**没有 ESLint / Prettier / EditorConfig** |
| 素材 | Git LFS 管理正式美术、音频、视频 |
| 包管理 | npm（`package-lock.json` 是唯一事实源，不用 pnpm/yarn） |

游戏运行时**不联网**：不连接 ComfyUI、不调用生成式模型服务。素材生产工具仅在开发者本机运行，通过环境变量 `COMFY_URL` 指向自建服务。

---

## 2. 分支模型

仓库只保留三条长期分支。分支数被刻意压到最小，**新增长期分支需要先改本节**。

| 分支 | 职责 | 说明 |
| --- | --- | --- |
| `main` | **唯一发行分支** | 所有发版 tag（`v1.0.x`）都在这里；CI 只在 `main` 与 PR 上跑 |
| `feat/phaser-engine` | Phaser 3 页面/战斗引擎实验分支 | 页面引擎与战斗引擎改用 Phaser 单场景；与 `main` 已分叉，**不要向 main 合并前不经评估** |
| `feat/godot-engine` | Godot 引擎移植分支 | 与 `main` 互不合并，独立演进 |

规则：

- **`main` 永远可构建、可发行**。任何时刻检出 `main` 都应能通过第 4 节的全部门禁。
- 日常修复与功能：从 `main` 拉短生命周期分支，形如 `fix/issue-<号>-<简述>` 或 `feat/<简述>`，合并后**立即删除**，不留历史分支。
- 三条长期分支的命名统一为 `feat/<引擎>-engine`；分支名要能看出用的什么技术栈，不要用 `v2`、`new`、`latest`、`final`、`work` 这类后缀（历史上 `canvas-battle-engine-v2`、`issue-2-battle-sfx-final/-latest/-local` 的重复分支已被清理，不要再造）。
- 禁止在 `main` 上做未经验证的大改造，禁止 force push `main`，禁止删除或移动已发布的 tag `v1.0.0`~`v1.0.4`。
- 不要用 worktree 长期挂多个分支副本；需要并行时用完即 `git worktree remove`。

---

## 3. 环境与启动

要求 Node.js 20+（CI 用 24）、npm 10+、Python 3（素材校验脚本）、Git LFS。

```bash
git lfs install && git lfs pull   # 缺了这步 assets/ 里全是 LFS 指针
npm ci                            # 不要用 npm install 改锁文件
npm run dev                       # Vite，http://localhost:5173/
npm run desktop:dev               # Vite + Electron 同时起
```

- 端口固定 `5173`（dev）、`4173`（preview / 浏览器测试）。测试脚本默认读 `GAME_ORIGIN=http://localhost:4173`。
- `assets/raw/`、`assets/prompts/`、`workflows/`、`artifacts/`、`release/`、`dist/`、`node_modules/` 均被 gitignore，属于本地产物或内部资产。
- 首次进入仓库先确认 `git lfs ls-files | wc -l` 不为 0，否则后续 `assets:verify` 会以「LFS 指针」形式失败。

---

## 4. 质量门禁

### 4.1 提交前最小集（任何改动都要跑）

```bash
npm run check:js     # 语法检查
npm test             # node --test tests/*.test.mjs
npm run build        # 必须能过，否则发行链路全断
```

### 4.2 按改动面追加

| 改动面 | 追加命令 |
| --- | --- |
| 素材 / `assets/manifest.json` | `npm run assets:verify` |
| 音频 | `npm run audio:verify` |
| Electron 壳 / 存档 / IPC | `npm run security:verify` |
| Steam 元数据 | `npm run steamworks:verify`、`npm run steam:ai:verify` |
| 布局 / UI / 战斗表现 | 对应 `npm run test:<子域>`（见 `package.json`），或 `npm run test:e2e` |
| 发行包 | `npm run release:verify` / `npm run release:browser:verify` |

### 4.3 CI 与完整门禁

- GitHub Actions（`.github/workflows/verify.yml`）在 `main` push 与所有 PR 上执行：`check:js → assets:verify → test → build → security:verify → steamworks:verify → steam:ai:verify`。**PR 必须全绿才可合并**。
- `npm run verify` 是超集（含 `check:py`、`check:swift`、`audio:verify`），只在 macOS + Swift 工具链齐全时跑得通，CI 不跑它。

### 4.4 `check:js` 是手写白名单——新增文件必须登记

`check:js` 里逐条列出 60 个 `node --check <file>`，**不会自动发现新文件**。

- 新增任何 `src/*.js`、`electron/*.cjs`、`tools/*.mjs`、`tests/*.mjs`，必须同时把 `node --check` 加进 `package.json` 的 `check:js`。
- 已知 13 个文件尚未纳入（`src/data.js`、`src/lore/finalRoster.js`、`heroRoster.js`、`heroStoryArcs.js`、`heroes108.js`、`rosterBase.js`、`rosterOverrides.js`、`rosterPatch.js`、`rosterSupplements.js`、`sceneMap.js`、`storyScenes.js`、`waterMarginChapters.js`、`waterMarginChronicle.js`）。**新增 `src/lore/*` 时顺手补齐**，不要继续扩大缺口。

### 4.5 测试文件命名即用途

| 命名 | 用途 | 被 `npm test` 收集 |
| --- | --- | --- |
| `tests/*.test.mjs` | 纯逻辑单元测试，不启浏览器 | ✅ |
| `tests/*_runtime_check.mjs` | Playwright 起真浏览器跑界面断言，截图落 `artifacts/qa/` | ❌ 需显式 `npm run test:<名>` |
| `tools/e2e_smoke.mjs` | 完整战役回归（需本机 Google Chrome，走 CDP） | ❌ `npm run test:e2e` |

写测试的硬要求：

- 只用 `node:test` / `node:assert/strict`，不引入测试框架。
- 纯逻辑优先：把可测逻辑做成 `src/*.js` 里的导出纯函数，视图层只调用不计算。**不要为了测试去 mock DOM**——界面类断言写进 `*_runtime_check.mjs`。
- 测试必须能单文件跑通：`node --test tests/battle.test.mjs`。
- 不允许提交 `test.only`、跳过断言、或把失败断言改成宽松断言。

---

## 5. 目录职责：代码该放哪里

| 路径 | 职责 | 允许放什么 |
| --- | --- | --- |
| `src/main.js` | 视图、路由、页面渲染中枢 | 页面组装与事件绑定；**不要**在此新增可被单元测试的业务规则 |
| `src/data.js` | 游戏静态内容（好汉、章节、敌人、招式、阵列…）的导出入口 | 只放数据与纯查表函数 |
| `src/lore/` | 好汉名册与剧情文本的源数据模块 | 纯数据，由 `data.js` 汇总导出 |
| `src/state.js` | 存档结构、初始化、迁移 | 唯一允许改存档格式的地方 |
| `src/battle.js` / `battle-vfx.js` / `auto-battle.js` | 战斗规则与表现 | 战斗数值规则必须是纯函数、可单测 |
| `src/arena-*.js`、`chapter-tactics.js`、`route-guide.js`、`equipment-recommendation.js` | 玩法子系统的纯逻辑 | 同上 |
| `src/audio.js`、`icons.js`、`ui-feedback.js`、`cinematic.js` | 音频、图标、反馈与演出 | 副作用集中处 |
| `src/styles.css` | 全部样式 | 单文件，不要引入 CSS-in-JS 或预处理器 |
| `electron/` | 桌面壳、存档落盘、Steamworks 桥接 | `main.cjs` 主进程、`preload.cjs` 白名单、`steam.cjs` SDK |
| `tests/` | 测试 | 见 4.5 |
| `tools/` | 素材生产、QA、打包、校验脚本 | 一次性脚本也放这里，**不要写进仓库根目录** |
| `public/` | PWA 清单、Service Worker、法律页、图标 | 直接被 Vite 复制到 `dist/` |
| `assets/` | 运行时美术/音频/视频（LFS） | 见第 7 节 |
| `store/`、`steam/` | 商店图、成就图、Steam 元数据与发行样例 | 见 `docs/steamworks_integration.md` |
| `docs/` | 设计与发行文档 | 改行为就同步改对应文档 |

**根目录清洁规则**：不要往仓库根目录新增文件。调试脚本命名 `tools/<用途>.mjs`，临时截图与抓图脚本放 `artifacts/`（已 gitignore），用完即删。历史上根目录曾堆积 64 个 `tmp-*.png` 与 17 个 `tmp-*/` 快照目录，不要再造。

---

## 6. 代码约定

- **纯 ESM**：`import`/`export`，不用 `require`（`electron/*.cjs` 除外，那是 CommonJS 入口）。
- **无框架、无编译期抽象**：不要引入 React/Vue/Svelte、状态管理库、CSS 框架。新增运行时依赖必须有明确理由，并同步 `docs/asset_package.md` 或本文件说明。
- **无 linter**：风格靠约定。沿用现有写法：2 空格缩进、双引号、语句末尾分号、`const`/`let`（无 `var`）、`===`、`Object.freeze` 冻结常量表。
- **数据与逻辑分离**：`data.js` 与 `src/lore/*` 只导出数据；规则函数放对应子系统模块；渲染放 `main.js`。三者不得混写。
- **副作用集中**：写存档、播音频、发 IPC 只在 `state.js` / `audio.js` / `preload` 桥接层发生，业务函数保持纯函数以便测试。
- **命名**：文件 kebab-case；导出常量 UPPER_SNAKE；函数/变量 camelCase。
- **错误处理**：存档损坏必须走恢复路径而不是抛白屏（见 `docs/security_hardening.md`）；面向玩家的错误提示用中文。
- **文本**：所有面向玩家的文案是简体中文；代码注释与提交信息可以中英混排，但同一处保持一致。
- **无障碍**：语义、焦点顺序、屏幕阅读器标签改动需对照 `docs/accessibility.md`。
- **不要提交**：`console.log` 调试残留、注释掉的整段旧实现、`TODO` 空壳（确需保留请写清条件）。

---

## 7. 存档兼容（最容易被破坏的底线）

- `src/state.js` 的 `SAVE_VERSION` 当前为 **28**。任何存档结构变更都必须 +1 并补 `migrateSave()`。
- 旧存档必须能升级：**加字段要给默认值，减字段要留兼容读取，禁止改变已有字段的语义**。
- 存档导出/导入/损坏恢复是发行级功能，改动后必须跑 `npm run test:e2e`（覆盖导出、导入、损坏恢复）与 `node tests/save_migration_runtime_check.mjs`。
- 不要把存档键（`SAVE_KEY`）写死在视图层，统一从 `state.js` 取。

---

## 8. 素材与 Git LFS

- `assets/manifest.json` 是运行时素材的**唯一事实源**（当前 393 条）。新增/替换素材必须同时更新 manifest，否则 `npm run assets:verify` 失败——它会检查条目文件存在且不是 LFS 指针。
- LFS 覆盖范围（`.gitattributes`）：`assets/**/*.{png,webp,mp3,mp4,wav}`、`store/**/*.{png,mp4}`。**新格式（如 `.ogg`、`.gif`）要先补 `.gitattributes`**，否则大文件会进主库历史。
- `assets/raw/`、`assets/prompts/`、`workflows/` 是内部生产资产，**不入公开仓库**。
- Vite 构建只复制 6 个目录：`audio`、`characters`、`enemies`、`environments`、`ui`、`video`，且**排除** `turnaround.png`。放在其他目录的资产不会进 `dist/`，新增目录必须同步 `vite.config.js`。
- 素材生成走 ComfyUI 流程，见 `docs/comfyui_asset_generation.md`；生成式资产披露同步维护在 `store/steam_ai_disclosure.json`（`npm run steam:ai:verify` 校验）。

---

## 9. 构建与发行

- `release/`、`dist/`、`artifacts/` **永不入库**。安装包、ZIP、`.blockmap`、QA 截图都不提交。
- 版本号只在 `package.json` 的 `version` 维护，与 tag 保持一致（当前 `1.0.4`）。升版本 = 改 `version` + 写 `docs/release_notes_v<版本>.md` + 更新 `RELEASES.md` 表格，三者必须同时改。
- 产物名由 `build.artifactName` 决定：`XingmingShuihu-${version}-${os}-${arch}.${ext}`。**不要手改** `appId`、`productName`、`artifactName`。
- 发行链路：`npm run build` → `release:browser` / `release:local` / `desktop:pack:mac` / `desktop:pack:win` → `release:checksums` → `release:verify`。
- 桌面包目前是 ad-hoc 签名、无公证、无 Authenticode，属于测试发行；正式上架门禁见 `docs/steam_release_checklist.md`。
- 打包只包含 `dist/**`、`electron/**`、`steam/**`、`build/icon.png`、`package.json`。新增运行时目录必须同步 `build.files`。

---

## 10. Electron 安全底线（不可放松）

`electron/main.cjs` 的窗口配置是**最低标准，只能更严不能更松**：

```js
contextIsolation: true
nodeIntegration: false
sandbox: true
webSecurity: true
```

- 渲染进程**不得**直接访问 Node/Electron API，一切能力经 `preload.cjs` 白名单方法暴露。
- 新增 IPC 必须：`preload` 显式暴露方法名 → 主进程 `ipcMain.handle` 做参数校验 → 不拼接任意路径、不执行任意命令。
- 外部链接一律经 `setWindowOpenHandler` 拦截，不在应用窗口内打开。
- 改动这些文件后必须跑 `npm run security:verify`（`tools/verify_release_hardening.mjs`）。

---

## 11. 提交与 PR

- 提交信息用 Conventional 前缀：`feat:` / `fix:` / `release:` / `docs:` / `test:` / `style:` / `chore:` / `refactor:`。示例：`fix: keep reward next-step action visible`、`release: prepare 1.0.2`。
- 一次提交只做一件事。引擎改造、素材替换、文案修订不要混在一笔里。
- 一个 issue 一个分支一个 PR；PR 描述写清：改了什么、怎么验证、跑了哪些门禁命令。
- 合并前确认：CI 全绿 + 本地最小门禁通过 + 相关 `docs/` 已更新 + 对应 issue 可关闭。
- 合并后用 `git branch -d` 删分支，不留 `-v2`、`-final`、`-latest` 之类的副本分支。

---

## 12. 禁止清单

以下行为一律不做：

1. 提交 `node_modules/`、`dist/`、`release/`、`artifacts/` 或任何 `.blockmap`/截图。
2. 手改 `dist/` 里的构建产物——它每次 `npm run build` 都会被覆盖。
3. 用 `npm install` 改 `package-lock.json` 而不说明原因；升级依赖需单独提交。
4. 在 `main` 上直接做大规模重构；`force push` `main`；删除/移动已发布 tag。
5. 放松第 10 节的 Electron 安全配置。
6. 绕过 `migrateSave()` 直接改 `SAVE_VERSION` 或字段语义。
7. 未经 manifest 登记就新增运行时素材，或把大文件绕过 LFS 提交。
8. 为了"让测试过"而削弱断言、跳过用例、或删除既有测试。
9. 在仓库根目录堆临时脚本、临时截图、临时快照目录。
10. 未经评估把 `feat/phaser-engine`、`feat/godot-engine` 的成果合并进 `main`。

---

## 13. 提交前自检

```
[ ] git status 里没有 tmp-*、截图、构建产物
[ ] 新增文件已加入 check:js（如需）
[ ] npm run check:js / npm test / npm run build 通过
[ ] 改动到素材 → assets:verify 通过且 manifest 已更新
[ ] 改动到存档 → SAVE_VERSION 已升、迁移已写、e2e 通过
[ ] 改动到 electron → security:verify 通过
[ ] 改动到界面 → 至少一个 runtime check 或 test:e2e 通过
[ ] 行为变了 → 对应 docs/ 与 (如发版) RELEASES.md、release_notes 已同步
[ ] 提交信息用了正确前缀，一笔只做一件事
```

---

## 14. 文档地图

| 想了解 | 看 |
| --- | --- |
| 开发环境、验证、浏览器回归细节 | `docs/development.md` |
| 玩法系统与数值设计 | `docs/game_design.md`、`shuihu_game_design.md` |
| 界面与交互规范 | `docs/game_design.md`；引擎化规范见 `docs/engine_ui_ux_guide.md`（**仅 `feat/phaser-engine` 分支有，main 上不存在**） |
| 素材清单与生产流程 | `docs/asset_package.md`、`docs/comfyui_asset_generation.md` |
| 浏览器发行与部署 | `docs/browser_release.md` |
| Steam 上架门禁与接入 | `docs/steam_release_checklist.md`、`docs/steamworks_integration.md` |
| 安全加固与存档恢复 | `docs/security_hardening.md` |
| 无障碍要求 | `docs/accessibility.md`、`docs/accessibility_en-US.md` |
| 隐私、EULA、商店文案 | `docs/privacy_statement.md`、`docs/eula.md`、`store/steam_page_*.md` |
| 历史 issue 与处理方式 | `docs/issue_tasks.md` |
| 发行文件与平台矩阵 | `RELEASES.md` |

---

## 15. 维护本文件

- 改分支模型、门禁命令、目录职责、安全配置、存档规则时，**先改本文件**，再改代码，同一笔提交里完成。
- 本文件保持「基础规则」定位。超过一屏的专题说明写进 `docs/`，这里只留结论与链接。
- 定期校正事实数字：`SAVE_VERSION`、`assets/manifest.json` 条目数、`check:js` 覆盖情况、当前版本号。
