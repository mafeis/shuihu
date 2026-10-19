# Steam 商店素材

## 游戏截图

| 文件 | 内容 |
| --- | --- |
| `steam_assets/screenshots/01_title.png` | 标题界面 |
| `steam_assets/screenshots/02_campaign_map.png` | 清风寨行军图与队伍信息 |
| `steam_assets/screenshots/03_qingfeng_story.png` | 清风寨群像叙事与场景 |
| `steam_assets/screenshots/04_qingfeng_battle.png` | 自动战斗与四倍速首领战 |
| `steam_assets/screenshots/05_star_codex.png` | 四十位好汉星图 |

全部截图均为 1920×1080，来自实际运行版本。

## Steam 图像槽位

| 文件 | 尺寸 | Steam 用途 |
| --- | --- | --- |
| `steam_assets/header_capsule.png` | 920×430 | Header Capsule |
| `steam_assets/small_capsule.png` | 462×174 | Small Capsule |
| `steam_assets/main_capsule.png` | 1232×706 | Main Capsule |
| `steam_assets/vertical_capsule.png` | 748×896 | Vertical Capsule |
| `steam_assets/library_capsule.png` | 600×900 | Library Capsule |
| `steam_assets/library_hero.png` | 3840×1240 | Library Hero |
| `steam_assets/library_logo.png` | 1280×720 RGBA | Library Logo |
| `steam_assets/page_background.png` | 1438×810 | Page Background |

同一目录下带 `_en` 后缀的文件是对应英文商店图。英文网页与英文预告片仍需在游戏完成英文本地化后另行渲染。

## 预告片

`steam_assets/trailer_1080p.mp4` 为 29 秒、1920×1080、30fps、H.264、AAC 立体声，适合作为 Steam 首发预告片母版。正式上传前应再制作一版带英文卡片的国际化版本。

## 重新生成

先保持 `http://localhost:4173/` 运行：

```bash
npm run steam:art
npm run steam:screenshots
npm run steam:trailer
npm run steam:verify
```

胶囊图和 Logo 由 `store/steam_assets.html` 使用游戏自有场景与透明立绘渲染。`steam:screenshots` 会执行真实浏览器战役回归，并从当前运行界面重新采集 1920×1080 商店截图，避免界面和内容迭代后商店图过期。
