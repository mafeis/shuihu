# 《星命水浒》商业版资产包

## 1. 当前交付范围

本资产包对应 [游戏策划案](../shuihu_game_design.md) 中的正式发行范围，已经形成一套可由浏览器游戏直接使用，并可继续制作动画、宣传片、建模与跨引擎移植的正式美术母版。

已交付：

- 108 位好汉，每位均有电影感主视觉、透明战斗立绘与统一转身设定稿。
- 8 张 16:9 场景概念：黄河渡口、东京雪夜、野猪林、梁山泊水寨、清风寨、江州法场、祝家庄雪夜与大名府灯夜。
- 1 张北宋敌方角色阵容图。
- 7 张独立、保留透明通道的战斗立绘，其中包含江州行刑官、祝家庄教师与大名府都监。
- 14 个透明 UI 图标：4 个武学路数、6 个战斗状态、4 个资源与战斗信息图标。
- 1 段 MiniMax H3 生成的东京雪夜动态镜头与原生环境音。
- 10 套由 ComfyUI YuE2 生成的 32 秒无缝循环配乐。
- 108 位好汉均保留主视觉、透明立绘、响应式缩略图和转身设定稿，共 432 个制作文件；其中三套运行时素材进入内部资产清单，转身稿用于制作与外包审阅但默认不进入浏览器发行包。
- 所有正式图均保留 ComfyUI API 工作流、模型、种子和哈希记录。

机器可读清单：[assets/manifest.json](../assets/manifest.json)

## 2. 目录结构

```text
assets/
  characters/
    <hero-id>/
      keyart.png
      cutout.png
      thumb.webp
      turnaround.png
  enemies/
  environments/
  audio/
  ui/
    icons/
    sheets/
  video/
  concepts/
tools/
  comfy_asset_pipeline.py
  comfy_video_pipeline.py
  comfy_music_pipeline.py
  postprocess_asset_sheets.py
  build_asset_package.py
```

游戏工程只引用 `characters`、`enemies`、`environments`、`ui`、`video` 和 `audio` 下的规范命名文件。原始生成稿与 ComfyUI 工作流属于本地制作资料，不进入公开源码仓库；正式素材由 Git LFS 管理。

获取正式素材：

```bash
git lfs install
git lfs pull
```

## 3. 角色资产

每名角色使用统一的三段式生产流程：

1. Qwen Image 2.1 生成 832×1216 主视觉，锁定脸、体型、服装、武器和时代质感。
2. Qwen Edit 基于主视觉生成 1536×1024 四视图，保持身份与服装不变。
3. Qwen Edit 基于最终主视觉抠透明背景，生成 RGBA 立绘。

正式角色文件：

| 角色 | 主视觉 | 四视图 | 透明立绘 |
| --- | --- | --- | --- |
| 林冲 | [keyart](../assets/characters/linchong/keyart.png) | [turnaround](../assets/characters/linchong/turnaround.png) | [cutout](../assets/characters/linchong/cutout.png) |
| 鲁智深 | [keyart](../assets/characters/luzhishen/keyart.png) | [turnaround](../assets/characters/luzhishen/turnaround.png) | [cutout](../assets/characters/luzhishen/cutout.png) |
| 武松 | [keyart](../assets/characters/wusong/keyart.png) | [turnaround](../assets/characters/wusong/turnaround.png) | [cutout](../assets/characters/wusong/cutout.png) |
| 戴宗 | [keyart](../assets/characters/daizong/keyart.png) | [turnaround](../assets/characters/daizong/turnaround.png) | [cutout](../assets/characters/daizong/cutout.png) |
| 安道全 | [keyart](../assets/characters/andaoquan/keyart.png) | [turnaround](../assets/characters/andaoquan/turnaround.png) | [cutout](../assets/characters/andaoquan/cutout.png) |
| 时迁 | [keyart](../assets/characters/shiqian/keyart.png) | [turnaround](../assets/characters/shiqian/turnaround.png) | [cutout](../assets/characters/shiqian/cutout.png) |
| 李逵 | [keyart](../assets/characters/likui/keyart.png) | [turnaround](../assets/characters/likui/turnaround.png) | [cutout](../assets/characters/likui/cutout.png) |
| 花荣 | [keyart](../assets/characters/huarong/keyart.png) | [turnaround](../assets/characters/huarong/turnaround.png) | [cutout](../assets/characters/huarong/cutout.png) |
| 宋江 | [keyart](../assets/characters/songjiang/keyart.png) | [turnaround](../assets/characters/songjiang/turnaround.png) | [cutout](../assets/characters/songjiang/cutout.png) |
| 扈三娘 | [keyart](../assets/characters/husanniang/keyart.png) | [turnaround](../assets/characters/husanniang/turnaround.png) | [cutout](../assets/characters/husanniang/cutout.png) |
| 吴用 | [keyart](../assets/characters/wuyong/keyart.png) | [turnaround](../assets/characters/wuyong/turnaround.png) | [cutout](../assets/characters/wuyong/cutout.png) |
| 燕青 | [keyart](../assets/characters/yanqing/keyart.png) | [turnaround](../assets/characters/yanqing/turnaround.png) | [cutout](../assets/characters/yanqing/cutout.png) |
| 杨志 | [keyart](../assets/characters/yangzhi/keyart.png) | [turnaround](../assets/characters/yangzhi/turnaround.png) | [cutout](../assets/characters/yangzhi/cutout.png) |
| 公孙胜 | [keyart](../assets/characters/gongsunsheng/keyart.png) | [turnaround](../assets/characters/gongsunsheng/turnaround.png) | [cutout](../assets/characters/gongsunsheng/cutout.png) |
| 卢俊义 | [keyart](../assets/characters/lujunyi/keyart.png) | [turnaround](../assets/characters/lujunyi/turnaround.png) | [cutout](../assets/characters/lujunyi/cutout.png) |
| 张顺 | [keyart](../assets/characters/zhangshun/keyart.png) | [turnaround](../assets/characters/zhangshun/turnaround.png) | [cutout](../assets/characters/zhangshun/cutout.png) |
| 史进 | [keyart](../assets/characters/shijin/keyart.png) | [turnaround](../assets/characters/shijin/turnaround.png) | [cutout](../assets/characters/shijin/cutout.png) |
| 秦明 | [keyart](../assets/characters/qinming/keyart.png) | [turnaround](../assets/characters/qinming/turnaround.png) | [cutout](../assets/characters/qinming/cutout.png) |
| 柴进 | [keyart](../assets/characters/chaiin/keyart.png) | [turnaround](../assets/characters/chaiin/turnaround.png) | [cutout](../assets/characters/chaiin/cutout.png) |
| 关胜 | [keyart](../assets/characters/guansheng/keyart.png) | [turnaround](../assets/characters/guansheng/turnaround.png) | [cutout](../assets/characters/guansheng/cutout.png) |
| 张清 | [keyart](../assets/characters/zhangqing/keyart.png) | [turnaround](../assets/characters/zhangqing/turnaround.png) | [cutout](../assets/characters/zhangqing/cutout.png) |
| 徐宁 | [keyart](../assets/characters/xuning/keyart.png) | [turnaround](../assets/characters/xuning/turnaround.png) | [cutout](../assets/characters/xuning/cutout.png) |
| 李俊 | [keyart](../assets/characters/lijun/keyart.png) | [turnaround](../assets/characters/lijun/turnaround.png) | [cutout](../assets/characters/lijun/cutout.png) |
| 阮小七 | [keyart](../assets/characters/ruanxiaoqi/keyart.png) | [turnaround](../assets/characters/ruanxiaoqi/turnaround.png) | [cutout](../assets/characters/ruanxiaoqi/cutout.png) |
| 孙二娘 | [keyart](../assets/characters/sunerniang/keyart.png) | [turnaround](../assets/characters/sunerniang/turnaround.png) | [cutout](../assets/characters/sunerniang/cutout.png) |
| 顾大嫂 | [keyart](../assets/characters/gudashao/keyart.png) | [turnaround](../assets/characters/gudashao/turnaround.png) | [cutout](../assets/characters/gudashao/cutout.png) |
| 凌振 | [keyart](../assets/characters/lingzhen/keyart.png) | [turnaround](../assets/characters/lingzhen/turnaround.png) | [cutout](../assets/characters/lingzhen/cutout.png) |
| 呼延灼 | [keyart](../assets/characters/huyanzhuo/keyart.png) | [turnaround](../assets/characters/huyanzhuo/turnaround.png) | [cutout](../assets/characters/huyanzhuo/cutout.png) |
| 刘唐 | [keyart](../assets/characters/liutang/keyart.png) | [turnaround](../assets/characters/liutang/turnaround.png) | [cutout](../assets/characters/liutang/cutout.png) |
| 朱仝 | [keyart](../assets/characters/zhutong/keyart.png) | [turnaround](../assets/characters/zhutong/turnaround.png) | [cutout](../assets/characters/zhutong/cutout.png) |
| 雷横 | [keyart](../assets/characters/leiheng/keyart.png) | [turnaround](../assets/characters/leiheng/turnaround.png) | [cutout](../assets/characters/leiheng/cutout.png) |
| 李应 | [keyart](../assets/characters/liying/keyart.png) | [turnaround](../assets/characters/liying/turnaround.png) | [cutout](../assets/characters/liying/cutout.png) |
| 解珍 | [keyart](../assets/characters/jiezhen/keyart.png) | [turnaround](../assets/characters/jiezhen/turnaround.png) | [cutout](../assets/characters/jiezhen/cutout.png) |
| 解宝 | [keyart](../assets/characters/jiebao/keyart.png) | [turnaround](../assets/characters/jiebao/turnaround.png) | [cutout](../assets/characters/jiebao/cutout.png) |
| 杨雄 | [keyart](../assets/characters/yangxiong/keyart.png) | [turnaround](../assets/characters/yangxiong/turnaround.png) | [cutout](../assets/characters/yangxiong/cutout.png) |
| 石秀 | [keyart](../assets/characters/shixiu/keyart.png) | [turnaround](../assets/characters/shixiu/turnaround.png) | [cutout](../assets/characters/shixiu/cutout.png) |
| 孙立 | [keyart](../assets/characters/sunli/keyart.png) | [turnaround](../assets/characters/sunli/turnaround.png) | [cutout](../assets/characters/sunli/cutout.png) |
| 乐和 | [keyart](../assets/characters/yuehe/keyart.png) | [turnaround](../assets/characters/yuehe/turnaround.png) | [cutout](../assets/characters/yuehe/cutout.png) |
| 萧让 | [keyart](../assets/characters/xiaorang/keyart.png) | [turnaround](../assets/characters/xiaorang/turnaround.png) | [cutout](../assets/characters/xiaorang/cutout.png) |
| 蒋敬 | [keyart](../assets/characters/jiangjing/keyart.png) | [turnaround](../assets/characters/jiangjing/turnaround.png) | [cutout](../assets/characters/jiangjing/cutout.png) |

角色规格：

- 主视觉：832×1216 或 960×1216，PNG。
- 四视图：1536×1024，正面、三分之四、侧面、背面，同尺度 A-pose。
- 透明立绘：所有一百零八位好汉统一输出为 896×1024 RGBA 战斗画布，底部保留 12px 安全线。归一化前会清理近零 Alpha 噪点，再按有效人物轮廓等比裁切与居中；全尺寸武器仍完整保留，禁止横向压扁或把人物强行塞进同一宽度。
- 所有进入界面的立绘只允许等比缩放，并以 `object-fit: contain` 或等价约束显示，不允许使用 `fill` 改变人物宽高比。
- 统一风格：宋式写意写实，低饱和青黑、铁灰、旧青铜与克制朱红；材质强调旧布、甲片磨损、皮绳、木柄与雪水反光。
- 兵器轮廓完整优先，不添加无来源的发光魔法。

## 4. 场景与敌人

### 4.1 场景

| 场景 | 文件 | 用途 |
| --- | --- | --- |
| 黄河渡口 | [yellow_river_ferry.png](../assets/environments/yellow_river_ferry.png) | 教程、流民、夜渡、护送与调查任务 |
| 东京雪夜 | [bianjing_snow_night.png](../assets/environments/bianjing_snow_night.png) | 林冲遭陷、市井情报、官府压力 |
| 野猪林 | [boar_forest.png](../assets/environments/boar_forest.png) | 雪夜伏击、首领战、救援分支 |
| 梁山泊水寨 | [liangshan_water_fort.png](../assets/environments/liangshan_water_fort.png) | 基地入口、聚义厅外景与长期经营 |
| 清风寨 | [qingfeng_fort.png](../assets/environments/qingfeng_fort.png) | 清风山支线、花荣入队与寨门攻防 |
| 江州法场 | [jiangzhou_execution.png](../assets/environments/jiangzhou_execution.png) | 江州劫法场、李逵入队与行刑官首领战 |
| 祝家庄雪夜 | [zhujiazhuang_snow_night.png](../assets/environments/zhujiazhuang_snow_night.png) | 盘陀路、雪夜庄门与扈三娘招募 |
| 大名府灯夜 | [damingfu_lantern_night.png](../assets/environments/damingfu_lantern_night.png) | 灯市潜入、吴用布局与燕青招募 |

场景均为 1536×864，构图保留清晰的近景、中景、远景和可玩地面，适合先做场景灰盒、灯光还原与相机测试。

### 4.2 敌人

[北宋敌方阵容图](../assets/enemies/northern_song_enemy_lineup.png) 包含：

- 县衙差役：轻装、短棍、拘捕与召唤援兵。
- 官府弓手：远程压制、破甲箭与站位逼迫。
- 禁军教头：中阵防御、枪术反击与队伍增益。
- 沧州押差首领：重甲、宽刃刀、皮鞭、范围威压与处决技。

战斗内使用五张独立透明立绘，避免从阵容图直接裁切造成比例拉伸与相邻角色串图：

- [runner.png](../assets/enemies/runner.png)
- [archer.png](../assets/enemies/archer.png)
- [instructor.png](../assets/enemies/instructor.png)
- [captain.png](../assets/enemies/captain.png)
- [executioner.png](../assets/enemies/executioner.png)
- [zhu_guard.png](../assets/enemies/zhu_guard.png)
- [daming_captain.png](../assets/enemies/daming_captain.png)

## 5. UI 资产

透明图标全部为 512×512 和 256×256 两种尺寸，RGBA。

### 5.1 武学路数

- `gangmeng_spear`：刚猛
- `lingqiao_blades`：灵巧
- `taolue_scroll`：韬略
- `shouyu_shield`：守御

### 5.2 战斗状态

- `armor_break`：破甲
- `bleeding`：流血
- `stun`：眩晕
- `guard`：护盾
- `inspiration`：鼓舞
- `acupoint_seal`：封穴

### 5.3 资源与战斗信息

- `yiqi`：义气
- `copper_coins`：铜钱
- `heroic_star`：星宿
- `stance_break`：破势

所有图标采用同一套旧青铜、深铁、青玉与朱红光源，避免界面出现互不关联的材质语言。

## 6. Unity 导入建议

- 角色透明立绘：Texture Type 使用 `Sprite (2D and UI)`，Alpha Is Transparency 开启，Mesh Type 使用 `Full Rect`。
- 四视图与主视觉：Texture Type 使用 `Default`，关闭 sRGB 仅在制作法线或数据贴图时执行。
- UI 图标：Sprite 模式，关闭 Mip Maps，压缩优先 `ASTC 6x6`；PC 预览可先用无损 PNG。
- 透明立绘 Pivot 统一设置在脚底中心，建议归一化坐标 `(0.5, 0.02)`。
- 场景概念只用于制作参考，不直接作为最终背景贴图使用；灰盒阶段可按 16:9 建立相机与光照参考。
- 视频用于宣传和镜头测试，正式游戏内播放建议转码为 H.264 MP4，并保留当前母版。

## 7. 当前质量结论

可用：

- 108 位好汉的身份与轮廓区分清晰。
- 已交付四视图中的脸、服装、甲片、配件和武器保持统一。
- 透明立绘具备有效 Alpha，可直接用于 UI、对话和战斗占位。
- 场景具备明确的时代建筑、天气与游戏空间，不是纯氛围图。
- UI 图标缩到 256 像素后仍可识别。
- 角色与敌方立绘在战斗中统一使用 `object-fit: contain`；一百零八张角色透明画布统一为 896×1024，并在资产清单中记录 Alpha 边界、底部安全线与文件哈希。页面不再依赖逐角色 CSS 缩放表，避免同一角色在标题、招贤、剧情与战斗之间出现尺寸漂移。
- 十套配乐无削波，并以双音轨交叉淡入淡出切换。
- 十枚通用水浒战斗音效已生成、母带处理并接入运行时缓存，加载失败时保留 WebAudio 合成回退。
- 战斗特效按技能行为使用六类通用模板，不再按流派复播同一视频。

## 8. 音乐资产

| 曲目 | 用途 | 文件 |
| --- | --- | --- |
| 风雪山神 | 标题与叙事 | [title_theme.mp3](../assets/audio/title_theme.mp3) |
| 江湖行路 | 地图、营寨、好汉与设置 | [jianghu_theme.mp3](../assets/audio/jianghu_theme.mp3) |
| 聚义赴会 | 聚义帖剧情、招贤战与聚义奖励 | [recruitment_theme.mp3](../assets/audio/recruitment_theme.mp3) |
| 水泊战鼓 | 战役与演武战斗 | [battle_theme.mp3](../assets/audio/battle_theme.mp3) |
| 星落梁山 | 奖励、终局选择与结局 | [ending_theme.mp3](../assets/audio/ending_theme.mp3) |
| 清风夜袭 | 清风寨剧情与支线 | [qingfeng_theme.mp3](../assets/audio/qingfeng_theme.mp3) |
| 江州怒潮 | 江州剧情与法场战斗 | [jiangzhou_theme.mp3](../assets/audio/jiangzhou_theme.mp3) |
| 祝家庄雪夜 | 祝家庄剧情与雪夜庄门战 | [zhujiazhuang_theme.mp3](../assets/audio/zhujiazhuang_theme.mp3) |
| 大名灯市 | 大名府潜入与灯夜战斗 | [damingfu_theme.mp3](../assets/audio/damingfu_theme.mp3) |
| 罡煞临阵 | 沧州押差与江州行刑官首领战 | [boss_theme.mp3](../assets/audio/boss_theme.mp3) |

生成脚本为 `tools/comfy_music_pipeline.py`，从 ComfyUI 原始母带重建时使用 `tools/master_game_audio.py`。最终文件为 44.1kHz、双声道、192kbps MP3。每首源曲先截取尾部与头部进行 4 秒等功率交叠，再经过两遍响度母带和 120ms 边界闭合，形成约 32 秒的游戏循环。

当前发行集的音频验收结果为：

- 集成响度：`-16.10` 至 `-16.77 LUFS`。
- 真峰值：全部低于 `-1.5 dBTP`。
- 解码峰值：全部低于 `0.98`。
- 循环边界比：最高 `0.93`，验收上限为 `2.0`。
- 十首曲目均为 44.1kHz、双声道、约 31.88 秒、192kbps MP3。

重新生成与验收：

```bash
npm run audio:master
npm run audio:verify
```

### 8.1 战斗音效

| 分类 | 用途 | 文件 |
| --- | --- | --- |
| 开战 | 战鼓与短角声 | [battle-start.mp3](../assets/audio/sfx/battle-start.mp3) |
| 刀击 | 单斩、突刺与刀剑命中 | [blade.mp3](../assets/audio/sfx/blade.mp3) |
| 重击 | 重兵器、破甲与范围冲击 | [impact.mp3](../assets/audio/sfx/impact.mp3) |
| 齐射 | 箭矢、飞石、暗器与投掷 | [volley.mp3](../assets/audio/sfx/volley.mp3) |
| 守御 | 格挡、反击与防御架势 | [guard.mp3](../assets/audio/sfx/guard.mp3) |
| 闪避 | 落空与身法 | [evade.mp3](../assets/audio/sfx/evade.mp3) |
| 恢复 | 治疗、净化与回复 | [restore.mp3](../assets/audio/sfx/restore.mp3) |
| 终式 | 攻击义技与星命合击 | [ultimate.mp3](../assets/audio/sfx/ultimate.mp3) |
| 胜利 | 战斗胜利 | [victory.mp3](../assets/audio/sfx/victory.mp3) |
| 败北 | 战斗失败 | [defeat.mp3](../assets/audio/sfx/defeat.mp3) |

生成入口为 `tools/comfy_sfx_pipeline.py`，从缓存母带重建使用 `tools/master_game_sfx.py`。ComfyUI 提供短材质层，确定性瞬态层负责真正可辨识的刀风、低频冲击、金属泛音、回复音与终式节奏。浏览器通过 `AudioBuffer` 预解码缓存播放，并继续由统一音效总线控制音量。

### 8.2 技能特效

`src/battle-vfx.js` 根据技能目标、治疗、护御、攻击段数、义技标记、技能描述与结果事件选择通用模板，流派只改变色彩和呼出图标。

| 模板 | 典型技能 |
| --- | --- |
| `blade` | 枪刺、刀斩、单体近战 |
| `volley` | 箭雨、飞石、飞刃、暗器 |
| `impact` | 重棒、战斧、炮火、范围重击 |
| `guard` | 护御、反击、战阵与鼓舞 |
| `restore` | 治疗、药浴、净化与回复 |
| `ultimate` | 攻击型义技、连击与星命合击 |

模板由 CSS/DOM 图层实时绘制，不使用按流派复播的视频。单位数值面板固定位于特效层之上；战斗倍速会同步缩短特效计时，避免自动战斗 4 倍速时残留遮挡。

进入下一轮制作前仍需补：

- 主角与反派的面部表情组。
- 独立武器、装备、信物与可破坏甲片。
- 角色待机、行走、攻击、受击和义技动画。
- 少量英雄专属的招式装饰层；通用六类模板已可用于全部现有技能。
- 108 将的星宿图鉴边框与稀有度之外的收集反馈。
- 3D 模型、绑定、PBR 贴图与 LOD。

