# 浏览器发行与安装

《星命水浒》的浏览器版本以静态站点方式交付。生产构建包含 Web App Manifest、安装图标与离线 Service Worker，可通过支持的 Chromium、Safari 或 Firefox 浏览器直接游玩，也可以在支持 PWA 安装的桌面或移动浏览器中作为独立窗口安装。

## 构建与验证

```bash
npm run build
npm run test:web
npm run browser:install
npm run test:browsers
npm run release:browser
npm run release:browser:verify
npm run browser:preflight
```

`npm run test:web` 会启动生产预览，重新执行完整九回战役与发行布局回归，并额外验证：

- `/manifest.webmanifest` 可读取，名称、根作用域、独立窗口模式与三枚安装图标有效。
- `/sw.js` 在 HTTPS 或 localhost 安全上下文中激活。
- 页面由 Service Worker 接管后，断网刷新仍能进入标题界面。
- 开发服务器不会注册 Service Worker，避免本地热更新读到旧缓存。

## 浏览器兼容回归

`npm run test:browsers` 使用 Playwright 启动生产预览，并分别运行 Firefox 与 WebKit。当前基线为 Firefox 157.0 与 Playwright WebKit 27.2：

- 1440×900 标题页只加载八张精选好汉缩略图，八张图片请求地址互不重复，不加载 `/cutout.png` 高分辨率立绘。
- 每张标题人物图使用 `object-fit: contain` 与底部居中对齐，并检查自然尺寸、渲染尺寸、视口边界与页面横向溢出。
- 标题海报只产生一次正式请求，避免预加载、CSS 与视频海报重复下载。
- 桌面设置页至少显示十一张核心设置卡，卡片与页面均不得产生横向裁切。
- `4x` 战斗速度写入存档，刷新页面后仍保持选中。
- 隐私说明支持滚动和键盘聚焦，弹窗保持在当前视口内。
- Service Worker 激活并接管页面后，断网刷新仍能显示标题界面。
- 390×844 视口下设置页完整可用，卡片、分段控件与底部导航不产生横向溢出。
- `prefers-reduced-motion: reduce` 会停止标题环境视频、关闭页面平滑滚动并写入减少动态界面状态。
- 页面脚本异常、非预期控制台错误和失败网络请求会中止回归。

截图输出到 `artifacts/qa/browser/shuihu-firefox-*.png` 与 `artifacts/qa/browser/shuihu-webkit-*.png`。

Playwright WebKit 是 Safari 引擎级自动化，不等同于真实 Safari 人工验收；390×844 是移动视口回归，不等同于真实 iOS 或 Android 设备回归。两者仍需在正式发行前分别保留人工回执。

## 浏览器发行包

`npm run release:browser` 会先重建生产站点，再生成：

- `release/browser/XingmingShuihu-web-1.0.0/site/`：可直接上传到站点根目录的完整游戏。
- `release/browser/XingmingShuihu-web-1.0.0/XingmingShuihu-web-1.0.0.zip`：约 135 MiB 的浏览器发行压缩包。
- `release-manifest.json`：版本、作用域、构建哈希、203 个站点文件的大小与 SHA-256。
- `SHA256SUMS.txt`：发行 ZIP 校验和。
- `deploy/_headers`：Netlify、Cloudflare Pages 等平台使用的 CSP、缓存与 MIME 响应头。
- `deploy/nginx.conf.sample`：Nginx HTTPS 配置样例，部署前需替换域名、证书与站点根目录。
- `DEPLOYMENT.md`：上传与发布后检查清单。

生产站点约 141.9 MB，包含 40 位好汉的运行时立绘、关键原画、缩略图、章节场景、敌人、UI、视频和 10 首音乐。角色转身设定图属于制作参考，不进入浏览器包；内部 `assets/manifest.json` 含生成记录与提示词，也不进入玩家站点。

`npm run release:browser:verify` 会逐文件复核大小和 SHA-256、ZIP 校验和、PWA 入口、四份发行文档、40 位好汉的 `cutout/keyart/thumb` 三套运行时资产、Service Worker 版本，并拒绝转身设定图、源图、Source Map、开发服务器地址和内部生产资产清单进入发行包。

## 浏览器发行预检

`npm run browser:preflight` 把内部可自动验证的项目与必须由发行方提供的材料分开。正式身份模板见 `store/browser_release_identity.example.json`，真实设备与完整流程回执模板见 `store/browser_qa_attestations.example.json`。

正式预检要求：

- 正式发行主体、支持邮箱、支持 URL、销售 URL、隐私联系人、适用法律、发行地区和币种。
- 隐私、EULA、消费者权利与生成式资产商用条款完成人工确认。
- QA 回执的 `buildHash` 与当前发行包一致。
- Firefox、WebKit、离线刷新与完整战役自动化回执。
- 真实 Safari 桌面、iOS Safari、Android Chrome 与触屏控制回执。

缺少任何外部材料时预检返回 `blocked`，不会把内部构建误判为可以公开销售。

## 部署

将 `dist/` 全量发布到 HTTPS 静态站点，并以站点根路径作为游戏地址。Manifest 与 Service Worker 当前使用根作用域 `/`；若必须部署在 `/game/` 子路径，需要同步修改 Vite `base`、Manifest 的 `start_url`/`scope`、图标路径与 Service Worker 注册路径，不作为默认发行方式。

建议服务器配置：

| 路径 | 缓存策略 |
| --- | --- |
| `/index.html` | `no-cache` |
| `/sw.js` | `no-cache`，响应类型 `text/javascript` |
| `/manifest.webmanifest` | `no-cache`，响应类型 `application/manifest+json` |
| `/assets/*.js`、`/assets/*.css` | `public, max-age=31536000, immutable` |
| 角色、场景、敌人、UI、音乐 | `public, max-age=604800` |

推荐响应头：

```text
Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; worker-src 'self'
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), fullscreen=(self)
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
```

页面自身已经包含同名 CSP。服务器响应头可作为部署侧的额外防护，但不得放宽到第三方脚本、远程生成端点或未声明媒体源。

## 离线行为

- 首次联网访问会缓存应用外壳、安装图标、脚本、样式和已加载的静态游戏素材。
- 视频与字节范围媒体请求不进入缓存，避免大文件流式播放与缓存冲突。
- 已到访过的章节、角色、场景和音乐可以在断网后继续使用；首次在线未加载的内容可能仍需要网络。
- 存档保存在浏览器站点的 `localStorage` 与备份键中。清除站点数据会删除本地存档，玩家应使用设置页的存档导出功能保留进度。
- 游戏运行时不会调用 ComfyUI、生成式模型或开发服务器。

## 发布门禁

- [x] Web App Manifest 与 192px、512px 安装图标。
- [x] 根作用域独立窗口安装。
- [x] 生产构建 Service Worker 激活。
- [x] 断网刷新回到标题界面。
- [x] 开发环境不注册 Service Worker。
- [x] 浏览器安装与离线状态纳入生产 E2E 输出。
- [x] 设置页提供隐私、最终用户许可、支持与退款文档入口。
- [x] 上述发行文档进入离线应用外壳，并在真实浏览器回归中检查可读性与视口边界。
- [x] 标题页使用 40 张透明 WebP 缩略资产中的八人精选构图，不再加载全部高分辨率立绘。
- [x] Safari 27 人工冒烟通过标题、八人缩略图、设置页、隐私弹窗与首次点击后的音乐解锁。
- [x] Playwright Firefox 157.0 通过桌面、移动视口、离线、减少动态与资产缩放回归。
- [x] Playwright WebKit 27.2 通过桌面、移动视口、离线、减少动态与资产缩放回归。
- [x] 生产标题首屏实测约 2.63 MB，其中八张人物缩略图约 365 KB，116 KB WebP 海报只请求一次。
- [x] 生成可部署站点、约 135 MiB ZIP、逐文件 SHA-256、构建哈希和部署响应头配置。
- [x] 浏览器包排除约 72 MB 制作转身图、内部生成提示词清单、源图与 Source Map。
- [x] 浏览器预检在正式身份、法务确认和真实设备回执缺失时返回 `blocked`。
- [ ] 正式域名、HTTPS 证书与 CDN 缓存策略。
- [ ] 真实 iOS 与 Android 设备最终兼容性回归。
- [ ] 浏览器商店或自营站点的隐私、退款、支持与版本更新条款审阅。
