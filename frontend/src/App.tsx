import { Copy, Gauge, KeyRound, Loader2, Music2, Search, Sparkles, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { getMatches, getTracks, verifyTelegramSession } from "./lib/api";
import type { Track, TrackMatch } from "./lib/types";
import { getInitData, hapticSuccess, hapticTap, initTelegramShell } from "./lib/telegram";
import { cn } from "./lib/utils";
import { useDebouncedValue } from "./hooks";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Skeleton } from "./components/ui/skeleton";

const matchLabels = {
  perfect: "Идеальное сочетание",
  close: "Другие сочетания",
} satisfies Record<TrackMatch["type"], string>;

const classicKeysByCamelot: Record<string, string> = {
  "1A": "Abm",
  "1B": "B",
  "2A": "Ebm",
  "2B": "F#",
  "3A": "Bbm",
  "3B": "C#",
  "4A": "Fm",
  "4B": "Ab",
  "5A": "Cm",
  "5B": "Eb",
  "6A": "Gm",
  "6B": "Bb",
  "7A": "Dm",
  "7B": "F",
  "8A": "Am",
  "8B": "C",
  "9A": "Em",
  "9B": "G",
  "10A": "Bm",
  "10B": "D",
  "11A": "F#m",
  "11B": "A",
  "12A": "C#m",
  "12B": "E",
};

function formatKey(key: string) {
  const classicKey = classicKeysByCamelot[key];
  return classicKey ? `${key} / ${classicKey}` : key;
}

function formatDelta(delta: number, suffix = "") {
  if (delta === 0) return `0${suffix}`;
  return `${delta > 0 ? "+" : ""}${delta}${suffix}`;
}

function trackCopyText(source: Track, match: TrackMatch) {
  return `${source.artist} - ${source.title} (${formatKey(source.key)}, ${source.bpm} BPM) → ${match.track.artist} - ${match.track.title} (${formatKey(match.track.key)}, ${match.track.bpm} BPM)`;
}

function EnergyMeter({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Энергия ${value} из 10`}>
      {Array.from({ length: 10 }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-3 w-1 rounded-full bg-white/10",
            index < value && "bg-[linear-gradient(to_top,#34d399,#67e8f9)]",
          )}
        />
      ))}
    </div>
  );
}

function CoverImage({ track }: { track: Track }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(track.cover_url && !failed);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [track.cover_url]);

  return (
    <div className="relative size-12 shrink-0 overflow-hidden rounded-md">
      {showImage && !loaded && <Skeleton className="absolute inset-0" />}
      {showImage ? (
        <img
          src={track.cover_url ?? ""}
          alt={`${track.title} — обложка`}
          className={cn("h-full w-full object-cover transition-opacity duration-200 ease-out", loaded ? "opacity-100" : "opacity-0")}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(52,211,153,.26),rgba(56,189,248,.18),rgba(255,255,255,.06))]">
          <Music2 className="size-5 text-emerald-100/90" />
        </div>
      )}
    </div>
  );
}

function TrackRow({
  track,
  selected,
  onSelect,
}: {
  track: Track;
  selected: boolean;
  onSelect: (track: Track) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(track)}
      className={cn(
        "group grid w-full grid-cols-[auto_1fr_auto] gap-3 rounded-md border p-3 text-left transition-[background,border-color,transform] duration-150 ease-out active:scale-[0.995]",
        selected
          ? "border-primary/60 bg-primary/12"
          : "border-white/8 bg-white/[0.035] hover:border-white/18 hover:bg-white/[0.06]",
      )}
    >
      <CoverImage track={track} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-foreground">{track.title}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{track.artist}</span>
        <span className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
          <span>{track.genre}</span>
          <EnergyMeter value={track.energy} />
        </span>
      </span>
      <span className="flex flex-col items-end gap-2">
        <Badge variant={selected ? "perfect" : "default"}>{formatKey(track.key)}</Badge>
        <span className="font-mono text-xs text-muted-foreground">{track.bpm} BPM</span>
      </span>
    </button>
  );
}

function MatchRow({
  source,
  match,
  onCopied,
}: {
  source: Track;
  match: TrackMatch;
  onCopied: () => void;
}) {
  async function copyMatch() {
    hapticTap();
    await navigator.clipboard.writeText(trackCopyText(source, match));
    hapticSuccess();
    onCopied();
  }

  return (
    <article className="rounded-md border border-white/10 bg-white/[0.045] p-4 shadow-glow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <CoverImage track={match.track} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={match.type === "perfect" ? "perfect" : "close"}>{matchLabels[match.type]}</Badge>
              <Badge variant="default">{match.track.genre}</Badge>
            </div>
            <h3 className="mt-3 truncate text-base font-extrabold text-foreground">{match.track.title}</h3>
            <p className="mt-1 truncate text-sm text-muted-foreground">{match.track.artist}</p>
          </div>
        </div>
        <Button size="icon" variant="secondary" onClick={copyMatch} aria-label="Скопировать сочетание">
          <Copy className="size-4" />
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-md border border-white/8 bg-black/20 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <KeyRound className="size-3.5" />
            Тональность
          </div>
          <div className="mt-2 font-mono text-lg font-bold text-foreground">{formatKey(match.track.key)}</div>
        </div>
        <div className="rounded-md border border-white/8 bg-black/20 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <Gauge className="size-3.5" />
            Темп
          </div>
          <div className="mt-2 font-mono text-lg font-bold text-foreground">{match.track.bpm}</div>
        </div>
        <div className="rounded-md border border-white/8 bg-black/20 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <Waves className="size-3.5" />
            Сдвиг
          </div>
          <div className="mt-2 font-mono text-lg font-bold text-foreground">{formatDelta(match.bpmDelta)}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant={Math.abs(match.bpmDelta) <= 2 ? "perfect" : "warning"}>
          BPM {formatDelta(match.bpmDelta)}
        </Badge>
        <Badge variant={match.keyDelta === 0 ? "perfect" : "close"}>Ключ {match.keyDelta}</Badge>
        <span className="inline-flex h-7 items-center text-xs font-medium text-muted-foreground">{match.reason}</span>
      </div>
    </article>
  );
}

export function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [matches, setMatches] = useState<TrackMatch[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState<TrackMatch["type"]>("perfect");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    initTelegramShell();

    const initData = getInitData();
    if (initData) {
      verifyTelegramSession(initData).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const normalizedQuery = debouncedQuery.trim();

    if (normalizedQuery.length < 2) {
      setTracks([]);
      setMatchesLoading(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setMatchesLoading(false);

    getTracks(normalizedQuery)
      .then(({ tracks: loadedTracks }) => {
        setTracks(loadedTracks);
      })
      .catch((err: Error) => {
        setTracks([]);
        setError(err.message || "Не удалось загрузить треки");
      })
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  useEffect(() => {
    if (!selectedTrack || debouncedQuery.trim().length < 2) {
      setMatches([]);
      return;
    }

    setMatchesLoading(true);
    getMatches(selectedTrack.id, debouncedQuery.trim())
      .then(({ matches }) => {
        const nextPerfectMatches = matches.filter((match) => match.type === "perfect");
        const nextCloseMatches = matches.filter((match) => match.type === "close");

        setMatches(matches);
        setActiveTab(nextPerfectMatches.length === 0 && nextCloseMatches.length > 0 ? "close" : "perfect");
      })
      .catch((err: Error) => setError(err.message || "Не удалось найти сочетания"))
      .finally(() => setMatchesLoading(false));
  }, [selectedTrack, debouncedQuery]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const perfectMatches = matches.filter((match) => match.type === "perfect");
  const closeMatches = matches.filter((match) => match.type === "close");
  const hasMatches = perfectMatches.length > 0 || closeMatches.length > 0;

  useEffect(() => {
    if (!selectedTrack || matchesLoading) return;
    if (perfectMatches.length === 0 && closeMatches.length > 0) {
      setActiveTab("close");
    } else {
      setActiveTab("perfect");
    }
  }, [selectedTrack, matchesLoading, perfectMatches.length, closeMatches.length]);

  function selectTrack(track: Track) {
    hapticTap();
    setSelectedTrack(track);
    setMatches([]);
    setMatchesLoading(true);
    setDropdownOpen(false);
  }

  function updateQuery(value: string) {
    setQuery(value);
    setSelectedTrack(null);
    setMatches([]);
    setMatchesLoading(false);
    setDropdownOpen(true);
    setError("");
  }

  return (
    <main className="noise-surface min-h-screen px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(24px+env(safe-area-inset-top))] text-foreground">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <header className="space-y-5">
          <div>
            <h1 className="font-display text-4xl font-bold leading-none tracking-normal text-foreground sm:text-5xl">
              DJ Tool
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Гармонический подбор мэшапов по колесу Camelot, тональности и темпу.
            </p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              onFocus={() => setDropdownOpen(true)}
              placeholder="Введите название трека или артиста..."
              className="h-12 pl-10"
            />

            {dropdownOpen && query.trim().length >= 2 && !selectedTrack && (
              <div className="scrollbar-thin absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-80 overflow-auto rounded-md border border-white/10 bg-card p-2 shadow-glow">
                {loading && (
                  <div className="flex h-24 items-center justify-center text-sm font-semibold text-muted-foreground">
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Поиск треков
                  </div>
                )}

                {!loading &&
                  tracks.map((track) => (
                    <TrackRow
                      key={track.id}
                      track={track}
                      selected={false}
                      onSelect={selectTrack}
                    />
                  ))}

                {!loading && tracks.length === 0 && (
                  <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-white/12 text-sm font-semibold text-muted-foreground">
                    Треки не найдены
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {error && (
          <div className="rounded-md border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-100">
            {error}
          </div>
        )}

        {selectedTrack && (
          <section className="grid gap-4">
            <div className="flex gap-3 rounded-md border border-primary/20 bg-primary/10 p-4">
              <CoverImage track={selectedTrack} />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-primary">Исходный трек</div>
                <div className="mt-2 truncate text-lg font-extrabold">{selectedTrack.title}</div>
                <div className="mt-1 truncate text-sm text-muted-foreground">{selectedTrack.artist}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="perfect">{formatKey(selectedTrack.key)}</Badge>
                  <Badge variant="default">{selectedTrack.bpm} BPM</Badge>
                </div>
              </div>
            </div>

            {matchesLoading && (
              <div className="flex h-40 items-center justify-center rounded-md border border-white/10 bg-card/80 text-sm font-semibold text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Поиск сочетаний
              </div>
            )}

            {!matchesLoading && !hasMatches && (
              <div className="rounded-md border border-white/10 bg-card/80 px-4 py-8 text-center text-sm font-semibold text-muted-foreground">
                Для этого трека не найдено сочетаний. Попробуйте изменить BPM исходного трека
              </div>
            )}

            {!matchesLoading && hasMatches && (
              <section className="rounded-md border border-white/10 bg-card/80 p-3 backdrop-blur">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TrackMatch["type"])}>
                  <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                      <Sparkles className="size-4 text-primary" />
                      Найдено сочетаний: {matches.length}
                    </div>
                    <TabsList>
                      <TabsTrigger value="perfect">Идеальные</TabsTrigger>
                      <TabsTrigger value="close">Другие</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="perfect" className="mt-0">
                    <MatchList
                      source={selectedTrack}
                      matches={perfectMatches}
                      onCopied={() => setToast("Скопировано!")}
                    />
                  </TabsContent>
                  <TabsContent value="close" className="mt-0">
                    <MatchList
                      source={selectedTrack}
                      matches={closeMatches}
                      onCopied={() => setToast("Скопировано!")}
                    />
                  </TabsContent>
                </Tabs>
              </section>
            )}
          </section>
        )}

        {selectedTrack && (
          <footer className="rounded-md border border-white/10 bg-white/[0.035] px-4 py-3 text-center text-sm font-semibold text-muted-foreground">
            База данных треков:{" "}
            <a
              href="https://getsongbpm.com"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-4 transition-colors hover:text-emerald-200"
            >
              GetSongBPM
            </a>
          </footer>
        )}
      </section>

      {toast && (
        <div className="fixed bottom-[calc(18px+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-md border border-primary/25 bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground shadow-glow">
          {toast}
        </div>
      )}
    </main>
  );
}

function MatchList({
  source,
  matches,
  onCopied,
}: {
  source: Track | null;
  matches: TrackMatch[];
  onCopied: () => void;
}) {
  if (!source || matches.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-white/12 text-sm font-semibold text-muted-foreground">
        Сочетаний не найдено
      </div>
    );
  }

  return (
    <div className="scrollbar-thin grid max-h-[33rem] gap-3 overflow-auto pr-1">
      {matches.map((match) => (
        <MatchRow key={match.track.id} source={source} match={match} onCopied={onCopied} />
      ))}
    </div>
  );
}
