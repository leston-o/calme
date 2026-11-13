import { Check, Heart, Loader2, Play, Plus, Search, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage, type LibraryVoice } from "../lib/api";
import { LANGUAGES } from "../lib/businessTypes";
import { useSavedVoices } from "../lib/hooks";
import { Alert, cx, Input, Select } from "./ui";

const STYLES = ["calm", "friendly", "professional", "conversational", "warm", "clear"];

/** Browse ready-made voices: read the description, play a sample, then choose. */
export default function VoiceLibrary({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (voice: LibraryVoice) => void;
}) {
  const saved = useSavedVoices();
  const [source, setSource] = useState<"library" | "mine">("library");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [language, setLanguage] = useState("en");
  const [gender, setGender] = useState<"" | "female" | "male">("");
  const [style, setStyle] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<LibraryVoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string>();

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 400);
    return () => window.clearTimeout(t);
  }, [query]);

  // New filters start again from page 1.
  useEffect(() => setPage(1), [source, debounced, language, gender, style]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    api
      .voiceLibrary({
        q: debounced || undefined,
        language: language || undefined,
        tags: [gender, style].filter(Boolean),
        mine: source === "mine",
        page,
      })
      .then((res) => {
        if (cancelled) return;
        setTotal(res.total);
        setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items.filter((v) => !prev.some((p) => p.id === v.id))]));
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [source, debounced, language, gender, style, page]);

  useEffect(() => () => audio.current?.pause(), []);

  const toggleSample = (key: string, url: string) => {
    audio.current?.pause();
    if (playing === key) {
      setPlaying(undefined);
      return;
    }
    const a = new Audio(url);
    audio.current = a;
    a.onended = () => setPlaying(undefined);
    a.onerror = () => {
      setPlaying(undefined);
      setError("That sample couldn't be played.");
    };
    setPlaying(key);
    a.play().catch(() => setPlaying(undefined));
  };

  const hasMore = page * 30 < total && page < 100;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-slate-100 p-1">
          {(
            [
              ["library", "Voice library"],
              ["mine", "On my account"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSource(key)}
              className={cx(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                source === key ? "bg-slate-950 text-white" : "text-slate-500 hover:text-slate-950",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="!rounded-full pl-10" placeholder="Search voices by name" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {source === "library" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select className="!w-auto !rounded-full !py-1.5" value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language">
            <option value="">Any language</option>
            {LANGUAGES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </Select>
          {(
            [
              ["", "Any voice"],
              ["female", "Female"],
              ["male", "Male"],
            ] as const
          ).map(([g, label]) => (
            <Chip key={label} active={gender === g} onClick={() => setGender(g)}>
              {label}
            </Chip>
          ))}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          {STYLES.map((s) => (
            <Chip key={s} active={style === s} onClick={() => setStyle(style === s ? "" : s)}>
              {s[0].toUpperCase() + s.slice(1)}
            </Chip>
          ))}
        </div>
      )}

      {source === "library" && (
        <p className="mt-3 text-xs text-slate-500">
          Community voices from Fish Audio. Character and novelty voices are hidden. Please don't
          choose a voice that imitates a real person.
        </p>
      )}

      {error && (
        <div className="mt-4">
          <Alert onClose={() => setError(undefined)}>{error}</Alert>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {items.map((v) => {
          const selected = selectedId === v.id;
          const isSaved = saved.voices.some((s) => s.id === v.id);
          const sample = v.samples[0];
          const key = `${v.id}:0`;
          return (
            <div
              key={v.id}
              className={cx(
                "flex flex-col rounded-[1.25rem] border p-4 transition",
                selected ? "border-slate-950 bg-slate-50 ring-4 ring-slate-950/5" : "border-slate-200/80 bg-white hover:border-slate-300",
              )}
            >
              <div className="flex items-start gap-3">
                <Cover voice={v} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-950" title={v.title}>
                    {v.title}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                    {v.languages.length > 0 && (
                      <span>
                        {v.languages
                          .slice(0, 3)
                          .map((l) => LANGUAGES.find(([c]) => c === l)?.[1] ?? l.toUpperCase())
                          .join(", ")}
                      </span>
                    )}
                    {v.like_count > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Heart className="size-3" />
                        {v.like_count.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {v.description && <p className="mt-3 line-clamp-3 text-sm text-slate-600">{v.description}</p>}

              {v.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {v.tags.slice(0, 5).map((t) => (
                    <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.6875rem] text-slate-600">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {sample && (
                <button
                  type="button"
                  onClick={() => toggleSample(key, sample.audio_url)}
                  className="mt-4 flex items-start gap-2.5 rounded-xl bg-brand-50/70 p-2.5 text-left ring-1 ring-brand-100 hover:bg-brand-50"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                    {playing === key ? <Square className="size-3" /> : <Play className="size-3 translate-x-px" />}
                  </span>
                  <span className="line-clamp-2 text-xs italic text-slate-600">
                    {sample.text ? `“${sample.text}”` : "Play sample"}
                  </span>
                </button>
              )}

              <div className="mt-4 flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onSelect(v)}
                  className={cx(
                    "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition",
                    selected ? "bg-slate-950 text-white" : "bg-white text-slate-800 ring-1 ring-inset ring-slate-200 hover:bg-slate-50",
                  )}
                >
                  {selected && <Check className="size-4" />}
                  {selected ? "Selected" : "Use this voice"}
                </button>
                <button
                  type="button"
                  onClick={() => (isSaved ? saved.remove(v.id) : saved.upsert({ id: v.id, title: v.title, state: "trained" }))}
                  title={isSaved ? "Remove from my voices" : "Save to my voices, so assistants can use it"}
                  className={cx(
                    "inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-medium ring-1 ring-inset transition",
                    isSaved ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "text-slate-600 ring-slate-200 hover:bg-slate-50",
                  )}
                >
                  {isSaved ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                  {isSaved ? "Saved" : "Save"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Finding voices…
        </div>
      )}
      {!loading && items.length === 0 && !error && (
        <p className="rounded-2xl bg-slate-50 py-10 text-center text-sm text-slate-500">
          {source === "mine" ? "No voices on this account yet. Create one on the Voices page." : "No voices match. Try fewer filters."}
        </p>
      )}
      {!loading && hasMore && (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex h-10 items-center rounded-full px-5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
          >
            Show more voices
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-full px-3 py-1.5 text-xs font-medium transition",
        active ? "bg-slate-950 text-white" : "text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}

function Cover({ voice }: { voice: LibraryVoice }) {
  const [broken, setBroken] = useState(false);
  if (voice.cover_url && !broken)
    return (
      <img
        src={voice.cover_url}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className="size-11 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
      />
    );
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 font-display text-xl text-slate-500">
      {voice.title.slice(0, 1).toUpperCase()}
    </span>
  );
}
