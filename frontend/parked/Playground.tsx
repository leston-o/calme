import { Mic, Square, Upload, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, Input, PageHeader, Textarea } from "../components/ui";
import VoiceLibrary from "../components/VoiceLibrary";
import { api, errorMessage, type LibraryVoice } from "../lib/api";
import { useAudioPlayer } from "../lib/hooks";

export default function Playground() {
  return (
    <>
      <PageHeader
        eyebrow="Advanced"
        title="Playground"
        description="Browse voices, listen to samples and try text-to-speech and speech-to-text directly."
      />
      <div className="space-y-6">
        <TextToSpeech />
        <div className="max-w-2xl">
          <SpeechToText />
        </div>
      </div>
    </>
  );
}

function TextToSpeech() {
  const [text, setText] = useState("Hello, thanks for calling. How can I help you today?");
  const [voice, setVoice] = useState<LibraryVoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [audioUrl, setAudioUrl] = useState<string>();
  const player = useAudioPlayer();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const blob = await api.tts(text, voice?.id);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(blob));
      player.play(blob);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Card title="1. Choose a voice" description="Read each description and play its sample before choosing.">
        <VoiceLibrary selectedId={voice?.id ?? null} onSelect={setVoice} />
      </Card>

      <div className="xl:sticky xl:top-6 xl:self-start">
        <Card title="2. Generate speech">
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200/70">
              {voice?.cover_url ? (
                <img src={voice.cover_url} alt="" className="size-10 rounded-full object-cover" />
              ) : (
                <span className="flex size-10 items-center justify-center rounded-full bg-white font-display text-lg text-slate-500 ring-1 ring-slate-200">
                  {voice ? voice.title.slice(0, 1).toUpperCase() : "S"}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-500">Voice</div>
                <div className="truncate text-sm font-medium">{voice?.title ?? "Standard voice"}</div>
              </div>
              {voice && (
                <button type="button" onClick={() => setVoice(null)} className="text-xs font-medium text-slate-500 hover:text-slate-950">
                  Use standard
                </button>
              )}
            </div>
            {error && <Alert onClose={() => setError(undefined)}>{error}</Alert>}
            <Field label="Text to speak" hint={`${text.length}/1000`}>
              <Textarea required rows={6} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <div className="flex items-center gap-2">
              <Button type="submit" className="flex-1" loading={loading} icon={<Volume2 className="size-4" />} disabled={!text.trim()}>
                Generate speech
              </Button>
              {player.playing && (
                <Button type="button" variant="secondary" icon={<Square className="size-4" />} onClick={player.stop}>
                  Stop
                </Button>
              )}
            </div>
            {audioUrl && <audio controls src={audioUrl} className="w-full" />}
          </form>
        </Card>
      </div>
    </div>
  );
}

function SpeechToText() {
  const [file, setFile] = useState<File | Blob>();
  const [language, setLanguage] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<string>();
  const recorder = useRef<MediaRecorder | null>(null);

  const record = async () => {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    setError(undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setFile(new Blob(chunks, { type: rec.mimeType }));
        setRecording(false);
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
    } catch (err) {
      setError(`Microphone error: ${errorMessage(err)}`);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.append("file", file, file instanceof File ? file.name : "recording.webm");
    if (language) form.append("language", language);
    setLoading(true);
    setError(undefined);
    try {
      setResult((await api.stt(form)).text);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const fileLabel = !file ? null : file instanceof File ? file.name : "Microphone recording";

  return (
    <Card title="Speech to text" description="Transcribe a recording or an uploaded file.">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert onClose={() => setError(undefined)}>{error}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={recording ? "danger" : "secondary"}
            icon={recording ? <Square className="size-4" /> : <Mic className="size-4" />}
            onClick={record}
          >
            {recording ? "Stop recording" : "Record"}
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            <Upload className="size-4" />
            Upload file
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
            />
          </label>
        </div>
        {fileLabel && (
          <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
            <div className="font-medium text-slate-700">{fileLabel}</div>
            <audio controls src={previewUrl} className="w-full" />
          </div>
        )}
        <Field label="Language" hint="Optional ISO code, e.g. en. Leave empty to auto-detect.">
          <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Auto" />
        </Field>
        <Button type="submit" loading={loading} disabled={!file || recording}>
          Transcribe
        </Button>
        {result !== undefined && (
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Transcript
            </div>
            <p className="whitespace-pre-wrap text-sm">{result || <em className="text-slate-400">No speech detected.</em>}</p>
          </div>
        )}
      </form>
    </Card>
  );
}
