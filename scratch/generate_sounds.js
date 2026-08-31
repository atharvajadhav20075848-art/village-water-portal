const fs = require('fs');
const path = require('path');

function createWavBuffer(sampleRate, durationSeconds, generateSample) {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const blockAlign = 2; // 16-bit mono = 2 bytes per sample
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20);  // PCM format
  buffer.writeUInt16LE(1, 22);  // mono (1 channel)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // 16 bits per sample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.max(-1, Math.min(1, generateSample(t, i, numSamples)));
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  return buffer;
}

// 1. LOUD POLICE / DAM EMERGENCY SIREN (Dual-Oscillator High Intensity Wail)
const sampleRate = 44100;
const sirenDuration = 4.0; // 4 seconds seamless loop

const sirenWav = createWavBuffer(sampleRate, sirenDuration, (t) => {
  // 1.5 Hz pitch modulation cycle (fast emergency wail)
  const cycle = (t % (sirenDuration / 2)) / (sirenDuration / 2); // 0 to 1 twice
  // Smooth triangle modulation between 650 Hz and 1350 Hz
  const freq = cycle < 0.5 
    ? 650 + (1350 - 650) * (cycle * 2) 
    : 1350 - (1350 - 650) * ((cycle - 0.5) * 2);

  // Main fundamental tone (Sine + Sawtooth mix for sharp piercing emergency punch)
  const phase = 2 * Math.PI * freq * t;
  const sin1 = Math.sin(phase);
  const saw1 = 2 * ((freq * t) % 1) - 1;
  
  // Secondary harmonic (Sub-harmonic 2nd overtone)
  const phase2 = 2 * Math.PI * (freq * 1.5) * t;
  const sin2 = Math.sin(phase2);

  // Emergency pulsing warble effect
  const warble = 0.8 + 0.2 * Math.sin(2 * Math.PI * 12 * t);

  return (sin1 * 0.55 + saw1 * 0.3 + sin2 * 0.15) * warble * 0.95;
});

// 2. SWEET WATER CHIME (for announcements & resolved notices)
const chimeDuration = 1.2;
const chimeWav = createWavBuffer(sampleRate, chimeDuration, (t) => {
  if (t < 0.6) {
    // First tone (E5: 659.25 Hz)
    const decay = Math.exp(-t * 8);
    return Math.sin(2 * Math.PI * 659.25 * t) * decay * 0.7;
  } else {
    // Second tone (A5: 880 Hz)
    const t2 = t - 0.6;
    const decay = Math.exp(-t2 * 6);
    return Math.sin(2 * Math.PI * 880 * t2) * decay * 0.8;
  }
});

// Ensure target directories exist
const publicSoundsDir = path.join(__dirname, '..', 'public', 'sounds');
const androidRawDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'raw');
const villageApkRawDir = path.join('C:', 'Users', 'Atharva', 'Downloads', 'stitch_village_water_management_portal', 'VILLAGE APK', 'app', 'src', 'main', 'res', 'raw');

[publicSoundsDir, androidRawDir, villageApkRawDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Write to public folder
fs.writeFileSync(path.join(publicSoundsDir, 'emergency_siren.wav'), sirenWav);
fs.writeFileSync(path.join(publicSoundsDir, 'chime.wav'), chimeWav);

// Write to Android res/raw folder
fs.writeFileSync(path.join(androidRawDir, 'emergency_siren.wav'), sirenWav);
fs.writeFileSync(path.join(androidRawDir, 'chime.wav'), chimeWav);

// Write to VILLAGE APK res/raw folder
if (fs.existsSync(villageApkRawDir)) {
  fs.writeFileSync(path.join(villageApkRawDir, 'emergency_siren.wav'), sirenWav);
  fs.writeFileSync(path.join(villageApkRawDir, 'chime.wav'), chimeWav);
}

console.log('✅ Generated authentic emergency siren & chime sound pack in all directories!');
