import {
  AudioLines,
  Copy,
  Mic,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  Field,
  Input,
  PageHeader,
} from "../components/ui";
import { api, errorMessage, type Voice } from "../lib/api";
import { useAdvancedMode, useAudioPlayer, useSavedVoices } from "../lib/hooks";

const MAX_SAMPLES = 5;
const MAX_SAMPLE_BYTES = 10 * 1024 * 1024;

// Read aloud during recording; it doubles as the sample's transcript.
const SCRIPT =
  "Hello, and thank you for calling. We're open Monday to Saturday, and we'd be happy to help " +
  "you book an appointment, answer a question about our prices, or tell you how to find us. " +
  "If you'd like to leave a message, just tell me your name and number and we'll call you back " +
  "as soon as we can. Thanks again, and have a wonderful day.";

function stateLabel(state: string): { tone: "green" | "amber" | "red"; text: string } {
  if (state === "trained") return { tone: "green", text: "Ready" };
  if (state === "failed") return { tone: "red", text: "Didn't work" };
  return { tone: "amber", text: "Getting ready…" };
}

export default function Voices() {
  const saved = useSavedVoices();
  const [advanced] = useAdvancedMode();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState<string>();
  const [toDelete, setToDelete] = useState<Voice>();
  const [deleting, setDeleting] = useState(false);
  const [addId, setAddId] = useState("");
  const [adding, setAdding] = useState(false);
  const [sampling, setSampling] = useState<string>();
  const player = useAudioPlayer();

  // Voices take a little while to train; check on pending ones automatically.
  const pending = saved.voices.filter((v) => v.state !== "trained" && v.state !== "failed");
  useEffect(() => {
    if (pending.length === 0) return;
    const timer = setInterval(() => {
      pending.forEach((v) => api.getVoice(v.id).then(saved.upsert, () => {}));
    }, 10_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.map((v) => v.id).join()]);

  const refresh = async (id: string) => {
    setRefreshing(id);
    setError(undefined);
    try {
      saved.upsert(await api.getVoice(id));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRefreshing(undefined);
    }
  };

  const addExisting = async (e: FormEvent) => {
    e.preventDefault();
    if (!addId.trim()) return;
    setAdding(true);
    setError(undefined);
    try {
      saved.upsert(await api.getVoice(addId.trim()));
      setAddId("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const sample = async (v: Voice) => {
    if (sampling === v.id && player.playing) return player.stop();
    setSampling(v.id);
    setError(undefined);
    try {
      player.play(await api.tts("Hello, thanks for calling. How can I help you today?", v.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.deleteVoice(toDelete.id);
      saved.remove(toDelete.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(false);
      setToDelete(undefined);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="How it sounds"
        title="Voices"
        description="Your assistant can speak with a standard voice, or with yours, or a staff member's."
      />

      {error && (
        <div className="mb-4">
          <Alert onClose={() => setError(undefined)}>{error}</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CloneVoiceForm onCloned={saved.upsert} />
        </div>

        <Card className="lg:col-span-2" title="Your voices">
          {saved.voices.length === 0 ? (
            <EmptyState
              icon={<AudioLines className="size-5" />}
              title="No custom voices yet"
              description="Record one on the left. Until then, your assistants use the standard voice."
            />
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {saved.voices.map((v) => {
                const st = stateLabel(v.state);
                return (
                  <li key={v.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{v.title}</span>
                        <Badge tone={st.tone} dot>
                          {st.text}
                        </Badge>
                      </div>
                      {advanced && (
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <code className="truncate text-xs text-slate-500">{v.id}</code>
                          <button
                            className="text-slate-400 hover:text-slate-600"
                            onClick={() => navigator.clipboard?.writeText(v.id)}
                            aria-label="Copy voice ID"
                          >
                            <Copy className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {v.state === "trained" ? (
                        <Button variant="secondary" icon={<Volume2 className="size-4" />} onClick={() => sample(v)}>
                          {sampling === v.id && player.playing ? "Stop" : "Listen"}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          title="Check again"
                          loading={refreshing === v.id}
                          icon={<RefreshCw className="size-4" />}
                          onClick={() => refresh(v.id)}
                        />
                      )}
                      {advanced && (
                        <Button
                          variant="ghost"
                          title="Hide from this list"
                          icon={<X className="size-4" />}
                          onClick={() => saved.remove(v.id)}
                        />
                      )}
                      <Button
                        variant="ghost"
                        className="text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete voice"
                        icon={<Trash2 className="size-4" />}
                        onClick={() => setToDelete(v)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {advanced && (
            <form onSubmit={addExisting} className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
              <Input value={addId} onChange={(e) => setAddId(e.target.value)} placeholder="Add an existing voice by ID" />
              <Button type="submit" variant="secondary" loading={adding} icon={<Plus className="size-4" />}>
                Add
              </Button>
            </form>
          )}
        </Card>
      </div>

      <ConfirmModal
        open={!!toDelete}
        title={`Delete “${toDelete?.title}”?`}
        danger
        loading={deleting}
        confirmLabel="Delete voice"
        message={
          <p>
            This voice will be deleted for good. Any assistant using it will switch to the standard
            voice.
          </p>
        }
        onConfirm={remove}
        onClose={() => setToDelete(undefined)}
      />
    </>
  );
}

type Sample = { blob: Blob; name: string; transcript: string };

function CloneVoiceForm({ onCloned }: { onCloned: (v: Voice) => void }) {
  const [title, setTitle] = useState("");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string }>();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number>();

  useEffect(() => () => window.clearInterval(timer.current), []);

  const record = async () => {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    setMsg(undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      const started = Date.now();
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        window.clearInterval(timer.current);
        setRecording(false);
        if ((Date.now() - started) / 1000 < 5) {
          setMsg({ tone: "error", text: "That was a bit short. Please read the whole paragraph." });
          return;
        }
        const blob = new Blob(chunks, { type: rec.mimeType });
        setSamples((s) => [...s, { blob, name: `Recording ${s.length + 1}`, transcript: SCRIPT }].slice(0, MAX_SAMPLES));
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      timer.current = window.setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 250);
      setRecording(true);
    } catch {
      setMsg({ tone: "error", text: "We couldn't use your microphone. Please allow microphone access in your browser." });
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list);
    const tooBig = files.find((f) => f.size > MAX_SAMPLE_BYTES);
    if (tooBig) {
      setMsg({ tone: "error", text: `${tooBig.name} is too large. Each file must be under 10 MB.` });
      return;
    }
    setSamples((s) => [...s, ...files.map((f) => ({ blob: f, name: f.name, transcript: "" }))].slice(0, MAX_SAMPLES));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const form = new FormData();
    form.append("title", title);
    form.append("consent", String(consent));
    samples.forEach((s) => form.append("files", s.blob, s.blob instanceof File ? s.name : `${s.name}.webm`));
    // The API wants a transcript for every sample or none.
    if (samples.every((s) => s.transcript)) samples.forEach((s) => form.append("transcripts", s.transcript));

    setSaving(true);
    setMsg(undefined);
    try {
      const voice = await api.cloneVoice(form);
      onCloned(voice);
      setMsg({
        tone: "success",
        text:
          voice.state === "trained"
            ? `“${voice.title}” is ready. Choose it on an assistant's Details tab.`
            : `“${voice.title}” is being prepared. It usually takes a minute or two.`,
      });
      setTitle("");
      setSamples([]);
      setConsent(false);
    } catch (err) {
      setMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Create a voice" description="Record about 30 seconds of clear speech in a quiet room.">
      <form onSubmit={submit} className="space-y-5">
        {msg && (
          <Alert tone={msg.tone} onClose={() => setMsg(undefined)}>
            {msg.text}
          </Alert>
        )}

        <div className="rounded-xl bg-slate-50 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Read this aloud</div>
          <p className="text-[0.9375rem] leading-relaxed text-slate-800">{SCRIPT}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant={recording ? "danger" : "primary"}
              className={recording ? "!bg-red-600 !text-white !ring-red-700/40 hover:!bg-red-700" : ""}
              icon={recording ? <Square className="size-4" /> : <Mic className="size-4" />}
              onClick={record}
              disabled={!recording && samples.length >= MAX_SAMPLES}
            >
              {recording ? "Stop recording" : samples.length ? "Record again" : "Start recording"}
            </Button>
            {recording && (
              <span className="flex items-center gap-2 text-sm text-red-600">
                <span className="size-2 animate-pulse rounded-full bg-red-600" />
                Recording… {seconds}s
              </span>
            )}
            {!recording && (
              <label className="cursor-pointer text-sm text-slate-500 hover:text-slate-800">
                <Upload className="mr-1 inline size-4" />
                or upload audio files
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </div>

        {samples.length > 0 && (
          <ul className="space-y-2">
            {samples.map((s, i) => (
              <SampleRow key={i} sample={s} onRemove={() => setSamples((x) => x.filter((_, j) => j !== i))} />
            ))}
          </ul>
        )}

        <Field label="Name this voice">
          <Input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Maria at the front desk" />
        </Field>

        <label className="flex items-start gap-2.5 text-sm text-slate-600">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border-slate-300 accent-brand-600"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          This is my own voice, or the person speaking has agreed to have their voice used.
        </label>

        <Button type="submit" className="h-10 w-full" loading={saving} disabled={!consent || samples.length === 0 || !title.trim() || recording}>
          Create voice
        </Button>
      </form>
    </Card>
  );
}

function SampleRow({ sample, onRemove }: { sample: Sample; onRemove: () => void }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(sample.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [sample.blob]);
  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-200 p-2 pl-3">
      <span className="w-28 shrink-0 truncate text-sm font-medium">{sample.name}</span>
      <audio controls src={url} className="h-8 min-w-0 flex-1" />
      <button type="button" onClick={onRemove} className="text-slate-400 hover:text-slate-600" aria-label={`Remove ${sample.name}`}>
        <X className="size-4" />
      </button>
    </li>
  );
}
