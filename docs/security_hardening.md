# 桌面发行安全与签名加固

更新日期：2026-10-19

## 已实现的运行时防护

- 渲染进程启用 `contextIsolation`、Chromium sandbox 与 `webSecurity`，禁用 Node.js、`webview` 和拖放导航。
- 主窗口会拒绝摄像头、麦克风、定位、USB、串口、HID 与 Web Bluetooth 等权限请求；游戏只需标准 Gamepad API。
- 外部链接仅允许 `http://` 与 `https://`，并由系统浏览器打开；游戏窗口自身不能导航到外部站点。
- 打包态 `game://` 协议响应包含 CSP、COOP、CORP、Permissions Policy、Referrer Policy、`nosniff` 与 `X-Frame-Options: DENY`。
- `index.html` 同步包含 CSP 作为开发态与打包态的第二层约束。
- Windows 设置稳定的 `AppUserModelID`：`com.xingmingshuihu.game`。
- Electron 自带 Chromium、Electron 与 FFmpeg 许可文件；游戏设置页可查看项目补充的第三方软件许可。

运行静态验收：

```bash
npm run security:verify
```

该命令检查 50 项 CSP、权限策略、Electron 安全配置、macOS 权限文件、Windows 时间戳、公证集成与第三方许可完整性。它不能替代证书签名的实机验证。

## macOS 签名与公证

`electron-builder` 已配置：

- Hardened Runtime。
- `build/entitlements.mac.plist`，包含 Electron JIT、可执行内存与 Steam Overlay 注入所需权限。
- `@electron/notarize` 自动集成。
- 推荐使用 App Store Connect API Key：

```bash
export CSC_LINK="/absolute/path/DeveloperIDApplication.p12"
export CSC_KEY_PASSWORD="certificate-password"
export APPLE_API_KEY="/absolute/path/AuthKey_XXXXXXXXXX.p8"
export APPLE_API_KEY_ID="XXXXXXXXXX"
export APPLE_API_ISSUER="00000000-0000-0000-0000-000000000000"
npx electron-builder --mac --arm64
```

未提供公证环境变量时，内部候选包仍可生成，但 `npm run steam:preflight` 会因签名或公证无效而返回 `blocked`。正式上传前还必须执行：

```bash
codesign --verify --deep --strict --verbose=2 "release/mac-arm64/星命水浒.app"
spctl --assess --type execute --verbose=4 "release/mac-arm64/星命水浒.app"
xcrun stapler validate "release/mac-arm64/星命水浒.app"
```

## Windows Authenticode

`electron-builder` 已固定 SHA-256 摘要，并配置 DigiCert RFC 3161 时间戳服务。使用 Windows 代码签名证书时提供：

```bash
export WIN_CSC_LINK="/absolute/path/windows-signing.pfx"
export WIN_CSC_KEY_PASSWORD="certificate-password"
npx electron-builder --win --x64
```

在 Windows 原生环境确认主程序与 NSIS 安装包：

```powershell
Get-AuthenticodeSignature -LiteralPath "release\win-unpacked\星命水浒.exe"
Get-AuthenticodeSignature -LiteralPath "release\XingmingShuihu-1.0.2-win-x64.exe"
```

两项状态都必须是 `Valid`。当前仓库不包含证书、密码或 Apple/Valve 账号资料，不得把占位配置用于正式上传。

## 第三方许可

打包后的 `dist/THIRD_PARTY_NOTICES.txt` 与游戏设置页包含：

- Electron MIT 许可与 Chromium 许可文件位置。
- steamworks.js MIT 许可。
- Valve Steamworks SDK 与服务适用 Valve 条款的说明。
- Lucide ISC 许可。
- 项目生成式创作资产的人工审核与模型条款边界说明。

发行主体仍需在提交前核对所有 Qwen、MiniMax、YuE2、ComfyUI 自定义节点和训练数据依赖的商用条款。
