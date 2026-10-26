import { describe, it, expect } from 'vitest';
import {
  applyBiquadFilter,
  applyNoiseGate,
  applyDeclickFade,
  applyLoudnessNormalization,
  encodeFloat32ToWavBlob,
  processAudioSamples,
} from '../src/features/audioDSP';

describe('audioDSP 前端内存母带音频处理', () => {
  const sampleRate = 44100;

  it('85Hz 高通滤波应显著衰减 30Hz 喷麦低频，但保留 300Hz 人声基频', () => {
    const length = 4410; // 0.1s
    const lowFreqSignal = new Float32Array(length);
    const midFreqSignal = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      lowFreqSignal[i] = Math.sin((2 * Math.PI * 30 * i) / sampleRate);
      midFreqSignal[i] = Math.sin((2 * Math.PI * 300 * i) / sampleRate);
    }

    const filteredLow = applyBiquadFilter(lowFreqSignal, sampleRate, 'highpass', 85);
    const filteredMid = applyBiquadFilter(midFreqSignal, sampleRate, 'highpass', 85);

    // 统计后半段稳定态能量
    let lowEnergy = 0;
    let midEnergy = 0;
    for (let i = 2000; i < length; i++) {
      lowEnergy += Math.abs(filteredLow[i]);
      midEnergy += Math.abs(filteredMid[i]);
    }

    // 30Hz 低频应被大幅压制，远小于 300Hz 人声
    expect(lowEnergy).toBeLessThan(midEnergy * 0.3);
  });

  it('软拐点降噪门应衰减微弱底噪', () => {
    const length = 2000;
    const quietNoise = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      // 约 -50dBFS 的极微弱环境底噪
      quietNoise[i] = 0.003 * (Math.random() * 2 - 1);
    }

    const gated = applyNoiseGate(quietNoise, sampleRate, -40);
    let originalMax = 0;
    let gatedMax = 0;
    for (let i = 500; i < length; i++) {
      if (Math.abs(quietNoise[i]) > originalMax) originalMax = Math.abs(quietNoise[i]);
      if (Math.abs(gated[i]) > gatedMax) gatedMax = Math.abs(gated[i]);
    }

    expect(gatedMax).toBeLessThan(originalMax);
  });

  it('响度标准化应将平稳信号峰值提升至 -1.0 dBFS (约 0.891)', () => {
    const length = 1000;
    const signal = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      signal[i] = 0.2 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }

    const normalized = applyLoudnessNormalization(signal, -1.0);
    let max = 0;
    for (let i = 0; i < length; i++) {
      if (Math.abs(normalized[i]) > max) max = Math.abs(normalized[i]);
    }

    expect(max).toBeCloseTo(0.891, 2);
  });

  it('De-click 淡入淡出应将首尾采样平滑衰减至零', () => {
    const length = 1000;
    const signal = new Float32Array(length).fill(0.5);

    const faded = applyDeclickFade(signal, sampleRate, 10, 20);
    expect(faded[0]).toBeCloseTo(0, 2);
    expect(faded[length - 1]).toBeCloseTo(0, 2);
    expect(faded[500]).toBeCloseTo(0.5, 2);
  });

  it('WAV 编码生成的二进制头部有效且符合规范', async () => {
    const length = 100;
    const signal = new Float32Array(length).fill(0.1);
    const blob = encodeFloat32ToWavBlob(signal, 44100);

    expect(blob.type).toBe('audio/wav');
    const arrayBuffer = await blob.arrayBuffer();
    const view = new DataView(arrayBuffer);

    // RIFF 标识
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    expect(riff).toBe('RIFF');

    // WAVE 标识
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    expect(wave).toBe('WAVE');

    // fmt 块
    const fmt = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
    expect(fmt).toBe('fmt ');

    // 16 bit PCM mono
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(44100); // 44.1kHz
  });

  it('完整 processAudioSamples 运行无崩溃且无 NaN / Infinity', () => {
    const length = 4410;
    const signal = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      signal[i] = 0.3 * Math.sin(i * 0.1) + 0.01 * (Math.random() * 2 - 1);
    }

    const processed = processAudioSamples(signal, sampleRate);
    expect(processed.length).toBe(length);
    for (let i = 0; i < length; i++) {
      expect(Number.isNaN(processed[i])).toBe(false);
      expect(Number.isFinite(processed[i])).toBe(true);
    }
  });
});
