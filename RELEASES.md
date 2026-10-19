# 发行文件

桌面安装包和浏览器发行 ZIP 体积较大，不进入源码仓库。GitHub 正式发行页保存可下载文件、校验值和首次打开说明。

| 平台 | 文件 | 系统要求 |
| --- | --- | --- |
| macOS Apple 芯片 | `XingmingShuihu-1.0.1-mac-arm64.dmg` | macOS 13.0+，Apple M 系列 |
| Windows x64 | `XingmingShuihu-1.0.1-win-x64.exe` | Windows 10/11 x64 |
| Windows ARM64 | `XingmingShuihu-1.0.1-win-arm64.exe` | Windows 11 ARM64 |
| 通用本地分享 | `XingmingShuihu-local-1.0.1.zip` | Node.js 20+ |

每个桌面平台同时提供 ZIP 免安装包。请按机器架构选择安装包：Apple M 系列使用 macOS ARM64，Intel Mac 当前没有对应桌面包。Windows x64 适用于大多数 PC，Windows ARM64 适用于 Snapdragon 等 ARM 设备。

macOS 本地测试包使用 ad-hoc 签名，没有 Apple Developer ID 签名和公证。首次打开时请右键应用并选择“打开”，或参考发行页中的说明。

Windows 本地测试包没有 Authenticode 证书，系统可能显示未知发布者提示。

## 构建安装包

```bash
npm ci
npm run desktop:pack:mac
npm run desktop:pack:win
npm run release:browser
npm run release:local
```

产物位于 `release/`，该目录不会提交到 Git。
