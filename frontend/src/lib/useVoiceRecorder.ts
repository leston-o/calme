import { useCallback, useEffect, useRef, useState } from "react";

// Records the microphone with the browser's own recorder, then converts the clip
// to 16 kHz mono WAV, which the voice provider accepts (browsers record WebM/MP4).
// Nothing is ever connected to the speakers, so the voice can't feed back into the mic.
const RATE = 16000;

function toWav(audio: AudioBuffer): Blob {
  const samples = audio.getChannelData(0);
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o: number, t: string) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: "audio/wav" });
}

/** Decode whatever the browser recorded, mix to mono and resample to 16 kHz. */
async function convert(recording: Blob): Promise<Blob> {
  const decoder = new AudioContext();
  try {
    const decoded = await decoder.decodeAudioData(await recording.arrayBuffer());
    const frames = Math.ceil(decoded.duration * RATE);
    const offline = new OfflineAudioContext(1, frames, RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination); // an offline render, not the speakers
    source.start();
    return toWav(await offline.startRendering());
  } finally {
    void decoder.close();
  }
}

export function useVoiceRecorder(maxSeconds = 30) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [clip, setClip] = useState<Blob>();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string>();
  const s = useRef({
    recorder: null as MediaRecorder | null,
    stream: null as MediaStream | null,
    meterCtx: null as AudioContext | null,
    parts: [] as Blob[],
    started: 0,
    timer: 0,
    frame: 0,
  }).current;

  const release = useCallback(() => {
    window.clearInterval(s.timer);
    cancelAnimationFrame(s.frame);
    s.stream?.getTracks().forEach((t) => t.stop());
    void s.meterCtx?.close();
    s.stream = s.meterCtx = null;
    setLevel(0);
  }, [s]);

  const stop = useCallback(() => {
    if (s.recorder && s.recorder.state !== "inactive") s.recorder.stop(); // onstop does the rest
  }, [s]);

  const start = useCallback(async () => {
    setError(undefined);
    setClip(undefined);
    if (typeof MediaRecorder === "undefined") {
      setError("Your browser can't record audio. Try the latest Chrome, Safari or Firefox.");
      return;
    }
    try {
      s.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch {
      setError("We couldn't use your microphone. Allow microphone access in your browser and try again.");
      return;
    }

    // a level meter that only listens; it's never connected to the speakers
    try {
      s.meterCtx = new AudioContext();
      const analyser = s.meterCtx.createAnalyser();
      analyser.fftSize = 1024;
      s.meterCtx.createMediaStreamSource(s.stream).connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 10));
        s.frame = requestAnimationFrame(tick);
      };
      s.frame = requestAnimationFrame(tick);
    } catch {
      /* no meter: recording still works */
    }

    s.parts = [];
    const recorder = new MediaRecorder(s.stream);
    s.recorder = recorder;
    recorder.ondataavailable = (e) => e.data.size && s.parts.push(e.data);
    recorder.onstop = async () => {
      release();
      setRecording(false);
      const raw = new Blob(s.parts, { type: recorder.mimeType || "audio/webm" });
      s.parts = [];
      setProcessing(true);
      try {
        setClip(await convert(raw));
      } catch {
        setError("We couldn't process that recording. Please try again.");
      } finally {
        setProcessing(false);
      }
    };
    recorder.start(250);
    s.started = Date.now();
    setSeconds(0);
    setRecording(true);
    s.timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - s.started) / 1000);
      setSeconds(elapsed);
      if (elapsed >= maxSeconds) stop();
    }, 250);
  }, [s, stop, release, maxSeconds]);

  const reset = useCallback(() => {
    setClip(undefined);
    setSeconds(0);
  }, []);

  // stop the microphone if the visitor leaves mid-recording
  useEffect(
    () => () => {
      if (s.recorder && s.recorder.state !== "inactive") {
        s.recorder.onstop = null;
        s.recorder.stop();
      }
      release();
    },
    [s, release],
  );

  return { recording, processing, seconds, level, clip, error, start, stop, reset };
}
