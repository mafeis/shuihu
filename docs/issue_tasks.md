# GitHub Issue 处理清单

更新于 2026-10-19。已处理的 issue 均保留在下方清单中，GitHub 当前仍有 #22、#23、#24 处于 OPEN 状态。点击动效、推荐装备和桌面开发启动问题仍未完成。

| Issue | 分支 | 状态 | 验证与合并 |
| --- | --- | --- | --- |
| #1 战斗太单薄了 | `fix/issue-1-combat-feedback` | 已完成 | PR #4，合并提交 `e47ba53` |
| #2 没有战斗音效啊 | `fix/issue-2-battle-sfx-clean` | 已完成 | PR #6，合并提交 `947eb4f` |
| #3 人物应该增加轮廓线。 | `fix/issue-3-contour-refine` | 已完成 | PR #7 与 #10 已合并，合并提交 `c2c8622` |
| #5 滚动条问题 | `fix/issue-5-scrollbars` | 已完成 | PR #12，合并提交 `246150b` |
| #8 战斗和数值问题 | `fix/issue-8-battle-progression` | 已完成 | PR #15，合并提交 `6df5f5c` |
| #9 UI及UE优化问题 | `fix/issue-9-inventory-ui` | 已完成 | PR #14，合并提交 `9507ca0` |
| #13 营寨优化问题 | `fix/issue-13-camp-grid` | 已完成 | PR #16，合并提交 `8f8d7ca` |
| #17 好汉介绍页面 | `fix/issue-17-hero-biography` | 已完成 | PR 已合并，issue 已关闭 |
| #18 战斗特效与阵容表现 | `fix/issue-18-battle-vfx-layout` | 已完成 | 分支已合入主线，issue 已关闭 |
| #19 开局的动画不够精细 | `fix/issue-19-opening-cinematic-endings` | 已完成 | 分支已合入主线，issue 已关闭 |
| #22 增加 UI 点击动效 | 待独立分支 | OPEN | 尚无独立实现，不计入 1.0.1 完成项 |
| #23 增加推荐装备功能 | 待独立分支 | OPEN | 尚无独立实现，不计入 1.0.1 完成项 |
| #24 npm run desktop:dev 报错 | 待独立分支 | OPEN | 尚无独立实现；本次发行独立完成桌面打包 |

每个 issue 使用独立分支和 PR。完成标准为相关测试、构建与 GitHub Actions 全部通过，并在合并后确认 issue 自动关闭。1.0.1 桌面发行不宣称解决 #22、#23、#24。
