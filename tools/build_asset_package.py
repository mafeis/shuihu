#!/usr/bin/env python3
"""Assemble selected generated files into a normalized asset package."""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CHARACTER_CANVAS_WIDTH = 896
CHARACTER_CANVAS_HEIGHT = 1024
CHARACTER_CANVAS_SCALE = 0.96
CHARACTER_CANVAS_BOTTOM_MARGIN = 12
CHARACTER_ALPHA_THRESHOLD = 8


ASSETS = [
    # Characters
    {
        "id": "linchong_keyart",
        "type": "character_keyart",
        "character": "林冲",
        "source": "assets/raw/shuihu_linchong_qwen_v1_00001_.png",
        "final": "assets/characters/linchong/keyart.png",
        "workflow": "workflows/api/qwen_linchong_v1.json",
    },
    {
        "id": "linchong_turnaround",
        "type": "character_turnaround",
        "character": "林冲",
        "source": "assets/raw/shuihu_linchong_turnaround_v2_00001_.png",
        "final": "assets/characters/linchong/turnaround.png",
        "workflow": "workflows/api/qwen_linchong_turnaround_v2.json",
    },
    {
        "id": "linchong_cutout",
        "type": "character_cutout",
        "character": "林冲",
        "source": "assets/raw/shuihu_linchong_cutout_v4_00001_.png",
        "final": "assets/characters/linchong/cutout.png",
        "workflow": "workflows/api/qwen_linchong_cutout_v4.json",
    },
    {
        "id": "luzhishen_keyart",
        "type": "character_keyart",
        "character": "鲁智深",
        "source": "assets/raw/shuihu_luzhishen_keyart_v1_00001_.png",
        "final": "assets/characters/luzhishen/keyart.png",
        "workflow": "workflows/api/qwen_luzhishen_keyart_v1.json",
    },
    {
        "id": "luzhishen_turnaround",
        "type": "character_turnaround",
        "character": "鲁智深",
        "source": "assets/raw/shuihu_luzhishen_turnaround_v1_00001_.png",
        "final": "assets/characters/luzhishen/turnaround.png",
        "workflow": "workflows/api/qwen_luzhishen_turnaround_v1.json",
    },
    {
        "id": "luzhishen_cutout",
        "type": "character_cutout",
        "character": "鲁智深",
        "source": "assets/raw/shuihu_luzhishen_cutout_v1_00001_.png",
        "final": "assets/characters/luzhishen/cutout.png",
        "workflow": "workflows/api/qwen_luzhishen_cutout_v1.json",
    },
    {
        "id": "wusong_keyart",
        "type": "character_keyart",
        "character": "武松",
        "source": "assets/raw/shuihu_wusong_keyart_v2_00001_.png",
        "final": "assets/characters/wusong/keyart.png",
        "workflow": "workflows/api/qwen_wusong_keyart_v2.json",
    },
    {
        "id": "wusong_turnaround",
        "type": "character_turnaround",
        "character": "武松",
        "source": "assets/raw/shuihu_wusong_turnaround_v1_00001_.png",
        "final": "assets/characters/wusong/turnaround.png",
        "workflow": "workflows/api/qwen_wusong_turnaround_v1.json",
    },
    {
        "id": "wusong_cutout",
        "type": "character_cutout",
        "character": "武松",
        "source": "assets/raw/shuihu_wusong_cutout_v1_00001_.png",
        "final": "assets/characters/wusong/cutout.png",
        "workflow": "workflows/api/qwen_wusong_cutout_v1.json",
    },
    {
        "id": "daizong_keyart",
        "type": "character_keyart",
        "character": "戴宗",
        "source": "assets/raw/shuihu_daizong_keyart_v3_00001_.png",
        "final": "assets/characters/daizong/keyart.png",
        "workflow": "workflows/api/qwen_daizong_keyart_v3_talisman_fix.json",
    },
    {
        "id": "daizong_turnaround",
        "type": "character_turnaround",
        "character": "戴宗",
        "source": "assets/raw/shuihu_daizong_turnaround_v1_00001_.png",
        "final": "assets/characters/daizong/turnaround.png",
        "workflow": "workflows/api/qwen_daizong_turnaround_v1.json",
    },
    {
        "id": "daizong_cutout",
        "type": "character_cutout",
        "character": "戴宗",
        "source": "assets/raw/shuihu_daizong_cutout_v1_00001_.png",
        "final": "assets/characters/daizong/cutout.png",
        "workflow": "workflows/api/qwen_daizong_cutout_v1.json",
    },
    {
        "id": "andaoquan_keyart",
        "type": "character_keyart",
        "character": "安道全",
        "source": "assets/raw/shuihu_andaoquan_keyart_v1_00001_.png",
        "final": "assets/characters/andaoquan/keyart.png",
        "workflow": "workflows/api/qwen_andaoquan_keyart_v1.json",
    },
    {
        "id": "andaoquan_turnaround",
        "type": "character_turnaround",
        "character": "安道全",
        "source": "assets/raw/shuihu_andaoquan_turnaround_v1_00001_.png",
        "final": "assets/characters/andaoquan/turnaround.png",
        "workflow": "workflows/api/qwen_andaoquan_turnaround_v1.json",
    },
    {
        "id": "andaoquan_cutout",
        "type": "character_cutout",
        "character": "安道全",
        "source": "assets/raw/shuihu_andaoquan_cutout_v1_00001_.png",
        "final": "assets/characters/andaoquan/cutout.png",
        "workflow": "workflows/api/qwen_andaoquan_cutout_v1.json",
    },
    {
        "id": "shiqian_keyart",
        "type": "character_keyart",
        "character": "时迁",
        "source": "assets/raw/shuihu_shiqian_keyart_v2_00001_.png",
        "final": "assets/characters/shiqian/keyart.png",
        "workflow": "workflows/api/qwen_shiqian_keyart_v2.json",
    },
    {
        "id": "shiqian_turnaround",
        "type": "character_turnaround",
        "character": "时迁",
        "source": "assets/raw/shuihu_shiqian_turnaround_v1_00001_.png",
        "final": "assets/characters/shiqian/turnaround.png",
        "workflow": "workflows/api/qwen_shiqian_turnaround_v1.json",
    },
    {
        "id": "shiqian_cutout",
        "type": "character_cutout",
        "character": "时迁",
        "source": "assets/raw/shuihu_shiqian_cutout_v1_00001_.png",
        "final": "assets/characters/shiqian/cutout.png",
        "workflow": "workflows/api/qwen_shiqian_cutout_v1.json",
    },
    {
        "id": "huarong_keyart",
        "type": "character_keyart",
        "character": "花荣",
        "source": "assets/raw/shuihu_huarong_keyart_v1_00001_.png",
        "final": "assets/characters/huarong/keyart.png",
        "workflow": "workflows/api/qwen_huarong_keyart_v1.json",
    },
    {
        "id": "huarong_turnaround",
        "type": "character_turnaround",
        "character": "花荣",
        "source": "assets/raw/shuihu_huarong_turnaround_v1_00001_.png",
        "final": "assets/characters/huarong/turnaround.png",
        "workflow": "workflows/api/qwen_huarong_turnaround_v1.json",
    },
    {
        "id": "huarong_cutout",
        "type": "character_cutout",
        "character": "花荣",
        "source": "assets/raw/shuihu_huarong_vision_cutout_v1.png",
        "final": "assets/characters/huarong/cutout.png",
        "source_raw": "assets/raw/shuihu_huarong_keyart_v1_00001_.png",
        "workflow": "workflows/api/qwen_huarong_keyart_v1.json",
        "processing": "Apple Vision foreground segmentation via tools/vision_cutout.swift",
    },
    {
        "id": "likui_keyart",
        "type": "character_keyart",
        "character": "李逵",
        "source": "assets/raw/shuihu_likui_keyart_v1_00001_.png",
        "final": "assets/characters/likui/keyart.png",
        "workflow": "workflows/api/qwen_likui_keyart_v1.json",
    },
    {
        "id": "likui_turnaround",
        "type": "character_turnaround",
        "character": "李逵",
        "source": "assets/raw/shuihu_likui_turnaround_v2_00001_.png",
        "final": "assets/characters/likui/turnaround.png",
        "workflow": "workflows/api/qwen_likui_turnaround_v2.json",
    },
    {
        "id": "likui_cutout",
        "type": "character_cutout",
        "character": "李逵",
        "source": "assets/raw/shuihu_likui_cutout_v1_00001_.png",
        "final": "assets/characters/likui/cutout.png",
        "workflow": "workflows/api/qwen_likui_cutout_v1.json",
    },
    {
        "id": "songjiang_keyart",
        "type": "character_keyart",
        "character": "宋江",
        "source": "assets/raw/shuihu_songjiang_keyart_v1_00001_.png",
        "final": "assets/characters/songjiang/keyart.png",
        "workflow": "workflows/api/qwen_songjiang_keyart_v1.json",
    },
    {
        "id": "songjiang_turnaround",
        "type": "character_turnaround",
        "character": "宋江",
        "source": "assets/raw/shuihu_songjiang_turnaround_v1_00001_.png",
        "final": "assets/characters/songjiang/turnaround.png",
        "workflow": "workflows/api/qwen_songjiang_turnaround_v1.json",
    },
    {
        "id": "songjiang_cutout",
        "type": "character_cutout",
        "character": "宋江",
        "source": "assets/raw/shuihu_songjiang_cutout_v1_00001_.png",
        "final": "assets/characters/songjiang/cutout.png",
        "workflow": "workflows/api/qwen_songjiang_cutout_v1.json",
    },
    {
        "id": "husanniang_keyart",
        "type": "character_keyart",
        "character": "扈三娘",
        "source": "assets/raw/shuihu_husanniang_keyart_v1_00001_.png",
        "final": "assets/characters/husanniang/keyart.png",
        "workflow": "workflows/api/qwen_husanniang_keyart_v1.json",
    },
    {
        "id": "husanniang_turnaround",
        "type": "character_turnaround",
        "character": "扈三娘",
        "source": "assets/raw/shuihu_husanniang_turnaround_v1_00001_.png",
        "final": "assets/characters/husanniang/turnaround.png",
        "workflow": "workflows/api/qwen_husanniang_turnaround_v1.json",
    },
    {
        "id": "husanniang_cutout",
        "type": "character_cutout",
        "character": "扈三娘",
        "source": "assets/raw/shuihu_husanniang_cutout_v1_00001_.png",
        "final": "assets/characters/husanniang/cutout.png",
        "workflow": "workflows/api/qwen_husanniang_cutout_v1.json",
    },
    {
        "id": "wuyong_keyart",
        "type": "character_keyart",
        "character": "吴用",
        "source": "assets/raw/shuihu_wuyong_keyart_v1_00001_.png",
        "final": "assets/characters/wuyong/keyart.png",
        "workflow": "workflows/api/qwen_wuyong_keyart_v1.json",
    },
    {
        "id": "wuyong_turnaround",
        "type": "character_turnaround",
        "character": "吴用",
        "source": "assets/raw/shuihu_wuyong_turnaround_v1_00001_.png",
        "final": "assets/characters/wuyong/turnaround.png",
        "workflow": "workflows/api/qwen_wuyong_turnaround_v1.json",
    },
    {
        "id": "wuyong_cutout",
        "type": "character_cutout",
        "character": "吴用",
        "source": "assets/raw/shuihu_wuyong_cutout_v1_00001_.png",
        "final": "assets/characters/wuyong/cutout.png",
        "workflow": "workflows/api/qwen_wuyong_cutout_v1.json",
    },
    {
        "id": "yanqing_keyart",
        "type": "character_keyart",
        "character": "燕青",
        "source": "assets/raw/shuihu_yanqing_keyart_v1_00001_.png",
        "final": "assets/characters/yanqing/keyart.png",
        "workflow": "workflows/api/qwen_yanqing_keyart_v1.json",
    },
    {
        "id": "yanqing_turnaround",
        "type": "character_turnaround",
        "character": "燕青",
        "source": "assets/raw/shuihu_yanqing_turnaround_v1_00001_.png",
        "final": "assets/characters/yanqing/turnaround.png",
        "workflow": "workflows/api/qwen_yanqing_turnaround_v1.json",
    },
    {
        "id": "yanqing_cutout",
        "type": "character_cutout",
        "character": "燕青",
        "source": "assets/raw/shuihu_yanqing_cutout_v1_00001_.png",
        "final": "assets/characters/yanqing/cutout.png",
        "workflow": "workflows/api/qwen_yanqing_cutout_v1.json",
    },
    {
        "id": "yangzhi_keyart",
        "type": "character_keyart",
        "character": "杨志",
        "source": "assets/raw/shuihu_yangzhi_keyart_v1_00001_.png",
        "final": "assets/characters/yangzhi/keyart.png",
        "workflow": "workflows/api/qwen_yangzhi_keyart_v1.json",
    },
    {
        "id": "yangzhi_cutout",
        "type": "character_cutout",
        "character": "杨志",
        "source": "assets/raw/shuihu_yangzhi_cutout_v1_00001_.png",
        "final": "assets/characters/yangzhi/cutout.png",
        "workflow": "workflows/api/qwen_yangzhi_cutout_v1.json",
    },
    {
        "id": "yangzhi_turnaround",
        "type": "character_turnaround",
        "character": "杨志",
        "source": "assets/raw/shuihu_yangzhi_turnaround_v1_00001_.png",
        "final": "assets/characters/yangzhi/turnaround.png",
        "workflow": "workflows/api/qwen_yangzhi_turnaround_v1.json",
    },
    {
        "id": "gongsunsheng_keyart",
        "type": "character_keyart",
        "character": "公孙胜",
        "source": "assets/raw/shuihu_gongsunsheng_keyart_v1_00001_.png",
        "final": "assets/characters/gongsunsheng/keyart.png",
        "workflow": "workflows/api/qwen_gongsunsheng_keyart_v1.json",
    },
    {
        "id": "gongsunsheng_cutout",
        "type": "character_cutout",
        "character": "公孙胜",
        "source": "assets/raw/shuihu_gongsunsheng_cutout_v1_00001_.png",
        "final": "assets/characters/gongsunsheng/cutout.png",
        "workflow": "workflows/api/qwen_gongsunsheng_cutout_v1.json",
    },
    {
        "id": "gongsunsheng_turnaround",
        "type": "character_turnaround",
        "character": "公孙胜",
        "source": "assets/raw/shuihu_gongsunsheng_turnaround_v1_00001_.png",
        "final": "assets/characters/gongsunsheng/turnaround.png",
        "workflow": "workflows/api/qwen_gongsunsheng_turnaround_v1.json",
    },
    {
        "id": "lujunyi_keyart",
        "type": "character_keyart",
        "character": "卢俊义",
        "source": "assets/raw/shuihu_lujunyi_keyart_v1_00001_.png",
        "final": "assets/characters/lujunyi/keyart.png",
        "workflow": "workflows/api/qwen_lujunyi_keyart_v1.json",
    },
    {
        "id": "lujunyi_cutout",
        "type": "character_cutout",
        "character": "卢俊义",
        "source": "assets/raw/shuihu_lujunyi_cutout_v1_00001_.png",
        "final": "assets/characters/lujunyi/cutout.png",
        "workflow": "workflows/api/qwen_lujunyi_cutout_v1.json",
    },
    {
        "id": "lujunyi_turnaround",
        "type": "character_turnaround",
        "character": "卢俊义",
        "source": "assets/raw/shuihu_lujunyi_turnaround_v1_00001_.png",
        "final": "assets/characters/lujunyi/turnaround.png",
        "workflow": "workflows/api/qwen_lujunyi_turnaround_v1.json",
    },
    {
        "id": "zhangshun_keyart",
        "type": "character_keyart",
        "character": "张顺",
        "source": "assets/raw/shuihu_zhangshun_keyart_v1_00001_.png",
        "final": "assets/characters/zhangshun/keyart.png",
        "workflow": "workflows/api/qwen_zhangshun_keyart_v1.json",
    },
    {
        "id": "zhangshun_cutout",
        "type": "character_cutout",
        "character": "张顺",
        "source": "assets/raw/shuihu_zhangshun_cutout_v1_00001_.png",
        "final": "assets/characters/zhangshun/cutout.png",
        "workflow": "workflows/api/qwen_zhangshun_cutout_v1.json",
    },
    {
        "id": "zhangshun_turnaround",
        "type": "character_turnaround",
        "character": "张顺",
        "source": "assets/raw/shuihu_zhangshun_turnaround_v1_00001_.png",
        "final": "assets/characters/zhangshun/turnaround.png",
        "workflow": "workflows/api/qwen_zhangshun_turnaround_v1.json",
    },
    {
        "id": "shijin_keyart",
        "type": "character_keyart",
        "character": "史进",
        "source": "assets/raw/shuihu_shijin_keyart_v1_00001_.png",
        "final": "assets/characters/shijin/keyart.png",
        "workflow": "workflows/api/qwen_shijin_keyart_v1.json",
    },
    {
        "id": "shijin_turnaround",
        "type": "character_turnaround",
        "character": "史进",
        "source": "assets/raw/shuihu_shijin_turnaround_v1_00001_.png",
        "final": "assets/characters/shijin/turnaround.png",
        "workflow": "workflows/api/qwen_shijin_turnaround_v1.json",
    },
    {
        "id": "shijin_cutout",
        "type": "character_cutout",
        "character": "史进",
        "source": "assets/characters/shijin/cutout.png",
        "source_raw": "assets/raw/shuihu_shijin_keyart_v1_00001_.png",
        "derived_raw": "assets/raw/shuihu_shijin_vision_cutout_v1.png",
        "final": "assets/characters/shijin/cutout.png",
        "workflow": "workflows/api/qwen_shijin_keyart_v1.json",
        "processing": "Apple Vision foreground segmentation plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "qinming_keyart",
        "type": "character_keyart",
        "character": "秦明",
        "source": "assets/raw/shuihu_qinming_keyart_v1_00001_.png",
        "final": "assets/characters/qinming/keyart.png",
        "workflow": "workflows/api/qwen_qinming_keyart_v1.json",
    },
    {
        "id": "qinming_turnaround",
        "type": "character_turnaround",
        "character": "秦明",
        "source": "assets/raw/shuihu_qinming_turnaround_v1_00001_.png",
        "final": "assets/characters/qinming/turnaround.png",
        "workflow": "workflows/api/qwen_qinming_turnaround_v1.json",
    },
    {
        "id": "qinming_cutout",
        "type": "character_cutout",
        "character": "秦明",
        "source": "assets/characters/qinming/cutout.png",
        "source_raw": "assets/raw/shuihu_qinming_keyart_v1_00001_.png",
        "derived_raw": "assets/raw/shuihu_qinming_vision_cutout_v1.png",
        "final": "assets/characters/qinming/cutout.png",
        "workflow": "workflows/api/qwen_qinming_keyart_v1.json",
        "processing": "Apple Vision foreground segmentation plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "chaiin_keyart",
        "type": "character_keyart",
        "character": "柴进",
        "source": "assets/raw/shuihu_chaiin_keyart_v1_00001_.png",
        "final": "assets/characters/chaiin/keyart.png",
        "workflow": "workflows/api/qwen_chaiin_keyart_v1.json",
    },
    {
        "id": "chaiin_turnaround",
        "type": "character_turnaround",
        "character": "柴进",
        "source": "assets/raw/shuihu_chaiin_turnaround_v1_00001_.png",
        "final": "assets/characters/chaiin/turnaround.png",
        "workflow": "workflows/api/qwen_chaiin_turnaround_v1.json",
    },
    {
        "id": "chaiin_cutout",
        "type": "character_cutout",
        "character": "柴进",
        "source": "assets/characters/chaiin/cutout.png",
        "source_raw": "assets/raw/shuihu_chaiin_keyart_v1_00001_.png",
        "derived_raw": "assets/raw/shuihu_chaiin_vision_cutout_v1.png",
        "final": "assets/characters/chaiin/cutout.png",
        "workflow": "workflows/api/qwen_chaiin_keyart_v1.json",
        "processing": "Apple Vision foreground segmentation plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "guansheng_keyart",
        "type": "character_keyart",
        "character": "关胜",
        "source": "assets/raw/shuihu_guansheng_keyart_v1_00001_.png",
        "final": "assets/characters/guansheng/keyart.png",
        "workflow": "workflows/api/qwen_guansheng_keyart_v1.json",
    },
    {
        "id": "guansheng_turnaround",
        "type": "character_turnaround",
        "character": "关胜",
        "source": "assets/raw/shuihu_guansheng_turnaround_v1_00001_.png",
        "final": "assets/characters/guansheng/turnaround.png",
        "workflow": "workflows/api/qwen_guansheng_turnaround_v1.json",
    },
    {
        "id": "guansheng_cutout",
        "type": "character_cutout",
        "character": "关胜",
        "source": "assets/characters/guansheng/cutout.png",
        "source_raw": "assets/raw/shuihu_guansheng_keyart_v1_00001_.png",
        "derived_raw": "assets/raw/shuihu_guansheng_vision_cutout_v1.png",
        "final": "assets/characters/guansheng/cutout.png",
        "workflow": "workflows/api/qwen_guansheng_keyart_v1.json",
        "processing": "Apple Vision foreground segmentation plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "zhangqing_keyart",
        "type": "character_keyart",
        "character": "张清",
        "source": "assets/raw/shuihu_zhangqing_keyart_v1_00001_.png",
        "final": "assets/characters/zhangqing/keyart.png",
        "workflow": "workflows/api/qwen_zhangqing_keyart_v1.json",
    },
    {
        "id": "zhangqing_turnaround",
        "type": "character_turnaround",
        "character": "张清",
        "source": "assets/raw/shuihu_zhangqing_turnaround_v1_00001_.png",
        "final": "assets/characters/zhangqing/turnaround.png",
        "workflow": "workflows/api/qwen_zhangqing_turnaround_v1.json",
    },
    {
        "id": "zhangqing_cutout",
        "type": "character_cutout",
        "character": "张清",
        "source": "assets/raw/shuihu_zhangqing_cutout_normalized_v1.png",
        "source_raw": "assets/raw/shuihu_zhangqing_cutout_v1_00001_.png",
        "final": "assets/characters/zhangqing/cutout.png",
        "workflow": "workflows/api/qwen_zhangqing_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "xuning_keyart",
        "type": "character_keyart",
        "character": "徐宁",
        "source": "assets/raw/shuihu_xuning_keyart_v2_text_clean_00001_.png",
        "final": "assets/characters/xuning/keyart.png",
        "workflow": "workflows/api/qwen_xuning_keyart_v2_text_clean.json",
    },
    {
        "id": "xuning_turnaround",
        "type": "character_turnaround",
        "character": "徐宁",
        "source": "assets/raw/shuihu_xuning_turnaround_v1_00001_.png",
        "final": "assets/characters/xuning/turnaround.png",
        "workflow": "workflows/api/qwen_xuning_turnaround_v1.json",
    },
    {
        "id": "xuning_cutout",
        "type": "character_cutout",
        "character": "徐宁",
        "source": "assets/raw/shuihu_xuning_cutout_normalized_v1.png",
        "source_raw": "assets/raw/shuihu_xuning_cutout_v1_00001_.png",
        "final": "assets/characters/xuning/cutout.png",
        "workflow": "workflows/api/qwen_xuning_cutout_v1.json",
        "processing": "Transparent cutout plus alpha-threshold cleanup and tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "lijun_keyart",
        "type": "character_keyart",
        "character": "李俊",
        "source": "assets/raw/shuihu_lijun_keyart_v1_00001_.png",
        "final": "assets/characters/lijun/keyart.png",
        "workflow": "workflows/api/qwen_lijun_keyart_v1.json",
    },
    {
        "id": "lijun_turnaround",
        "type": "character_turnaround",
        "character": "李俊",
        "source": "assets/raw/shuihu_lijun_turnaround_v1_00001_.png",
        "final": "assets/characters/lijun/turnaround.png",
        "workflow": "workflows/api/qwen_lijun_turnaround_v1.json",
    },
    {
        "id": "lijun_cutout",
        "type": "character_cutout",
        "character": "李俊",
        "source": "assets/characters/lijun/cutout.png",
        "source_raw": "assets/raw/shuihu_lijun_cutout_v1_00002_.png",
        "final": "assets/characters/lijun/cutout.png",
        "workflow": "workflows/api/qwen_lijun_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "ruanxiaoqi_keyart",
        "type": "character_keyart",
        "character": "阮小七",
        "source": "assets/raw/shuihu_ruanxiaoqi_keyart_v2_00001_.png",
        "final": "assets/characters/ruanxiaoqi/keyart.png",
        "workflow": "workflows/api/qwen_ruanxiaoqi_keyart_v2.json",
    },
    {
        "id": "ruanxiaoqi_turnaround",
        "type": "character_turnaround",
        "character": "阮小七",
        "source": "assets/raw/shuihu_ruanxiaoqi_turnaround_v1_00001_.png",
        "final": "assets/characters/ruanxiaoqi/turnaround.png",
        "workflow": "workflows/api/qwen_ruanxiaoqi_turnaround_v1.json",
    },
    {
        "id": "ruanxiaoqi_cutout",
        "type": "character_cutout",
        "character": "阮小七",
        "source": "assets/characters/ruanxiaoqi/cutout.png",
        "source_raw": "assets/raw/shuihu_ruanxiaoqi_cutout_v1_00001_.png",
        "final": "assets/characters/ruanxiaoqi/cutout.png",
        "workflow": "workflows/api/qwen_ruanxiaoqi_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "sunerniang_keyart",
        "type": "character_keyart",
        "character": "孙二娘",
        "source": "assets/raw/shuihu_sunerniang_keyart_v1_00001_.png",
        "final": "assets/characters/sunerniang/keyart.png",
        "workflow": "workflows/api/qwen_sunerniang_keyart_v1.json",
    },
    {
        "id": "sunerniang_turnaround",
        "type": "character_turnaround",
        "character": "孙二娘",
        "source": "assets/raw/shuihu_sunerniang_turnaround_v1_00001_.png",
        "final": "assets/characters/sunerniang/turnaround.png",
        "workflow": "workflows/api/qwen_sunerniang_turnaround_v1.json",
    },
    {
        "id": "sunerniang_cutout",
        "type": "character_cutout",
        "character": "孙二娘",
        "source": "assets/characters/sunerniang/cutout.png",
        "source_raw": "assets/raw/shuihu_sunerniang_cutout_v1_00001_.png",
        "final": "assets/characters/sunerniang/cutout.png",
        "workflow": "workflows/api/qwen_sunerniang_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "gudashao_keyart",
        "type": "character_keyart",
        "character": "顾大嫂",
        "source": "assets/raw/shuihu_gudashao_keyart_v2_00001_.png",
        "final": "assets/characters/gudashao/keyart.png",
        "workflow": "workflows/api/qwen_gudashao_keyart_v2.json",
    },
    {
        "id": "gudashao_turnaround",
        "type": "character_turnaround",
        "character": "顾大嫂",
        "source": "assets/raw/shuihu_gudashao_turnaround_v1_00001_.png",
        "final": "assets/characters/gudashao/turnaround.png",
        "workflow": "workflows/api/qwen_gudashao_turnaround_v1.json",
    },
    {
        "id": "gudashao_cutout",
        "type": "character_cutout",
        "character": "顾大嫂",
        "source": "assets/characters/gudashao/cutout.png",
        "source_raw": "assets/raw/shuihu_gudashao_cutout_v1_00001_.png",
        "final": "assets/characters/gudashao/cutout.png",
        "workflow": "workflows/api/qwen_gudashao_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "lingzhen_keyart",
        "type": "character_keyart",
        "character": "凌振",
        "source": "assets/raw/shuihu_lingzhen_keyart_v1_00001_.png",
        "final": "assets/characters/lingzhen/keyart.png",
        "workflow": "workflows/api/qwen_lingzhen_keyart_v1.json",
    },
    {
        "id": "lingzhen_turnaround",
        "type": "character_turnaround",
        "character": "凌振",
        "source": "assets/raw/shuihu_lingzhen_turnaround_v1_00001_.png",
        "final": "assets/characters/lingzhen/turnaround.png",
        "workflow": "workflows/api/qwen_lingzhen_turnaround_v1.json",
    },
    {
        "id": "lingzhen_cutout",
        "type": "character_cutout",
        "character": "凌振",
        "source": "assets/characters/lingzhen/cutout.png",
        "source_raw": "assets/raw/shuihu_lingzhen_cutout_v1_00001_.png",
        "final": "assets/characters/lingzhen/cutout.png",
        "workflow": "workflows/api/qwen_lingzhen_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "huyanzhuo_keyart",
        "type": "character_keyart",
        "character": "呼延灼",
        "source": "assets/raw/shuihu_huyanzhuo_keyart_v1_00001_.png",
        "final": "assets/characters/huyanzhuo/keyart.png",
        "workflow": "workflows/api/qwen_huyanzhuo_keyart_v1.json",
    },
    {
        "id": "huyanzhuo_turnaround",
        "type": "character_turnaround",
        "character": "呼延灼",
        "source": "assets/raw/shuihu_huyanzhuo_turnaround_v1_00001_.png",
        "final": "assets/characters/huyanzhuo/turnaround.png",
        "workflow": "workflows/api/qwen_huyanzhuo_turnaround_v1.json",
    },
    {
        "id": "huyanzhuo_cutout",
        "type": "character_cutout",
        "character": "呼延灼",
        "source": "assets/characters/huyanzhuo/cutout.png",
        "source_raw": "assets/raw/shuihu_huyanzhuo_cutout_v1_00001_.png",
        "final": "assets/characters/huyanzhuo/cutout.png",
        "workflow": "workflows/api/qwen_huyanzhuo_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "liutang_keyart",
        "type": "character_keyart",
        "character": "刘唐",
        "source": "assets/raw/shuihu_liutang_keyart_v2_00001_.png",
        "final": "assets/characters/liutang/keyart.png",
        "workflow": "workflows/api/qwen_liutang_keyart_v2_text_clean.json",
        "processing": "Qwen Image 2.1 targeted cleanup for pseudo-text banners",
    },
    {
        "id": "liutang_turnaround",
        "type": "character_turnaround",
        "character": "刘唐",
        "source": "assets/raw/shuihu_liutang_turnaround_v1_00001_.png",
        "final": "assets/characters/liutang/turnaround.png",
        "workflow": "workflows/api/qwen_liutang_turnaround_v1.json",
    },
    {
        "id": "liutang_cutout",
        "type": "character_cutout",
        "character": "刘唐",
        "source": "assets/characters/liutang/cutout.png",
        "source_raw": "assets/raw/shuihu_liutang_cutout_v1_00001_.png",
        "final": "assets/characters/liutang/cutout.png",
        "workflow": "workflows/api/qwen_liutang_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "zhutong_keyart",
        "type": "character_keyart",
        "character": "朱仝",
        "source": "assets/raw/shuihu_zhutong_keyart_v1_00001_.png",
        "final": "assets/characters/zhutong/keyart.png",
        "workflow": "workflows/api/qwen_zhutong_keyart_v1.json",
    },
    {
        "id": "zhutong_turnaround",
        "type": "character_turnaround",
        "character": "朱仝",
        "source": "assets/raw/shuihu_zhutong_turnaround_v1_00001_.png",
        "final": "assets/characters/zhutong/turnaround.png",
        "workflow": "workflows/api/qwen_zhutong_turnaround_v1.json",
    },
    {
        "id": "zhutong_cutout",
        "type": "character_cutout",
        "character": "朱仝",
        "source": "assets/characters/zhutong/cutout.png",
        "source_raw": "assets/raw/shuihu_zhutong_cutout_v1_00001_.png",
        "final": "assets/characters/zhutong/cutout.png",
        "workflow": "workflows/api/qwen_zhutong_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "leiheng_keyart",
        "type": "character_keyart",
        "character": "雷横",
        "source": "assets/raw/shuihu_leiheng_keyart_v2_00001_.png",
        "final": "assets/characters/leiheng/keyart.png",
        "workflow": "workflows/api/qwen_leiheng_keyart_v2_text_clean.json",
        "processing": "Qwen Image 2.1 targeted cleanup for pseudo-text banners",
    },
    {
        "id": "leiheng_turnaround",
        "type": "character_turnaround",
        "character": "雷横",
        "source": "assets/raw/shuihu_leiheng_turnaround_v1_00001_.png",
        "final": "assets/characters/leiheng/turnaround.png",
        "workflow": "workflows/api/qwen_leiheng_turnaround_v1.json",
    },
    {
        "id": "leiheng_cutout",
        "type": "character_cutout",
        "character": "雷横",
        "source": "assets/characters/leiheng/cutout.png",
        "source_raw": "assets/raw/shuihu_leiheng_cutout_v1_00001_.png",
        "final": "assets/characters/leiheng/cutout.png",
        "workflow": "workflows/api/qwen_leiheng_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "liying_keyart",
        "type": "character_keyart",
        "character": "李应",
        "source": "assets/raw/shuihu_liying_keyart_v1_00001_.png",
        "final": "assets/characters/liying/keyart.png",
        "workflow": "workflows/api/qwen_liying_keyart_v1.json",
    },
    {
        "id": "liying_turnaround",
        "type": "character_turnaround",
        "character": "李应",
        "source": "assets/raw/shuihu_liying_turnaround_v1_00001_.png",
        "final": "assets/characters/liying/turnaround.png",
        "workflow": "workflows/api/qwen_liying_turnaround_v1.json",
    },
    {
        "id": "liying_cutout",
        "type": "character_cutout",
        "character": "李应",
        "source": "assets/characters/liying/cutout.png",
        "source_raw": "assets/raw/shuihu_liying_cutout_v1_00001_.png",
        "final": "assets/characters/liying/cutout.png",
        "workflow": "workflows/api/qwen_liying_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "jiezhen_keyart",
        "type": "character_keyart",
        "character": "解珍",
        "source": "assets/raw/shuihu_jiezhen_keyart_v1_00001_.png",
        "final": "assets/characters/jiezhen/keyart.png",
        "workflow": "workflows/api/qwen_jiezhen_keyart_v1.json",
    },
    {
        "id": "jiezhen_turnaround",
        "type": "character_turnaround",
        "character": "解珍",
        "source": "assets/raw/shuihu_jiezhen_turnaround_v1_00001_.png",
        "final": "assets/characters/jiezhen/turnaround.png",
        "workflow": "workflows/api/qwen_jiezhen_turnaround_v1.json",
    },
    {
        "id": "jiezhen_cutout",
        "type": "character_cutout",
        "character": "解珍",
        "source": "assets/characters/jiezhen/cutout.png",
        "source_raw": "assets/raw/shuihu_jiezhen_cutout_v1_00001_.png",
        "final": "assets/characters/jiezhen/cutout.png",
        "workflow": "workflows/api/qwen_jiezhen_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "jiebao_keyart",
        "type": "character_keyart",
        "character": "解宝",
        "source": "assets/raw/shuihu_jiebao_keyart_v1_00001_.png",
        "final": "assets/characters/jiebao/keyart.png",
        "workflow": "workflows/api/qwen_jiebao_keyart_v1.json",
    },
    {
        "id": "jiebao_turnaround",
        "type": "character_turnaround",
        "character": "解宝",
        "source": "assets/raw/shuihu_jiebao_turnaround_v1_00001_.png",
        "final": "assets/characters/jiebao/turnaround.png",
        "workflow": "workflows/api/qwen_jiebao_turnaround_v1.json",
    },
    {
        "id": "jiebao_cutout",
        "type": "character_cutout",
        "character": "解宝",
        "source": "assets/characters/jiebao/cutout.png",
        "source_raw": "assets/raw/shuihu_jiebao_cutout_v1_00001_.png",
        "final": "assets/characters/jiebao/cutout.png",
        "workflow": "workflows/api/qwen_jiebao_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "yangxiong_keyart",
        "type": "character_keyart",
        "character": "杨雄",
        "source": "assets/raw/shuihu_yangxiong_keyart_v2_clean_00001_.png",
        "final": "assets/characters/yangxiong/keyart.png",
        "workflow": "workflows/api/qwen_yangxiong_keyart_v2_clean.json",
        "processing": "Qwen Image 2.1 targeted cleanup for pseudo-text plaques",
    },
    {
        "id": "yangxiong_turnaround",
        "type": "character_turnaround",
        "character": "杨雄",
        "source": "assets/raw/shuihu_yangxiong_turnaround_v1_00001_.png",
        "final": "assets/characters/yangxiong/turnaround.png",
        "workflow": "workflows/api/qwen_yangxiong_turnaround_v1.json",
    },
    {
        "id": "yangxiong_cutout",
        "type": "character_cutout",
        "character": "杨雄",
        "source": "assets/characters/yangxiong/cutout.png",
        "source_raw": "assets/raw/shuihu_yangxiong_cutout_v1_00001_.png",
        "final": "assets/characters/yangxiong/cutout.png",
        "workflow": "workflows/api/qwen_yangxiong_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "shixiu_keyart",
        "type": "character_keyart",
        "character": "石秀",
        "source": "assets/raw/shuihu_shixiu_keyart_v2_clean_00001_.png",
        "final": "assets/characters/shixiu/keyart.png",
        "workflow": "workflows/api/qwen_shixiu_keyart_v2_clean.json",
        "processing": "Qwen Image 2.1 targeted cleanup for pseudo-text signage",
    },
    {
        "id": "shixiu_turnaround",
        "type": "character_turnaround",
        "character": "石秀",
        "source": "assets/raw/shuihu_shixiu_turnaround_v1_00001_.png",
        "final": "assets/characters/shixiu/turnaround.png",
        "workflow": "workflows/api/qwen_shixiu_turnaround_v1.json",
    },
    {
        "id": "shixiu_cutout",
        "type": "character_cutout",
        "character": "石秀",
        "source": "assets/characters/shixiu/cutout.png",
        "source_raw": "assets/raw/shuihu_shixiu_cutout_v1_00001_.png",
        "final": "assets/characters/shixiu/cutout.png",
        "workflow": "workflows/api/qwen_shixiu_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "sunli_keyart",
        "type": "character_keyart",
        "character": "孙立",
        "source": "assets/raw/shuihu_sunli_keyart_v2_clean_00001_.png",
        "final": "assets/characters/sunli/keyart.png",
        "workflow": "workflows/api/qwen_sunli_keyart_v2_clean.json",
        "processing": "Qwen Image 2.1 targeted cleanup for pseudo-text banners",
    },
    {
        "id": "sunli_turnaround",
        "type": "character_turnaround",
        "character": "孙立",
        "source": "assets/raw/shuihu_sunli_turnaround_v1_00001_.png",
        "final": "assets/characters/sunli/turnaround.png",
        "workflow": "workflows/api/qwen_sunli_turnaround_v1.json",
    },
    {
        "id": "sunli_cutout",
        "type": "character_cutout",
        "character": "孙立",
        "source": "assets/characters/sunli/cutout.png",
        "source_raw": "assets/raw/shuihu_sunli_cutout_v1_00001_.png",
        "final": "assets/characters/sunli/cutout.png",
        "workflow": "workflows/api/qwen_sunli_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "yuehe_keyart",
        "type": "character_keyart",
        "character": "乐和",
        "source": "assets/raw/shuihu_yuehe_keyart_v1_00001_.png",
        "final": "assets/characters/yuehe/keyart.png",
        "workflow": "workflows/api/qwen_yuehe_keyart_v1.json",
    },
    {
        "id": "yuehe_turnaround",
        "type": "character_turnaround",
        "character": "乐和",
        "source": "assets/raw/shuihu_yuehe_turnaround_v1_00001_.png",
        "final": "assets/characters/yuehe/turnaround.png",
        "workflow": "workflows/api/qwen_yuehe_turnaround_v1.json",
    },
    {
        "id": "yuehe_cutout",
        "type": "character_cutout",
        "character": "乐和",
        "source": "assets/characters/yuehe/cutout.png",
        "source_raw": "assets/raw/shuihu_yuehe_cutout_v1_00001_.png",
        "final": "assets/characters/yuehe/cutout.png",
        "workflow": "workflows/api/qwen_yuehe_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "xiaorang_keyart",
        "type": "character_keyart",
        "character": "萧让",
        "source": "assets/raw/shuihu_xiaorang_keyart_v2_clean_00001_.png",
        "final": "assets/characters/xiaorang/keyart.png",
        "workflow": "workflows/api/qwen_xiaorang_keyart_v2_clean.json",
        "processing": "Qwen Image 2.1 targeted cleanup for pseudo-text calligraphy",
    },
    {
        "id": "xiaorang_turnaround",
        "type": "character_turnaround",
        "character": "萧让",
        "source": "assets/raw/shuihu_xiaorang_turnaround_v1_00001_.png",
        "final": "assets/characters/xiaorang/turnaround.png",
        "workflow": "workflows/api/qwen_xiaorang_turnaround_v1.json",
    },
    {
        "id": "xiaorang_cutout",
        "type": "character_cutout",
        "character": "萧让",
        "source": "assets/characters/xiaorang/cutout.png",
        "source_raw": "assets/raw/shuihu_xiaorang_cutout_v1_00001_.png",
        "final": "assets/characters/xiaorang/cutout.png",
        "workflow": "workflows/api/qwen_xiaorang_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    {
        "id": "jiangjing_keyart",
        "type": "character_keyart",
        "character": "蒋敬",
        "source": "assets/raw/shuihu_jiangjing_keyart_v2_clean_00001_.png",
        "final": "assets/characters/jiangjing/keyart.png",
        "workflow": "workflows/api/qwen_jiangjing_keyart_v2_clean.json",
        "processing": "Qwen Image 2.1 targeted cleanup for pseudo-text labels",
    },
    {
        "id": "jiangjing_turnaround",
        "type": "character_turnaround",
        "character": "蒋敬",
        "source": "assets/raw/shuihu_jiangjing_turnaround_v1_00001_.png",
        "final": "assets/characters/jiangjing/turnaround.png",
        "workflow": "workflows/api/qwen_jiangjing_turnaround_v1.json",
    },
    {
        "id": "jiangjing_cutout",
        "type": "character_cutout",
        "character": "蒋敬",
        "source": "assets/characters/jiangjing/cutout.png",
        "source_raw": "assets/raw/shuihu_jiangjing_cutout_v1_00001_.png",
        "final": "assets/characters/jiangjing/cutout.png",
        "workflow": "workflows/api/qwen_jiangjing_cutout_v1.json",
        "processing": "Transparent cutout plus tools/fit_sprite_canvas.py at 896x1024 RGBA",
    },
    # Environments and faction assets
    {
        "id": "yellow_river_ferry",
        "type": "environment",
        "source": "assets/raw/shuihu_env_yellow_river_ferry_v1_00001_.png",
        "final": "assets/environments/yellow_river_ferry.png",
        "workflow": "workflows/api/qwen_env_yellow_river_ferry_v1.json",
    },
    {
        "id": "bianjing_snow_night",
        "type": "environment",
        "source": "assets/raw/shuihu_env_bianjing_street_v2_00001_.png",
        "final": "assets/environments/bianjing_snow_night.png",
        "workflow": "workflows/api/qwen_env_bianjing_street_v2_text_clean.json",
    },
    {
        "id": "boar_forest",
        "type": "environment",
        "source": "assets/raw/shuihu_env_boar_forest_v1_00001_.png",
        "final": "assets/environments/boar_forest.png",
        "workflow": "workflows/api/qwen_env_boar_forest_v1.json",
    },
    {
        "id": "liangshan_water_fort",
        "type": "environment",
        "source": "assets/raw/shuihu_env_liangshan_water_fort_v1_00001_.png",
        "final": "assets/environments/liangshan_water_fort.png",
        "workflow": "workflows/api/qwen_env_liangshan_water_fort_v1.json",
    },
    {
        "id": "qingfeng_fort",
        "type": "environment",
        "source": "assets/raw/shuihu_env_qingfeng_fort_v1_00001_.png",
        "final": "assets/environments/qingfeng_fort.png",
        "workflow": "workflows/api/qwen_env_qingfeng_fort_v1.json",
    },
    {
        "id": "jiangzhou_execution_ground",
        "type": "environment",
        "source": "assets/raw/shuihu_env_jiangzhou_execution_v1_00001_.png",
        "final": "assets/environments/jiangzhou_execution.png",
        "workflow": "workflows/api/qwen_env_jiangzhou_execution_v1.json",
    },
    {
        "id": "zhujiazhuang_snow_night",
        "type": "environment",
        "source": "assets/raw/shuihu_env_zhujiazhuang_snow_night_v2_clean_00001_.png",
        "final": "assets/environments/zhujiazhuang_snow_night.png",
        "workflow": "workflows/api/qwen_env_zhujiazhuang_snow_night_v2_clean.json",
        "processing": "Qwen Image 2.1 targeted cleanup for all pseudo-text signage",
    },
    {
        "id": "damingfu_lantern_night",
        "type": "environment",
        "source": "assets/raw/shuihu_env_damingfu_lantern_night_v1_00001_.png",
        "final": "assets/environments/damingfu_lantern_night.png",
        "workflow": "workflows/api/qwen_env_damingfu_lantern_night_v1.json",
    },
    {
        "id": "enemy_lineup",
        "type": "enemy_lineup",
        "source": "assets/raw/shuihu_enemy_lineup_v1_00001_.png",
        "final": "assets/enemies/northern_song_enemy_lineup.png",
        "workflow": "workflows/api/qwen_enemy_lineup_v1.json",
    },
    {
        "id": "enemy_runner",
        "type": "enemy_sprite",
        "character": "县衙差役",
        "source": "assets/enemies/runner.png",
        "final": "assets/enemies/runner.png",
        "source_raw": "assets/raw/shuihu_enemy_lineup_v1_00001_.png",
        "workflow": "workflows/api/qwen_enemy_lineup_v1.json",
    },
    {
        "id": "enemy_archer",
        "type": "enemy_sprite",
        "character": "官府弓手",
        "source": "assets/enemies/archer.png",
        "final": "assets/enemies/archer.png",
        "source_raw": "assets/raw/shuihu_enemy_lineup_v1_00001_.png",
        "workflow": "workflows/api/qwen_enemy_lineup_v1.json",
    },
    {
        "id": "enemy_instructor",
        "type": "enemy_sprite",
        "character": "禁军教头",
        "source": "assets/enemies/instructor.png",
        "final": "assets/enemies/instructor.png",
        "source_raw": "assets/raw/shuihu_enemy_lineup_v1_00001_.png",
        "workflow": "workflows/api/qwen_enemy_lineup_v1.json",
    },
    {
        "id": "enemy_captain",
        "type": "enemy_sprite",
        "character": "沧州押差首领",
        "source": "assets/enemies/captain.png",
        "final": "assets/enemies/captain.png",
        "source_raw": "assets/raw/shuihu_enemy_lineup_v1_00001_.png",
        "workflow": "workflows/api/qwen_enemy_lineup_v1.json",
    },
    {
        "id": "enemy_executioner",
        "type": "enemy_sprite",
        "character": "江州行刑官",
        "source": "assets/enemies/executioner.png",
        "final": "assets/enemies/executioner.png",
        "source_raw": "assets/raw/shuihu_executioner_keyart_v1_00001_.png",
        "workflow": "workflows/api/qwen_executioner_keyart_v1.json",
        "processing": "Apple Vision foreground segmentation and 896x1024 normalized canvas",
    },
    {
        "id": "enemy_zhu_guard_keyart",
        "type": "enemy_keyart",
        "character": "祝家庄教师",
        "source": "assets/raw/shuihu_zhu_guard_keyart_v1_00001_.png",
        "final": "assets/enemies/zhu_guard_keyart.png",
        "workflow": "workflows/api/qwen_zhu_guard_keyart_v1.json",
    },
    {
        "id": "enemy_zhu_guard",
        "type": "enemy_sprite",
        "character": "祝家庄教师",
        "source": "assets/raw/shuihu_zhu_guard_cutout_v1_00001_.png",
        "final": "assets/enemies/zhu_guard.png",
        "workflow": "workflows/api/qwen_zhu_guard_cutout_v1.json",
    },
    {
        "id": "enemy_daming_captain_keyart",
        "type": "enemy_keyart",
        "character": "大名府都监",
        "source": "assets/raw/shuihu_daming_captain_keyart_v1_00001_.png",
        "final": "assets/enemies/daming_captain_keyart.png",
        "workflow": "workflows/api/qwen_daming_captain_keyart_v1.json",
    },
    {
        "id": "enemy_daming_captain",
        "type": "enemy_sprite",
        "character": "大名府都监",
        "source": "assets/raw/shuihu_daming_captain_cutout_v1_00001_.png",
        "final": "assets/enemies/daming_captain.png",
        "workflow": "workflows/api/qwen_daming_captain_cutout_v1.json",
    },
    # Transparent UI sheets
    {
        "id": "path_icon_sheet",
        "type": "ui_icon_sheet",
        "source": "assets/ui/sheets/path_icons_transparent.png",
        "final": "assets/ui/sheets/path_icons_transparent.png",
        "workflow": "workflows/api/qwen_ui_path_icons_v1.json",
    },
    {
        "id": "status_icon_sheet",
        "type": "ui_icon_sheet",
        "source": "assets/ui/sheets/status_icons_transparent.png",
        "final": "assets/ui/sheets/status_icons_transparent.png",
        "workflow": "workflows/api/qwen_ui_status_icons_v1.json",
    },
    {
        "id": "resource_icon_sheet",
        "type": "ui_icon_sheet",
        "source": "assets/ui/sheets/resource_icons_transparent.png",
        "final": "assets/ui/sheets/resource_icons_transparent.png",
        "workflow": "workflows/api/qwen_ui_resource_icons_v1.json",
    },
]


VIDEO_ASSETS = [
    {
        "id": "bianjing_snow_night_video",
        "type": "cinematic_video",
        "source": "assets/video/shuihu_video_bianjing_snow_night_v1_00001_.mp4",
        "final": "assets/video/bianjing_snow_night_5s.mp4",
        "workflow": "workflows/api/minimax_h3_bianjing_snow_night_v1.json",
    },
    {
        "id": "bianjing_snow_night_poster",
        "type": "video_poster",
        "source": "assets/video/bianjing_snow_night_poster.png",
        "final": "assets/video/bianjing_snow_night_poster.png",
        "workflow": "workflows/api/minimax_h3_bianjing_snow_night_v1.json",
    },
]

VFX_ASSETS = [
    {
        "id": "vfx_gang",
        "type": "skill_vfx_video",
        "source": "assets/vfx/gang.mp4",
        "source_raw": "assets/raw/vfx/shuihu_vfx_gang_raw_00001_.mp4",
        "final": "assets/vfx/gang.mp4",
        "workflow": "workflows/api/minimax_vfx_gang_v1.json",
    },
    {
        "id": "vfx_gang_alpha",
        "type": "skill_vfx_alpha_video",
        "source": "assets/vfx/gang-alpha.webm",
        "source_raw": "assets/raw/vfx/shuihu_vfx_gang_raw_00001_.mp4",
        "final": "assets/vfx/gang-alpha.webm",
        "workflow": "workflows/api/minimax_vfx_gang_v1.json",
    },
    {
        "id": "vfx_ling",
        "type": "skill_vfx_video",
        "source": "assets/vfx/ling.mp4",
        "source_raw": "assets/raw/vfx/shuihu_vfx_ling_raw_00001_.mp4",
        "final": "assets/vfx/ling.mp4",
        "workflow": "workflows/api/minimax_vfx_ling_v1.json",
    },
    {
        "id": "vfx_ling_alpha",
        "type": "skill_vfx_alpha_video",
        "source": "assets/vfx/ling-alpha.webm",
        "source_raw": "assets/raw/vfx/shuihu_vfx_ling_raw_00001_.mp4",
        "final": "assets/vfx/ling-alpha.webm",
        "workflow": "workflows/api/minimax_vfx_ling_v1.json",
    },
    {
        "id": "vfx_tao",
        "type": "skill_vfx_video",
        "source": "assets/vfx/tao.mp4",
        "source_raw": "assets/raw/vfx/shuihu_vfx_tao_raw_00001_.mp4",
        "final": "assets/vfx/tao.mp4",
        "workflow": "workflows/api/minimax_vfx_tao_v1.json",
    },
    {
        "id": "vfx_tao_alpha",
        "type": "skill_vfx_alpha_video",
        "source": "assets/vfx/tao-alpha.webm",
        "source_raw": "assets/raw/vfx/shuihu_vfx_tao_raw_00001_.mp4",
        "final": "assets/vfx/tao-alpha.webm",
        "workflow": "workflows/api/minimax_vfx_tao_v1.json",
    },
    {
        "id": "vfx_shou",
        "type": "skill_vfx_video",
        "source": "assets/vfx/shou.mp4",
        "source_raw": "assets/raw/vfx/shuihu_vfx_shou_raw_00001_.mp4",
        "final": "assets/vfx/shou.mp4",
        "workflow": "workflows/api/minimax_vfx_shou_v1.json",
    },
    {
        "id": "vfx_shou_alpha",
        "type": "skill_vfx_alpha_video",
        "source": "assets/vfx/shou-alpha.webm",
        "source_raw": "assets/raw/vfx/shuihu_vfx_shou_raw_00001_.mp4",
        "final": "assets/vfx/shou-alpha.webm",
        "workflow": "workflows/api/minimax_vfx_shou_v1.json",
    },
    {
        "id": "vfx_gang_poster",
        "type": "skill_vfx_poster",
        "source": "assets/vfx/gang-poster.png",
        "final": "assets/vfx/gang-poster.png",
        "workflow": "workflows/api/minimax_vfx_gang_v1.json",
    },
    {
        "id": "vfx_ling_poster",
        "type": "skill_vfx_poster",
        "source": "assets/vfx/ling-poster.png",
        "final": "assets/vfx/ling-poster.png",
        "workflow": "workflows/api/minimax_vfx_ling_v1.json",
    },
    {
        "id": "vfx_tao_poster",
        "type": "skill_vfx_poster",
        "source": "assets/vfx/tao-poster.png",
        "final": "assets/vfx/tao-poster.png",
        "workflow": "workflows/api/minimax_vfx_tao_v1.json",
    },
    {
        "id": "vfx_shou_poster",
        "type": "skill_vfx_poster",
        "source": "assets/vfx/shou-poster.png",
        "final": "assets/vfx/shou-poster.png",
        "workflow": "workflows/api/minimax_vfx_shou_v1.json",
    },
]

AUDIO_LOOP_METHOD = (
    "4-second equal-power crossfade + 120ms post-master boundary seal"
)

AUDIO_ASSETS = [
    {
        "id": "title_theme",
        "type": "music_loop",
        "file": "assets/audio/title_theme.mp3",
        "pipeline": "ComfyUI + YuE2",
        "model": "yue2_3b_int8_convrot.safetensors",
        "workflow": "tools/comfy_music_pipeline.py",
        "seed": 183107,
        "target_duration": 36,
        "loop_method": AUDIO_LOOP_METHOD,
        "usage": "title and narrative scenes",
    },
    {
        "id": "jianghu_theme",
        "type": "music_loop",
        "file": "assets/audio/jianghu_theme.mp3",
        "pipeline": "ComfyUI + YuE2",
        "model": "yue2_3b_int8_convrot.safetensors",
        "workflow": "tools/comfy_music_pipeline.py",
        "seed": 183211,
        "target_duration": 36,
        "loop_method": AUDIO_LOOP_METHOD,
        "usage": "map, camp, roster, formation, equipment and settings",
    },
    {
        "id": "battle_theme",
        "type": "music_loop",
        "file": "assets/audio/battle_theme.mp3",
        "pipeline": "ComfyUI + YuE2",
        "model": "yue2_3b_int8_convrot.safetensors",
        "workflow": "tools/comfy_music_pipeline.py",
        "seed": 183319,
        "target_duration": 36,
        "loop_method": AUDIO_LOOP_METHOD,
        "usage": "campaign battles and endless arena",
    },
    {
        "id": "ending_theme",
        "type": "music_loop",
        "file": "assets/audio/ending_theme.mp3",
        "pipeline": "ComfyUI + YuE2",
        "model": "yue2_3b_int8_convrot.safetensors",
        "workflow": "tools/comfy_music_pipeline.py",
        "seed": 183427,
        "target_duration": 36,
        "loop_method": AUDIO_LOOP_METHOD,
        "usage": "rewards, final choice and endings",
    },
    {
        "id": "qingfeng_theme",
        "type": "music_loop",
        "file": "assets/audio/qingfeng_theme.mp3",
        "pipeline": "ComfyUI + YuE2",
        "model": "yue2_3b_int8_convrot.safetensors",
        "workflow": "tools/comfy_music_pipeline.py",
        "seed": 183539,
        "target_duration": 36,
        "loop_method": AUDIO_LOOP_METHOD,
        "usage": "Qingfeng Fort moonlit story scenes",
    },
    {
        "id": "jiangzhou_theme",
        "type": "music_loop",
        "file": "assets/audio/jiangzhou_theme.mp3",
        "pipeline": "ComfyUI + YuE2",
        "model": "yue2_3b_int8_convrot.safetensors",
        "workflow": "tools/comfy_music_pipeline.py",
        "seed": 183641,
        "target_duration": 36,
        "loop_method": AUDIO_LOOP_METHOD,
        "usage": "Jiangzhou execution-ground story and non-boss battle scenes",
    },
    {
        "id": "zhujiazhuang_theme",
        "type": "music_loop",
        "file": "assets/audio/zhujiazhuang_theme.mp3",
        "pipeline": "ComfyUI + YuE2",
        "model": "yue2_3b_int8_convrot.safetensors",
        "workflow": "tools/comfy_music_pipeline.py",
        "seed": 183681,
        "target_duration": 36,
        "loop_method": AUDIO_LOOP_METHOD,
        "usage": "Zhujiazhuang snowbound fortress story and battle scenes",
    },
    {
        "id": "damingfu_theme",
        "type": "music_loop",
        "file": "assets/audio/damingfu_theme.mp3",
        "pipeline": "ComfyUI + YuE2",
        "model": "yue2_3b_int8_convrot.safetensors",
        "workflow": "tools/comfy_music_pipeline.py",
        "seed": 183709,
        "target_duration": 36,
        "loop_method": AUDIO_LOOP_METHOD,
        "usage": "Damingfu Lantern Festival infiltration story and battle scenes",
    },
    {
        "id": "boss_theme",
        "type": "music_loop",
        "file": "assets/audio/boss_theme.mp3",
        "pipeline": "ComfyUI + YuE2",
        "model": "yue2_3b_int8_convrot.safetensors",
        "workflow": "tools/comfy_music_pipeline.py",
        "seed": 183757,
        "target_duration": 36,
        "loop_method": AUDIO_LOOP_METHOD,
        "usage": "campaign boss battles and arena boss waves",
    },
    {
        "id": "recruitment_theme",
        "type": "music_loop",
        "file": "assets/audio/recruitment_theme.mp3",
        "pipeline": "ComfyUI + YuE2",
        "model": "yue2_3b_int8_convrot.safetensors",
        "workflow": "tools/comfy_music_pipeline.py",
        "seed": 183899,
        "target_duration": 36,
        "loop_method": AUDIO_LOOP_METHOD,
        "usage": "recruitment scroll story, oath battles and recruitment rewards",
    },
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def find_prompt(value: Any) -> str | None:
    if isinstance(value, dict):
        class_type = value.get("class_type")
        inputs = value.get("inputs", {})
        if class_type in {"TextEncodeQwenImage21", "MiniMaxH3ImageToVideo"}:
            prompt = inputs.get("prompt")
            if isinstance(prompt, str):
                return prompt
        for child in value.values():
            prompt = find_prompt(child)
            if prompt:
                return prompt
    elif isinstance(value, list):
        for child in value:
            prompt = find_prompt(child)
            if prompt:
                return prompt
    return None


def find_seed(value: Any) -> int | None:
    if isinstance(value, dict):
        class_type = value.get("class_type")
        inputs = value.get("inputs", {})
        if class_type == "KSampler":
            seed = inputs.get("seed")
            if isinstance(seed, int):
                return seed
        if class_type == "RandomNoise":
            seed = inputs.get("noise_seed")
            if isinstance(seed, int):
                return seed
        for child in value.values():
            seed = find_seed(child)
            if seed is not None:
                return seed
    elif isinstance(value, list):
        for child in value:
            seed = find_seed(child)
            if seed is not None:
                return seed
    return None


def image_metadata(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        metadata: dict[str, Any] = {
            "width": image.width,
            "height": image.height,
            "mode": image.mode,
        }
        if image.mode == "RGBA":
            alpha = image.getchannel("A")
            metadata["alpha_range"] = list(alpha.getextrema())
            metadata["alpha_bbox"] = list(alpha.getbbox() or (0, 0, 0, 0))
    return metadata


def normalize_character_cutout(path: Path) -> None:
    """Fit every runtime hero to the same bottom-aligned production canvas."""
    with Image.open(path) as source:
        image = source.convert("RGBA")
    alpha = image.getchannel("A").point(
        lambda value: value if value > CHARACTER_ALPHA_THRESHOLD else 0
    )
    image.putalpha(alpha)
    bounds = alpha.getbbox()
    if not bounds:
        raise SystemExit(f"Character cutout has no visible pixels: {path}")
    figure = image.crop(bounds)
    available_width = round(CHARACTER_CANVAS_WIDTH * CHARACTER_CANVAS_SCALE)
    available_height = round(CHARACTER_CANVAS_HEIGHT * CHARACTER_CANVAS_SCALE)
    scale = min(
        available_width / figure.width,
        available_height / figure.height,
    )
    resized = figure.resize(
        (
            max(1, round(figure.width * scale)),
            max(1, round(figure.height * scale)),
        ),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new(
        "RGBA",
        (CHARACTER_CANVAS_WIDTH, CHARACTER_CANVAS_HEIGHT),
        (0, 0, 0, 0),
    )
    x = (CHARACTER_CANVAS_WIDTH - resized.width) // 2
    y = CHARACTER_CANVAS_HEIGHT - CHARACTER_CANVAS_BOTTOM_MARGIN - resized.height
    canvas.alpha_composite(resized, (x, y))
    canvas.save(path, optimize=True)


def audio_metadata(path: Path) -> dict[str, Any]:
    probe = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=codec_name,sample_rate,channels:format=duration,bit_rate",
            "-of",
            "json",
            str(path),
        ],
        text=True,
    )
    data = json.loads(probe)
    stream = (data.get("streams") or [{}])[0]
    format_info = data.get("format") or {}
    return {
        "codec": stream.get("codec_name"),
        "sample_rate": int(stream["sample_rate"]) if stream.get("sample_rate") else None,
        "channels": stream.get("channels"),
        "duration_seconds": round(float(format_info["duration"]), 3)
        if format_info.get("duration")
        else None,
        "bit_rate": int(format_info["bit_rate"]) if format_info.get("bit_rate") else None,
    }


def build_entry(asset: dict[str, str]) -> dict[str, Any]:
    source = ROOT / asset["source"]
    final = ROOT / asset["final"]
    workflow_path = ROOT / asset["workflow"]
    if not source.exists():
        raise FileNotFoundError(source)
    if source != final:
        final.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, final)
    if asset["type"] == "character_cutout":
        normalize_character_cutout(final)
    if final.suffix.lower() == ".png" and asset["type"] not in {
        "character_cutout",
        "enemy_sprite",
        "skill_vfx_poster",
        "ui_icon_sheet",
    }:
        with Image.open(final) as image:
            if image.mode != "RGB":
                image.convert("RGB").save(final)
    workflow = json.loads(workflow_path.read_text(encoding="utf-8"))
    entry: dict[str, Any] = {
        "id": asset["id"],
        "type": asset["type"],
        "file": asset["final"],
        "source_raw": asset.get("source_raw", asset["source"]),
        "workflow": asset["workflow"],
        "seed": find_seed(workflow),
        "sha256": sha256(final),
        "bytes": final.stat().st_size,
    }
    for key in ("character", "processing", "derived_raw"):
        if key in asset:
            entry[key] = asset[key]
    if asset["type"] == "character_cutout":
        entry["processing"] = asset.get(
            "processing",
            "Transparent cutout, alpha cleanup, and "
            "tools/fit_sprite_canvas.py normalization at 896x1024 RGBA",
        )
    if final.suffix.lower() == ".png":
        entry.update(image_metadata(final))
    prompt = find_prompt(workflow)
    if prompt:
        entry["prompt"] = prompt
    return entry


def build_audio_entry(asset: dict[str, Any]) -> dict[str, Any]:
    path = ROOT / asset["file"]
    if not path.exists():
        raise FileNotFoundError(path)
    entry = {
        **asset,
        "sha256": sha256(path),
        "bytes": path.stat().st_size,
    }
    entry.update(audio_metadata(path))
    return entry


def main() -> int:
    entries: list[dict[str, Any]] = []
    for asset in ASSETS:
        entries.append(build_entry(asset))
    for asset in VIDEO_ASSETS:
        source = ROOT / asset["source"]
        if source.exists():
            entries.append(build_entry(asset))
        else:
            print(f"Skipping missing video: {asset['source']}")
    for asset in VFX_ASSETS:
        entries.append(build_entry(asset))
    for asset in AUDIO_ASSETS:
        entries.append(build_audio_entry(asset))

    icon_dir = ROOT / "assets/ui/icons"
    for icon in sorted(icon_dir.glob("*_512.png")):
        entries.append(
            {
                "id": f"icon_{icon.stem}",
                "type": "ui_icon",
                "file": str(icon.relative_to(ROOT)),
                "width": 512,
                "height": 512,
                "mode": "RGBA",
                "sha256": sha256(icon),
                "bytes": icon.stat().st_size,
            }
        )

    manifest = {
        "project": "星命水浒",
        "pipeline": {
            "image": "ComfyUI + Qwen Image 2.1",
            "video": "ComfyUI + MiniMax H3",
            "music": "ComfyUI + YuE2 3B",
            "upscale": "SeedVR2 7B (available for final engine textures)",
        },
        "asset_count": len(entries),
        "assets": entries,
    }
    output = ROOT / "assets/manifest.json"
    output.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Wrote {output} with {len(entries)} assets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
