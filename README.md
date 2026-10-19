# 星命水浒：风雪山神庙

一款以《水浒传》人物与北宋末年为背景的单机回合制 RPG。游戏包含九回战役、四十位可结义好汉、三人阵位与四路克制战斗、二十八帖聚义、四十场群英列传、多结局战役，以及无尽演武和每周军令。

浏览器与 Electron 共用同一套游戏源码。桌面版支持 macOS、Windows 与 Linux 打包，浏览器版支持 PWA 离线启动。

## 运行

需要 Node.js 20 或更高版本，以及 Git LFS。

```bash
git lfs install
npm ci
npm run dev
```

打开 `http://localhost:5173/`。生产构建使用 `npm run build`，启动本地桌面测试使用 `npm run desktop:dev`。

## 验证

```bash
npm test
npm run build
npm run check:js
npm run security:verify
npm run steamworks:verify
npm run steam:ai:verify
```

需要 Google Chrome 的完整战役回归：

```bash
npm run test:e2e
npm run test:web
```

完整质量门禁与浏览器兼容测试见 [开发验证说明](docs/development.md)。

## 发行包

下载地址与平台说明见 [RELEASES.md](RELEASES.md)。安装包不进入源码仓库。

```bash
npm run release:browser       # 可部署站点、ZIP 和校验清单
npm run release:local         # 免安装本地分享包
npm run desktop:pack:mac      # macOS DMG 与 ZIP
npm run desktop:pack:win      # Windows x64 NSIS 安装包与 ZIP
```

正式上架仍需要 Apple Developer ID 签名与公证、Windows Authenticode 签名、运营主体信息和真实 Steam 配置，详见 [发行门禁](docs/steam_release_checklist.md)。

## 项目文档

- [开发验证](docs/development.md)
- [游戏设计](docs/game_design.md)
- [完整策划案](shuihu_game_design.md)
- [浏览器发行](docs/browser_release.md)
- [素材与生产](docs/asset_package.md)
- [ComfyUI 素材生产](docs/comfyui_asset_generation.md)
- [Steamworks 接入](docs/steamworks_integration.md)
- [安全加固](docs/security_hardening.md)
- [无障碍说明](docs/accessibility.md)
- [隐私说明](docs/privacy_statement.md)
- [最终用户许可协议](docs/eula.md)
- [Steam 商店文案](store/steam_page_zh-CN.md)

## 素材与制作

游戏使用 AI 辅助生产的美术、音乐和视频素材，生成式资产披露见 [store/steam_ai_disclosure.json](store/steam_ai_disclosure.json)。正式角色素材、音频与商店图由 Git LFS 管理；原始生成稿、QA 截图和内部 ComfyUI 工作流不进入公开仓库。

首次使用 Git LFS 的设备需要先初始化：

```bash
git lfs install
git clone https://github.com/mafeis/shuihu.git
git lfs pull
```

GitHub 自动生成的 “Download ZIP” 只包含 LFS 指针，不包含实际素材。需要完整源码时请使用 Git 克隆；只想直接运行或分享时，请下载 [发行页](https://github.com/mafeis/shuihu/releases/latest)中的完整安装包。

游戏运行时不会连接 ComfyUI 或生成式模型服务。本地素材生产工具通过 `COMFY_URL` 环境变量指定自建服务地址，使用说明见 [ComfyUI 素材生产](docs/comfyui_asset_generation.md)。

## 目录

```text
src/                 游戏逻辑与界面
electron/            桌面壳、存档与 Steamworks 桥接
public/              PWA 清单、离线 Worker 与发行文档
assets/              正式运行时美术、音频与视频
store/               Steam 商店图、成就图与发行文案
steam/               Steamworks 元数据与发行样例
tests/               单元测试
tools/               素材、QA 与打包工具
docs/                设计、发行与安全文档
```
