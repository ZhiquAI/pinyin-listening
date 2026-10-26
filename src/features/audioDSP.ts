/**
 * 纯前端内存音频 DSP 处理管道 (In-Memory Audio Enhancement)
 * 无需任何后台或外部服务，在浏览器/iPad本地完成广播级母带级降噪防喷处理：
 * 1. 85Hz 高通滤波（消除喷麦、低频风声扑麦声与手持震动）
 * 2. 11kHz 低通滤波（去除超高频电流声与刺耳毛刺）
 * 3. 软拐点包络向下扩展降噪（消除人声间歇底噪，无突兀抽吸感）
 * 4. 首尾抗爆音淡入淡出（De-click Fade In / Out）
 * 5. 峰值响度标准化（将人声标准化至 -1.0 dBFS，音量饱满一致）
 * 6. 无损 16-bit PCM WAV 内存编码（全平台 100% 原生无缝播放）
 */

// 1. 双二阶滤波器 (Biquad Filter - Direct Form I)
export function applyBiquadFilter(
  data: Float32Array,
  sampleRate: number,
  type: 'highpass' | 'lowpass',
  cutoffFreq: number,
  Q: number = 0.7071
): Float32Array {
  const output = new Float32Array(data.length);
  const w0 = (2 * Math.PI * cutoffFreq) / sampleRate;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const alpha = sinw0 / (2 * Q);

  let b0 = 0, b1 = 0, b2 = 0, a0 = 0, a1 = 0, a2 = 0;

  if (type === 'highpass') {
    b0 = (1 + cosw0) / 2;
    b1 = -(1 + cosw0);
    b2 = (1 + cosw0) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosw0;
    a2 = 1 - alpha;
  } else {
    // lowpass
    b0 = (1 - cosw0) / 2;
    b1 = 1 - cosw0;
    b2 = (1 - cosw0) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosw0;
    a2 = 1 - alpha;
  }

  const normB0 = b0 / a0;
  const normB1 = b1 / a0;
  const normB2 = b2 / a0;
  const normA1 = a1 / a0;
  const normA2 = a2 / a0;

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

  for (let i = 0; i < data.length; i++) {
    const x0 = data[i];
    const y0 = normB0 * x0 + normB1 * x1 + normB2 * x2 - normA1 * y1 - normA2 * y2;
    output[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  return output;
}

// 2. 软拐点包络跟踪向下扩展（平滑降噪门）
export function applyNoiseGate(
  data: Float32Array,
  sampleRate: number,
  thresholdDb: number = -40,
  ratio: number = 3.5,
  kneeDb: number = 8
): Float32Array {
  const output = new Float32Array(data.length);

  const attackMs = 6;
  const releaseMs = 70;
  const attackCoeff = Math.exp(-1 / ((attackMs / 1000) * sampleRate));
  const releaseCoeff = Math.exp(-1 / ((releaseMs / 1000) * sampleRate));

  let envelope = 0;

  for (let i = 0; i < data.length; i++) {
    const absVal = Math.abs(data[i]);
    if (absVal > envelope) {
      envelope = attackCoeff * envelope + (1 - attackCoeff) * absVal;
    } else {
      envelope = releaseCoeff * envelope + (1 - releaseCoeff) * absVal;
    }

    const envDb = 20 * Math.log10(Math.max(1e-6, envelope));
    let gainDb = 0;

    if (envDb < thresholdDb - kneeDb / 2) {
      // 门限以下，平滑向下衰减
      gainDb = (thresholdDb - envDb) * (1 - ratio);
      // 限制最大门限衰减为 -18dB，避免过度截断造成失真与绝对死寂
      gainDb = Math.max(-18, gainDb);
    } else if (envDb <= thresholdDb + kneeDb / 2) {
      // 软拐点过渡区
      const x = envDb - thresholdDb + kneeDb / 2;
      const factor = (x * x) / (2 * kneeDb);
      gainDb = (factor - x) * (1 - 1 / ratio);
      gainDb = Math.max(-18, gainDb);
    } else {
      gainDb = 0;
    }

    const gainLinear = Math.pow(10, gainDb / 20);
    output[i] = data[i] * gainLinear;
  }

  return output;
}

// 3. 首尾防爆音去咔嗒声微淡入淡出（De-click Fade）
export function applyDeclickFade(
  data: Float32Array,
  sampleRate: number,
  fadeInMs: number = 10,
  fadeOutMs: number = 20
): Float32Array {
  const output = new Float32Array(data);
  const fadeInSamples = Math.min(Math.floor((fadeInMs / 1000) * sampleRate), Math.floor(output.length / 2));
  const fadeOutSamples = Math.min(Math.floor((fadeOutMs / 1000) * sampleRate), Math.floor(output.length / 2));

  for (let i = 0; i < fadeInSamples; i++) {
    const factor = 0.5 * (1 - Math.cos((Math.PI * i) / fadeInSamples));
    output[i] *= factor;
  }

  const startFadeOut = output.length - fadeOutSamples;
  for (let i = 0; i < fadeOutSamples; i++) {
    const factor = 0.5 * (1 + Math.cos((Math.PI * i) / fadeOutSamples));
    output[startFadeOut + i] *= factor;
  }

  return output;
}

// 4. 响度标准化（峰值标准化到 targetPeakDb，默认 -1.0 dBFS）
export function applyLoudnessNormalization(
  data: Float32Array,
  targetPeakDb: number = -1.0,
  maxGainFactor: number = 5.0
): Float32Array {
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const val = Math.abs(data[i]);
    if (val > peak) peak = val;
  }

  if (peak < 0.005) {
    return new Float32Array(data);
  }

  const targetPeakLinear = Math.pow(10, targetPeakDb / 20); // 约 0.891
  let gain = targetPeakLinear / peak;
  gain = Math.min(gain, maxGainFactor);

  const output = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    output[i] = Math.max(-1.0, Math.min(1.0, data[i] * gain));
  }
  return output;
}

// 5. 将处理好的 PCM Float32 数据直接编码为标准 16-bit 单声道 WAV 文件
export function encodeFloat32ToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF chunk descriptor */
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');

  /* FMT sub-chunk */
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16 bit)

  /* data sub-chunk */
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

// 6. 对 Float32Array 执行整套 DSP 母带处理流水线
export function processAudioSamples(
  monoData: Float32Array,
  sampleRate: number
): Float32Array {
  // 1. 85Hz 高通滤波防喷扑麦
  let processed = applyBiquadFilter(monoData, sampleRate, 'highpass', 85, 0.7071);
  // 2. 11kHz 低通滤波去除极高频毛刺与电流声
  processed = applyBiquadFilter(processed, sampleRate, 'lowpass', 11000, 0.7071);
  // 3. 软拐点降噪门（阈值 -40dBFS，平滑压制底噪）
  processed = applyNoiseGate(processed, sampleRate, -40, 3.5, 8);
  // 4. 首尾平滑去爆音淡入淡出
  processed = applyDeclickFade(processed, sampleRate, 12, 25);
  // 5. 响度标准化（-1.0 dBFS Peak）
  processed = applyLoudnessNormalization(processed, -1.0, 5.0);

  return processed;
}

// 7. 前端极速母带处理并返回 DataURL (带双重兼容与 1500ms 超时安全熔断)
export async function enhanceAudioBlob(audioBlob: Blob): Promise<string> {
  // 安全熔断定时器：绝不超过 1.5 秒，保证录音 100% 能够保存，避免在任何设备上卡死
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Audio DSP decode timeout')), 1500)
  );

  const processPromise = (async () => {
    const AudioCtx =
      typeof window !== 'undefined'
        ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : null;

    if (!AudioCtx) throw new Error('No AudioContext');

    const ctx = new AudioCtx();
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      const arrayBuffer = await audioBlob.arrayBuffer();

      // 兼容标准 Promise 与部分 Safari 遗留回调签名
      const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        let isDone = false;
        try {
          const res = ctx.decodeAudioData(
            arrayBuffer,
            (buf) => {
              if (!isDone) { isDone = true; resolve(buf); }
            },
            (err) => {
              if (!isDone) { isDone = true; reject(err); }
            }
          );
          if (res && typeof (res as Promise<AudioBuffer>).then === 'function') {
            (res as Promise<AudioBuffer>).then(
              (buf) => { if (!isDone) { isDone = true; resolve(buf); } },
              (err) => { if (!isDone) { isDone = true; reject(err); } }
            );
          }
        } catch (e) {
          reject(e);
        }
      });

      const numChannels = audioBuffer.numberOfChannels;
      const length = audioBuffer.length;
      const sampleRate = audioBuffer.sampleRate;
      const monoData = new Float32Array(length);

      if (numChannels === 1) {
        monoData.set(audioBuffer.getChannelData(0));
      } else {
        const ch0 = audioBuffer.getChannelData(0);
        const ch1 = audioBuffer.getChannelData(1);
        for (let i = 0; i < length; i++) {
          monoData[i] = (ch0[i] + ch1[i]) * 0.5;
        }
      }

      const processed = processAudioSamples(monoData, sampleRate);
      const wavBlob = encodeFloat32ToWavBlob(processed, sampleRate);

      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(wavBlob);
      });
    } finally {
      try {
        await ctx.close();
      } catch {}
    }
  })();

  try {
    return await Promise.race([processPromise, timeoutPromise]);
  } catch (err) {
    console.warn('In-memory DSP fallback to raw recording due to:', err);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(audioBlob);
    });
  }
}
