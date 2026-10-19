# SteamPipe 发布配置

## 文件说明

- `app_build.vdf.example`：AppBuild 模板。
- `depot_build_windows.vdf.example`：Windows x64 Depot 模板。
- `depot_build_macos.vdf.example`：macOS ARM64 Depot 模板。
- `steamworks.json`：成就、统计与云存档映射。
- `input_manifest.json`：标准手柄按键定义。

取得真实后台 ID 后，不要手工修改占位模板。运行：

```bash
npm run steam:configure -- \
  --app-id 123456 \
  --windows-depot 123457 \
  --macos-depot 123458
```

该命令会生成 `steam_appid.txt` 和三个不带 `.example` 的 VDF 文件，并校验 ID 为正整数。随后替换需要调整的：

- `BuildOutput`
- `ContentRoot`

## 上传前检查

先复制并填写发行身份与 QA 回执：

- `steam/release_identity.example.json` -> `steam/release_identity.json`
- `steam/qa_attestations.example.json` -> `release/qa_attestations.json`

然后运行严格门禁：

```bash
npm run steam:preflight
```

该命令会核对真实 ID、SteamPipe 配置、macOS 签名与公证、Windows Authenticode，以及所有原生设备 QA 回执。只有在没有阻塞项时才返回 `ready`。

1. 使用 Windows 签名证书签署 `release/win-unpacked/星命水浒.exe`。
2. 在 Windows x64 原生环境完成启动、存档、自动战斗与通关测试。
3. 确认 `release/win-unpacked` 不包含开发文件、源码、日志和测试存档。
4. 使用 `steamcmd +login YOUR_STEAM_ACCOUNT +run_app_build <绝对路径>/app_build.vdf +quit`。
5. 在 Steamworks 后台把测试分支设为密码保护，再完成 Steam 客户端下载与启动验证。
6. 在 Steamworks 后台创建 `steamworks.json` 中登记的 19 项成就与 6 项统计。
7. 启用 Steam Cloud，文件模式设为 `xingming-shuihu-save-v1.json`。
8. 用带真实 AppID 的桌面包验证 Overlay、成就、Rich Presence 与云存档冲突。
9. 验证通过后才设置默认分支和正式上线时间。

macOS Depot 需要把路径分隔符转换成 SteamPipe 目标平台的格式，并在上传前确认 `.app` 内的可执行权限、符号链接与签名封条没有被破坏。

当前 Windows 与 macOS 产物仍没有使用真实发行证书签名，macOS 未完成有效公证，也没有真实 AppID，均不可直接上传为正式分支。

签名、公证所需环境变量和本机复核命令见 `docs/security_hardening.md`。macOS 包默认启用 Hardened Runtime 与 notarization 集成，Windows 包固定 SHA-256 摘要并配置 RFC 3161 时间戳；提供真实证书后重新打包，不要复用当前未签名产物。

详细实现与验收边界见 `docs/steamworks_integration.md`。
