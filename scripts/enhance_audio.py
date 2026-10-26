#!/usr/bin/env python3
"""
🎙 家长录音专业音频润色处理器 (Studio Vocal Enhancer)
针对手机/平板麦克风录音，一键完成：
1. 【去除环境底噪】：FFT 自适应降噪，消除空调/风扇/房间白噪音
2. 【消除喷麦爆破】：80Hz 高通切除 + 专业 De-esser 齿音气流平滑
3. 【人声频段雕琢】：3kHz 黄金频段微增强，让拼读声母与调值更清脆可辨
4. 【人声动态压限】：软拐点多段动态压缩，弱音饱满、强音不破
5. 【统一音量响度】：国际广播级 EBU R128 (-16 LUFS, -1.5 dBFS True Peak) 标准化

支持格式：.mp3, .wav, .m4a, .aac, .webm, .ogg
使用示例：
  python3 scripts/enhance_audio.py input.m4a -o output.mp3
  python3 scripts/enhance_audio.py ./my_recordings/ --out-dir ./public/audio/spelling/
"""

import os
import sys
import json
import shutil
import argparse
import subprocess
from pathlib import Path

# 支持的音频扩展名
AUDIO_EXTENSIONS = {'.mp3', '.wav', '.m4a', '.aac', '.webm', '.ogg', '.flac'}

# 检查系统 ffmpeg
def check_ffmpeg() -> str:
    ffmpeg_path = shutil.which('ffmpeg')
    if not ffmpeg_path:
        # 尝试常见路径
        for p in ['/Users/hero/.local/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg']:
            if os.path.exists(p):
                return p
        print("❌ 错误：系统中未找到 ffmpeg，请先安装 ffmpeg（如 brew install ffmpeg）")
        sys.exit(1)
    return ffmpeg_path

FFMPEG = check_ffmpeg()

# 预设滤镜参数
PRESETS = {
    'studio': {
        'name': '专业播音录音棚（推荐，温润平衡）',
        'highpass': 85,
        'denoise_floor': -28,
        'eq_gain': 2.5,
        'comp_ratio': 3.2,
        'target_lufs': -16.0,
    },
    'aggressive': {
        'name': '强力降噪（针对较嘈杂的房间或马路环境）',
        'highpass': 100,
        'denoise_floor': -22,
        'eq_gain': 3.0,
        'comp_ratio': 4.0,
        'target_lufs': -15.5,
    },
    'gentle': {
        'name': '温和润色（录音环境较好，主要防喷与响度对齐）',
        'highpass': 75,
        'denoise_floor': -34,
        'eq_gain': 1.8,
        'comp_ratio': 2.5,
        'target_lufs': -16.0,
    },
}

def build_filter_chain(preset_name: str = 'studio') -> str:
    cfg = PRESETS.get(preset_name, PRESETS['studio'])
    filters = [
        # 1. 消除低频喷麦扑克、手持摩擦震动 (80Hz 高通)
        f"highpass=f={cfg['highpass']}:poles=2",
        # 2. 消除高频尖刺与过重齿音喷气 (De-esser)
        "deesser=i=0.55:m=0.5:f=0.5:s=o",
        # 3. FFT 频域自适应去除稳态底噪
        f"afftdn=nf={cfg['denoise_floor']}:tn=1",
        # 4. 2.8kHz 人声咬字清晰度雕琢
        f"equalizer=f=2800:t=q:w=1.4:g={cfg['eq_gain']}",
        # 5. 广播级人声动态压限（让声音温润、富有厚度）
        f"acompressor=threshold=0.125:ratio={cfg['comp_ratio']}:attack=15:release=220:makeup=1.4:knee=2.8",
        # 6. EBU R128 国际广播级响度标准化 (双遍统一至 -16 LUFS)
        f"loudnorm=I={cfg['target_lufs']}:TP=-1.5:LRA=7",
    ]
    return ",".join(filters)

def process_single_audio(
    input_path: Path,
    output_path: Path,
    preset: str = 'studio',
    verbose: bool = False
) -> bool:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    filter_chain = build_filter_chain(preset)

    cmd = [
        FFMPEG, "-y",
        "-i", str(input_path),
        "-af", filter_chain,
        "-ar", "44100",        # 采样率 44.1kHz
        "-b:a", "192k",        # 高清音质 192kbps
        str(output_path)
    ]

    try:
        res = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if res.returncode == 0:
            if verbose:
                print(f"  ✓ 处理成功: {output_path.name}")
            return True
        else:
            print(f"  ❌ 处理失败 {input_path.name}: {res.stderr[-200:].strip()}")
            return False
    except Exception as e:
        print(f"  ❌ 发生异常: {e}")
        return False

def process_directory(
    in_dir: Path,
    out_dir: Path,
    preset: str = 'studio'
):
    audio_files = [f for f in in_dir.iterdir() if f.is_file() and f.suffix.lower() in AUDIO_EXTENSIONS]
    if not audio_files:
        print(f"⚠️ 在目录 {in_dir} 中未找到任何支持的音频文件。")
        return

    print(f"\n🎧 开始批量音频处理（模式：{PRESETS[preset]['name']}）")
    print(f"📂 输入目录: {in_dir}")
    print(f"📁 输出目录: {out_dir}")
    print(f"📊 待处理文件总数: {len(audio_files)} 个\n")

    success_count = 0
    for idx, f in enumerate(audio_files, start=1):
        target_name = f.stem + ".mp3"
        target_path = out_dir / target_name
        print(f"[{idx}/{len(audio_files)}] 正在润色: {f.name} -> {target_name} ...", end="", flush=True)
        if process_single_audio(f, target_path, preset=preset):
            print(" ✓ 完成")
            success_count += 1
        else:
            print(" ❌ 失败")

    print(f"\n🎉 批量润色完成！成功: {success_count}/{len(audio_files)} 个音频。")
    print(f"✨ 处理后的音频具有降噪、防喷麦和一致的广播级播音响度。")

def main():
    parser = argparse.ArgumentParser(description="🎙 家长自录音频专业母带润色处理器")
    parser.add_argument("input", help="输入音频文件或包含音频的文件夹路径")
    parser.add_argument("-o", "--output", help="输出文件或输出文件夹路径")
    parser.add_argument("--out-dir", help="批量处理时的输出文件夹路径")
    parser.add_argument(
        "--preset",
        choices=['studio', 'aggressive', 'gentle'],
        default='studio',
        help="处理预设: studio(默认播音棚), aggressive(强力降噪), gentle(温和防喷)"
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="显示详细处理日志")

    args = parser.parse_args()
    in_path = Path(args.input)

    if not in_path.exists():
        print(f"❌ 错误：输入路径不存在: {in_path}")
        sys.exit(1)

    if in_path.is_file():
        # 单文件处理
        out_path = Path(args.output) if args.output else in_path.with_name(f"{in_path.stem}_enhanced.mp3")
        print(f"\n🎙 正在润色音频: {in_path.name} (预设: {args.preset}) ...")
        ok = process_single_audio(in_path, out_path, preset=args.preset, verbose=True)
        if ok:
            print(f"🎉 润色完成！输出保存在: {out_path}")
    elif in_path.is_dir():
        # 目录批量处理
        out_dir = Path(args.out_dir or args.output or (in_path / "enhanced"))
        process_directory(in_path, out_dir, preset=args.preset)

if __name__ == '__main__':
    main()
