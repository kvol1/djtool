import { Copy, Disc3, Gauge, KeyRound, Loader2, Search, Sparkles, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getMatches, getTracks, verifyTelegramSession } from "./lib/api";
import type { Track, TrackMatch } from "./lib/types";
import { getInitData, hapticSuccess, hapticTap, initTelegramShell } from "./lib/telegram";
import { cn } from "./lib/utils";
import { useDebouncedValue } from "./hooks";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";

const matchLabels = {
  perfect: "Идеальное сочетание",
  close: "Другие сочетания",
} satisfies Record<TrackMatch["type"], string>;

function formatDelta(delta: number, suffix = "") {
  if (delta === 0) return `0${suffix}`;
  return `${delta > 0 ? "+" : ""}${delta}${suffix}`;
}

function trackCopyText(source: Track, match: TrackMatch) {
  return `${source.artist} - ${source.title} (${source.key}, ${source.bpm} BPM) → ${match.track.artist} - ${match.track.title} (${match.track.key}, ${match.track.bpm} BPM)`;
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
        "group grid w-full grid-cols-[1fr_auto] gap-3 rounded-md border p-3 text-left transition-[background,border-color,transform] duration-150 ease-out active:scale-[0.995]",
        selected
          ? "border-primary/60 bg-primary/12"
          : "border-white/8 bg-white/[0.035] hover:border-white/18 hover:bg-white/[0.06]",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-foreground">{track.title}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{track.artist}</span>
        <span className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
          <span>{track.genre}</span>
          <EnergyMeter value={track.energy} />
        </span>
      </span>
      <span className="flex flex-col items-end gap-2">
        <Badge variant={selected ? "perfect" : "default"}>{track.key}</Badge>
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
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={match.type === "perfect" ? "perfect" : "close"}>{matchLabels[match.type]}</Badge>
            <Badge variant="default">{match.track.genre}</Badge>
          </div>
          <h3 className="mt-3 truncate text-base font-extrabold text-foreground">{match.track.title}</h3>
          <p className="mt-1 truncate text-sm text-muted-foreground">{match.track.artist}</p>
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
          <div className="mt-2 font-mono text-lg font-bold text-foreground">{match.track.key}</div>
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
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [sessionState, setSessionState] = useState("Гостевой режим");
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    initTelegramShell();

    const initData = getInitData();
    if (initData) {
      verifyTelegramSession(initData)
        .then(() => setSessionState("Telegram проверен"))
        .catch(() => setSessionState("Проверка Telegram не прошла"));
    }

    getTracks()
      .then(({ tracks: loadedTracks }) => {
        setTracks(loadedTracks);
        setSelectedTrack(loadedTracks[0] ?? null);
      })
      .catch((err: Error) => setError(err.message || "Не удалось загрузить треки"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTrack) return;

    setMatchesLoading(true);
    getMatches(selectedTrack.id)
      .then(({ matches }) => setMatches(matches))
      .catch((err: Error) => setError(err.message || "Не удалось найти сочетания"))
      .finally(() => setMatchesLoading(false));
  }, [selectedTrack]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredTracks = useMemo(() => {
    const normalizedQuery = debouncedQuery.trim().toLowerCase();
    if (!normalizedQuery) return tracks;

    return tracks.filter((track) =>
      [track.title, track.artist, track.genre, track.key, String(track.bpm)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [tracks, debouncedQuery]);

  const perfectMatches = matches.filter((match) => match.type === "perfect");
  const closeMatches = matches.filter((match) => match.type === "close");

  function selectTrack(track: Track) {
    hapticTap();
    setSelectedTrack(track);
  }

  return (
    <main className="noise-surface min-h-screen px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(18px+env(safe-area-inset-top))] text-foreground">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <Disc3 className="size-3.5 text-primary" />
              {sessionState}
            </div>
            <h1 className="mt-4 font-display text-4xl font-bold leading-none tracking-normal text-foreground sm:text-5xl">
              DJ Tool
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Гармонический подбор мэшапов по колесу Camelot, тональности и темпу.
            </p>
          </div>

          {selectedTrack && (
            <div className="rounded-md border border-primary/20 bg-primary/10 p-4">
              <div className="text-xs font-semibold text-primary">Исходный трек</div>
              <div className="mt-2 max-w-[22rem] truncate text-lg font-extrabold">{selectedTrack.title}</div>
              <div className="mt-1 truncate text-sm text-muted-foreground">{selectedTrack.artist}</div>
              <div className="mt-3 flex gap-2">
                <Badge variant="perfect">{selectedTrack.key}</Badge>
                <Badge variant="default">{selectedTrack.bpm} BPM</Badge>
              </div>
            </div>
          )}
        </header>

        {error && (
          <div className="rounded-md border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-100">
            {error}
          </div>
        )}

        <div className="grid min-h-[34rem] gap-4 lg:grid-cols-[24rem_1fr]">
          <aside className="rounded-md border border-white/10 bg-card/80 p-3 backdrop-blur">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Введите название трека..."
                className="pl-10"
              />
            </div>

            <div className="scrollbar-thin mt-3 flex max-h-[32rem] flex-col gap-2 overflow-auto pr-1">
              {loading && (
                <div className="flex h-40 items-center justify-center text-sm font-semibold text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Загрузка треков
                </div>
              )}

              {!loading &&
                filteredTracks.map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    selected={selectedTrack?.id === track.id}
                    onSelect={selectTrack}
                  />
                ))}

              {!loading && filteredTracks.length === 0 && (
                <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-white/12 text-sm font-semibold text-muted-foreground">
                  Треки не найдены
                </div>
              )}
            </div>
          </aside>

          <section className="rounded-md border border-white/10 bg-card/80 p-3 backdrop-blur">
            <Tabs defaultValue="perfect" className="h-full">
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
                  loading={matchesLoading}
                  onCopied={() => setToast("Скопировано!")}
                />
              </TabsContent>
              <TabsContent value="close" className="mt-0">
                <MatchList
                  source={selectedTrack}
                  matches={closeMatches}
                  loading={matchesLoading}
                  onCopied={() => setToast("Скопировано!")}
                />
              </TabsContent>
            </Tabs>
          </section>
        </div>
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
  loading,
  onCopied,
}: {
  source: Track | null;
  matches: TrackMatch[];
  loading: boolean;
  onCopied: () => void;
}) {
  if (loading) {
    return (
      <div className="flex h-[28rem] items-center justify-center text-sm font-semibold text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Поиск сочетаний
      </div>
    );
  }

  if (!source || matches.length === 0) {
    return (
      <div className="flex h-[28rem] items-center justify-center rounded-md border border-dashed border-white/12 text-sm font-semibold text-muted-foreground">
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
