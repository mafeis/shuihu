# ComfyUI 游戏资产生产说明

## 1. 服务与模型

默认服务：

```text
http://127.0.0.1:8188
```

图像主力：

- `qwen_image_2.1_int8_convrot.safetensors`
- `qwen3vl_8b_int8_convrot.safetensors`
- `qwen_image_2.1_vae_bf16.safetensors`

视频主力：

- `minimax_h3_fl2va_pruned_fp8_scaled.safetensors`
- `qwen3vl_32b_minimax_h3_int8_convrot.safetensors`
- `minimax_h3_video_vae_fp16.safetensors`
- `minimax_h3_audio_vae_fp32.safetensors`
- `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors`

音乐主力：

- `yue2_3b_int8_convrot.safetensors`
- ComfyUI 自定义节点：`YuE2GenerateMusic`、`EmptyYuE2LatentAudio`

环境变量可以覆盖服务地址：

```bash
export COMFY_URL=http://127.0.0.1:8188
```

## 2. 生成角色主视觉

108 位好汉的批量立绘、透明抠图与转身图可使用：

```bash
export COMFY_URL=http://127.0.0.1:8188
node tools/generate_hero_assets.mjs --concurrency=2
```

脚本按好汉 ID 生成主视觉，用 Apple Vision 抠出前景，再规范化为
896×1024 RGBA 立绘与 320px 缩略图。转身图以对应主视觉为身份和服饰
参考，避免不同姓名之间发生服装漂移。

背景旗帜或匾额出现可辨识文字时，可对指定好汉做局部清理。
脚本只重跑选中的好汉，并兼容 ComfyUI 因同名输出而追加序号的文件：

```bash
node tools/clean_hero_text.mjs --heroes=linchong,muhong
```

主视觉与转身图复核页可用：

```bash
python3 tools/audit_hero_keyart.py
python3 tools/audit_hero_keyart.py --asset=turnaround
```

```bash
python3 tools/comfy_asset_pipeline.py \
  --model qwen \
  --prompt-file path/to/character_prompt.txt \
  --width 832 \
  --height 1216 \
  --steps 28 \
  --seed 602108 \
  --prefix shuihu_wusong_keyart_v2 \
  --workflow-out workflows/api/qwen_wusong_keyart_v2.json
```

提示词至少包含：

- 角色姓名、绰号、身份。
- 年龄、东亚面部特征、发型与胡须。
- 北宋服饰结构、材质、磨损与配色。
- 标志性武器和完整轮廓。
- 场景、天气、光源和游戏用途。
- `no text, no logo, no watermark`。

## 3. 修正人物或局部

```bash
python3 tools/comfy_asset_pipeline.py \
  --model qwen-edit \
  --input-image assets/characters/daizong/keyart.png \
  --prompt 'Using <image1> strictly as the edit target, change only ... keep everything else unchanged.' \
  --width 832 \
  --height 1216 \
  --steps 24 \
  --seed 703208 \
  --prefix shuihu_daizong_keyart_v3 \
  --workflow-out workflows/api/qwen_daizong_keyart_v3_talisman_fix.json
```

局部修正必须重复不变量，例如：

- 只改腿符，保留脸、姿势、服装、背景和光。
- 只改幌子文字，保留街道建筑、行人、马匹与灯笼。
- 只生成透明背景，保留角色和武器轮廓。

## 4. 生成转身图

```bash
python3 tools/comfy_asset_pipeline.py \
  --model qwen-edit \
  --input-image assets/characters/wusong/keyart.png \
  --width 1536 \
  --height 1024 \
  --steps 25 \
  --seed 802108 \
  --prefix shuihu_wusong_turnaround_v2 \
  --workflow-out workflows/api/qwen_wusong_turnaround_v2.json \
  --prompt 'Using <image1> strictly as the identity and costume reference, create exactly three full-body views: front, side profile, and back. Identical scale, clean studio background, preserve identity and costume exactly, no text.'
```

转身图验收：

- 三个视角的发际线、脸型、胡须与体态一致。
- 服装层次和左右配件不交换。
- 武器在三个视角中的长度和结构一致。
- 双脚完整，没有裁切。
- 图中没有文字、标签、边框和水印。

## 5. 生成透明立绘

```bash
python3 tools/comfy_asset_pipeline.py \
  --model qwen-edit \
  --input-image assets/characters/linchong/keyart.png \
  --width 960 \
  --height 1216 \
  --steps 22 \
  --seed 700208 \
  --prefix shuihu_linchong_cutout_v4 \
  --workflow-out workflows/api/qwen_linchong_cutout_v4.json \
  --prompt 'Remove the background, and output a PNG image. Preserve the full weapon and add enough transparent margin. Clean transparent edges, no white halo.'
```

必须检查：

- 输出模式为 RGBA。
- Alpha 最小值为 0，最大值为 255。
- 归一化前先以 `--alpha-threshold 8` 清理近零 Alpha 噪点，避免透明边缘被误判为人像边界。
- 枪尖、刀尖、手指、发梢和衣摆没有透明缺口。
- 白底预览不出现明显白边。

## 6. UI 图标后处理

图标先用 Qwen 生成统一网格母版，再执行：

```bash
python3 tools/postprocess_asset_sheets.py
```

脚本会：

- 对未正确抠底的纯色背景做边缘泛洪移除。
- 保留图标内部高光。
- 按网格切成独立图标。
- 输出 512×512 与 256×256 RGBA PNG。

## 7. 图生视频

```bash
python3 tools/comfy_video_pipeline.py \
  --input-image assets/environments/bianjing_snow_night.png \
  --width 1344 \
  --height 768 \
  --seconds 5 \
  --steps 8 \
  --seed 1501108 \
  --prefix shuihu_video_bianjing_snow_night_v1 \
  --workflow-out workflows/api/minimax_h3_bianjing_snow_night_v1.json \
  --prompt-file path/to/video_prompt.txt
```

H3 的帧数会自动吸附到 `17k+5` 网格，24fps。5 秒对应 124 帧，实际时长约 5.17 秒。

镜头提示词应明确：

- 首帧必须保持不变的内容。
- 摄影机运动类型和幅度。
- 哪些对象允许运动。
- 禁止换脸、变形、新增前景角色与切镜。
- 音效、乐器和禁止出现的人声。

## 8. 生成循环配乐

```bash
python3 tools/comfy_music_pipeline.py

# 全部重新生成
python3 tools/comfy_music_pipeline.py --force

# 只重做一个场景
python3 tools/comfy_music_pipeline.py battle_theme --force
```

当前生成十条曲目：

- `title_theme`：标题与叙事。
- `jianghu_theme`：地图、营寨与养成界面。
- `battle_theme`：战役与演武。
- `ending_theme`：奖励、终局选择与结局。
- `qingfeng_theme`：清风寨剧情。
- `jiangzhou_theme`：江州剧情与法场战斗。
- `zhujiazhuang_theme`：祝家庄雪夜与庄门战。
- `damingfu_theme`：大名府灯市潜入与战斗。
- `boss_theme`：沧州押差、江州行刑官等首领战。
- `recruitment_theme`：聚义帖剧情、招贤战与入伙结算。

曲目提示词会明确民乐编制、时代感、速度、情绪与“无人声”。作业完成后脚本调用 `ffprobe` 检查时长，先用 FFmpeg 对首尾做 4 秒等功率交叠，再经过两遍 `loudnorm` 母带并将目标设为约 `-16 LUFS / -1.5 dBTP`。母带完成后额外做 120ms 首尾闭合，最后输出 44.1kHz、双声道、192kbps MP3。游戏中由 `src/audio.js` 使用双音轨交叉淡入淡出，避免场景切换断音。

已有 ComfyUI 原始母带时，可只重建正式游戏音频：

```bash
npm run audio:master
npm run audio:verify
```

音频验收会检查 MP3 编码、44.1kHz、双声道、约 32 秒时长、约 `-16 LUFS` 响度、真峰值上限 `-1.0 dBTP`、解码峰值上限 `0.98` 与循环边界比上限 `2.0`。当前十首作品全部通过，最高循环边界比为 `1.04`。

### 8.1 生成战斗一次性音效

```bash
# 缺少的音效会通过 ComfyUI 生成，再从缓存母带重建
COMFY_URL=http://100.122.17.21:8188 python3 tools/comfy_sfx_pipeline.py

# 只重做单个分类
COMFY_URL=http://100.122.17.21:8188 \
  python3 tools/comfy_sfx_pipeline.py impact --force

# 已有 ComfyUI 原始音时，仅重新裁切、瞬态整形与母带
npm run audio:master:sfx
```

战斗音效与配乐共用 ComfyUI 资产流程，但不做循环。YuE2 先提供短材质层，`tools/combat_sfx_synth.py` 再叠加与技能语义对应的刀风、箭矢、重击、格挡、恢复和终式瞬态层。最终文件会去除前导静音、压缩动态、做短淡出，并输出 44.1kHz、双声道、192kbps MP3。

当前十个通用分类为：

- `battle-start`：开战鼓点与短角声。
- `blade`：单斩、突刺、刀剑命中。
- `impact`：重兵器、破甲与范围冲击。
- `volley`：箭矢、飞石、暗器与投掷。
- `guard`：格挡、反击与防御架势。
- `evade`：闪避与衣袂掠过。
- `restore`：治疗、净化和回复。
- `ultimate`：攻击型义技与星命合击。
- `victory` / `defeat`：胜负收束。

`npm run audio:verify` 会同时检查配乐循环和所有一次性音效的编码、时长、响度、真峰值与解码峰值。

## 9. 资产打包

```bash
python3 tools/build_asset_package.py
```

脚本会：

- 将选定原始图复制到规范目录。
- 提取工作流中的种子和提示词。
- 记录图片尺寸、颜色模式和 Alpha 范围。
- 记录音乐编码、码率、采样率、时长、种子和循环处理方式。
- 计算 SHA-256。
- 生成 `assets/manifest.json`。

## 10. 质量门槛

正式资产必须同时通过：

- 身份：脸、体型、主色和标志物可识别。
- 历史：没有日式甲胄、现代物件、影视奇幻拼贴。
- 材质：旧布、皮革、铁、青铜和木材有不同反射与磨损。
- 轮廓：武器和姿态能在战斗小比例下区分。
- 可读性：场景有明确地面与遮挡关系，UI 图标缩到 256 像素仍可辨识。
- 技术：透明图带有效 Alpha，视频为 H.264 MP4，文件名与清单一致。
- 缩放：角色与敌人立绘只在等比容器内缩放，不直接设置失真的固定宽高。
- 音频：无削波，循环边界无明显断层，场景切换使用交叉淡化。
- 追溯：能从成品回到工作流、模型、种子和原始生成图。

