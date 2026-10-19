# 开发与验证

## 环境

- Node.js 20 或更高版本
- npm 10 或更高版本
- Python 3，用于素材与音频校验
- Git LFS，用于获取正式美术和音频

```bash
git lfs install
npm ci
npm run dev
```

开发服务器默认使用 Vite 的 `http://localhost:5173/`。本地生产预览使用 `npm run preview`。

## 快速门禁

```bash
npm run check:js
npm test
npm run build
npm run security:verify
npm run steamworks:verify
npm run steam:ai:verify
```

`npm run verify` 还会执行 Python 与 Swift 类型检查、音频校验。它需要 macOS 下的 Swift 工具链和 Python 依赖。

## 浏览器回归

`npm run test:e2e` 需要本机安装 Google Chrome。它会从林冲 `Lv.1` 开始，依靠章节奖励和一百零八帖聚义集齐一百零八位好汉，连续完成 28 回长卷、招贤战、战后奖励与三个结局。

回归覆盖：

- 首战教学、三段异闻、林冲群英列传与二周目继承。
- 自动战斗、四套战法和 `1x / 2x / 4x` 速度。
- 19 种临阵战意、兄弟契、命途、命途战斗提示与星命合击。
- 三道星劫、八种官军军势、阵法图鉴、演武四周结算与恢复。
- 章节评鉴、军师荐令、战后战报、周令固定牌池与奖励页重启。
- 存档导出、导入、损坏恢复与标准虚拟手柄导航。
- 1080p、1440p、4K、16:10 和 390px 视口下的地图、异闻、设置、战斗与奖励页。
- 文字裁切、横向溢出、面板遮挡与图片等比缩放。
- PWA Manifest、Service Worker 激活与断网刷新。

```bash
npm run test:e2e
npm run test:web
npm run browser:install
npm run test:browsers
```

截图保存在 `artifacts/qa/`，该目录不进入源码仓库。

## 发行

```bash
npm run release:browser
npm run release:browser:verify
npm run desktop:pack:mac
npm run desktop:pack:win
npm run release:local
```

正式商店上传使用 `npm run steam:preflight` 复核真实 AppID、DepotID、签名、公证与外部回执。详见 [Steam 发行门禁](steam_release_checklist.md)与[桌面发行安全加固](security_hardening.md)。
