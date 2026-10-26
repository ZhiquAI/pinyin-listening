#!/bin/bash
# ========================================================
# 拼音听写 - 一键同步录音到 GitHub 仓库与线上 GitHub Pages
# ========================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "🔍 [1/3] 扫描并整理录音文件清单..."
python3 -c "
import os, json

audio_dir = 'public/audio/custom'
manifest_path = os.path.join(audio_dir, 'manifest.json')
manifest = {}

if os.path.exists(audio_dir):
    for f in os.listdir(audio_dir):
        if f.endswith('.wav') or f.endswith('.mp3'):
            item_id = os.path.splitext(f)[0]
            manifest[item_id] = f

with open(manifest_path, 'w', encoding='utf-8') as mf:
    json.dump(manifest, mf, ensure_ascii=False, indent=2)

print(f'✅ 已同步录音清单，当前共收录 {len(manifest)} 条原声音频。')
"

echo "📦 [2/3] 检查 Git 变更..."
git status -s public/audio/custom

AUDIO_CHANGES=$(git status --porcelain public/audio/custom)
if [ -z "$AUDIO_CHANGES" ]; then
  echo "ℹ️ 没有检测到新的录音文件变更，无需提交。"
  exit 0
fi

echo "🚀 [3/3] 提交并推送至 GitHub..."
git add public/audio/custom
git commit -m "feat(audio): 更新词条自录真人原声并同步至全网"
git push origin main

echo "🎉 录音已成功同步至 GitHub！GitHub Actions 正在自动部署上线，稍等 1 分钟即可在所有设备（iPad/手机）上直接听到您的声音！"
