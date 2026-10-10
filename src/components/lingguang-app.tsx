import { useEffect, useRef, useState } from "react";
import { Pin } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  KINDS,
  MOVES,
  STEMS,
  doneCount,
  formLabel,
  heatOf,
  HEAT_LABEL,
  HEAT_NOTE,
  invitation,
  kindLabel,
  moveOf,
  previewLine,
  sortSparks,
  sparkTitle,
  sparkToText,
  type Kind,
  type Spark,
  type View,
} from "@/lib/sparks";
import { useSparks } from "@/lib/store";
import { GatherView } from "@/components/gather-view";
import { SparkDetail } from "@/components/spark-detail";
import { Button, Time, copyText } from "@/components/ui";
import { useCarveSpark } from "@/components/use-carve";
import { useShapeSpark } from "@/components/use-shape";

const VIEWS: { id: View; label: string }[] = [
  { id: "capture", label: "捕捉" },
  { id: "archive", label: "灵笺" },
  { id: "gather", label: "汇总" },
];

type Filter = "all" | "pin" | Kind;

export function LingguangApp() {
  const view = useSparks((state) => state.view);
  const sparks = useSparks((state) => state.sparks);
  const openId = useSparks((state) => state.openId);
  const savedAt = useSparks((state) => state.savedAt);
  const clearExamples = useSparks((state) => state.clearExamples);
  const setView = useSparks((state) => state.setView);
  const lastId = useSparks((state) => state.lastId);
  const shape = useShapeSpark();
  const [notice, setNotice] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    const unsub = useSparks.persist.onFinishHydration(() => undefined);
    if (!useSparks.persist.hasHydrated()) void useSparks.persist.rehydrate();
    return unsub;
  }, []);

  useEffect(() => {
    if (!savedAt) return;
    setNotice(true);
    const timer = window.setTimeout(() => setNotice(false), 8000);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  const examples = sparks.filter((spark) => spark.example).length;
  const ordered = sortSparks(sparks);
  const filtered = ordered.filter((spark) => {
    if (filter === "pin" && !spark.pinned) return false;
    if (filter !== "all" && filter !== "pin" && spark.kind !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const blob = [
      spark.raw,
      spark.description?.title,
      spark.description?.body,
      spark.elevation?.title,
      spark.elevation?.stronger,
      spark.elevation?.angle,
      spark.work?.title,
      spark.work?.body,
      ...(spark.elevation?.next.map((step) => step.text) ?? []),
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();
    return blob.includes(q);
  });

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-bg">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl leading-none">灵光</h1>
              <p className="mt-1 text-sm text-muted">从一闪，到一件作品</p>
            </div>
            <p className="pb-1 text-sm text-muted tabular-nums">{sparks.length} 则</p>
          </div>
          <nav aria-label="页面" className="grid grid-cols-3 gap-1 rounded-xl bg-wash p-1">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => setView(item.id)}
                className={cn(
                  "h-11 rounded-lg text-sm",
                  view === item.id ? "bg-elevated text-ink" : "text-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className={cn("mx-auto w-full max-w-5xl px-4 py-6 sm:px-6", view === "capture" ? "pb-10" : "pb-32")}>
        {examples > 0 ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <p className="max-w-xl text-sm text-muted">
              {examples} 则示例还在纸上。有一则已经刻成作品，另外的还是闪。
            </p>
            <Button variant="ghost" onClick={clearExamples}>
              清掉示例
            </Button>
          </div>
        ) : null}

        {view === "capture" ? (
          <CaptureView sparks={ordered.slice(0, 6)} total={ordered.length} shape={shape} />
        ) : null}

        {view === "archive" ? (
          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl">灵笺</h2>
                <p className="mt-1 text-sm text-muted">按住过的每一则，都还在。</p>
              </div>
              <Button
                variant="quiet"
                onClick={async () => {
                  const ok = await copyText(ordered.map((spark) => sparkToText(spark)).join("\n\n---\n\n"));
                  setCopiedAll(ok);
                  window.setTimeout(() => setCopiedAll(false), 1400);
                }}
              >
                {copiedAll ? "已复制" : "复制全部"}
              </Button>
            </div>
            <label className="mt-5 flex h-11 items-center rounded-lg border border-line bg-elevated px-3">
              <span className="sr-only">搜索灵笺</span>
              <input
                value={query}
                placeholder="搜索原稿、描写或提升"
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 w-full bg-transparent text-sm placeholder:text-subtle focus:outline-none"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
                全部
              </FilterChip>
              <FilterChip active={filter === "pin"} onClick={() => setFilter("pin")}>
                置顶
              </FilterChip>
              {KINDS.map((kind) => (
                <FilterChip key={kind.id} active={filter === kind.id} onClick={() => setFilter(kind.id)}>
                  {kind.label}
                </FilterChip>
              ))}
            </div>
            <div className="mt-2">
              {filtered.length === 0 ? (
                <p className="py-10 text-sm text-muted">
                  {sparks.length === 0 ? "还没有灵笺。灵感来的时候，先把它按在纸上。" : "没有对上的灵笺。"}
                </p>
              ) : (
                filtered.map((spark) => <SparkRow key={spark.id} spark={spark} shape={shape} />)
              )}
            </div>
          </section>
        ) : null}

        {view === "gather" ? <GatherView /> : null}

        <p className="mt-10 max-w-xl text-xs leading-5 text-subtle">
          原稿只记在这台设备上。只有你按下整理、描写、提升、雕琢或汇总时，才会发给写作助手。选图片或风景时，会多生成一张画面。
        </p>
      </main>

      {view !== "capture" && !openId ? <QuickDock /> : null}
      {notice && view !== "capture" && lastId ? (
        <div
          role="status"
          className="rise fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-fg"
        >
          <span className="px-1">已记下</span>
          <button
            type="button"
            className="h-11 rounded-lg bg-elevated px-3 text-ink"
            disabled={shape.pending}
            onClick={() => {
              const spark = useSparks.getState().sparks.find((item) => item.id === lastId);
              if (spark) void shape.run(spark);
              setNotice(false);
            }}
          >
            {shape.pending ? "正在整理…" : "让灵光整理"}
          </button>
        </div>
      ) : null}
      {openId ? <SparkDetail id={openId} /> : null}
    </div>
  );
}

function CaptureView({
  sparks,
  total,
  shape,
}: {
  sparks: Spark[];
  total: number;
  shape: ReturnType<typeof useShapeSpark>;
}) {
  const setView = useSparks((state) => state.setView);
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div>
        <Composer shape={shape} />
        <JustSaved shape={shape} />
        <ReturnLine />
      </div>
      <aside>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl">刚落下的</h2>
          {total > sparks.length ? (
            <button type="button" onClick={() => setView("archive")} className="h-11 text-sm text-muted">
              全部灵笺
            </button>
          ) : null}
        </div>
        {sparks.length === 0 ? (
          <p className="mt-4 text-sm text-muted">纸还是空白的。先写下那一句。</p>
        ) : (
          <div className="mt-2">
            {sparks.map((spark) => (
              <SparkRow key={spark.id} spark={spark} shape={shape} />
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function Composer({ shape }: { shape: ReturnType<typeof useShapeSpark> }) {
  const draft = useSparks((state) => state.draft);
  const draftKind = useSparks((state) => state.draftKind);
  const draftIntent = useSparks((state) => state.draftIntent);
  const setDraft = useSparks((state) => state.setDraft);
  const setDraftKind = useSparks((state) => state.setDraftKind);
  const setDraftIntent = useSparks((state) => state.setDraftIntent);
  const capture = useSparks((state) => state.capture);
  const openId = useSparks((state) => state.openId);
  const view = useSparks((state) => state.view);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (view === "capture" && !openId) ref.current?.focus();
  }, [view, openId]);

  function submit() {
    const id = capture(draft, draftKind, draftIntent);
    if (!id) {
      setHint("先写几个字");
      ref.current?.focus();
      return;
    }
    setHint("");
  }

  async function saveAndShape() {
    const id = capture(draft, draftKind, draftIntent);
    if (!id) {
      setHint("先写几个字");
      ref.current?.focus();
      return;
    }
    setHint("");
    const spark = useSparks.getState().sparks.find((item) => item.id === id);
    if (spark) await shape.run(spark);
  }

  return (
    <form
      className="rounded-3xl border border-line bg-elevated p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor="capture" className="text-xs text-subtle">
        此刻 · {draft.trim() ? "闪" : "虚无"}
      </label>
      <textarea
        id="capture"
        ref={ref}
        value={draft}
        placeholder={moveOf(draftIntent ?? "")?.place ?? "先写下那一句。不完整也没关系。"}
        onChange={(event) => {
          setDraft(event.target.value);
          if (hint) setHint("");
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        className="mt-2 min-h-32 w-full resize-y bg-transparent font-display text-xl leading-snug text-ink placeholder:text-subtle focus:outline-none"
      />
      {draft.trim().length < 8 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {STEMS.map((stem) => (
            <button
              key={stem}
              type="button"
              onClick={() => {
                const next = draft.trim() ? `${draft.trim()} ${stem}` : stem;
                setDraft(next);
                ref.current?.focus();
              }}
              className="h-11 rounded-lg px-3 text-sm text-muted"
            >
              {stem}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-3" role="group" aria-label="要落到">
        <p className="text-xs text-subtle">要落到</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MOVES.map((move) => (
            <button
              key={move.id}
              type="button"
              aria-pressed={draftIntent === move.id}
              onClick={() => setDraftIntent(draftIntent === move.id ? null : move.id)}
              className={cn(
                "h-11 rounded-lg px-3 text-sm",
                draftIntent === move.id ? "bg-accent text-accent-fg" : "border border-line text-muted",
              )}
            >
              {move.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="类型">
        {KINDS.map((kind) => (
          <button
            key={kind.id}
            type="button"
            aria-pressed={draftKind === kind.id}
            onClick={() => setDraftKind(kind.id)}
            className={cn(
              "h-11 rounded-lg px-3 text-sm",
              draftKind === kind.id ? "bg-accent text-accent-fg" : "border border-line text-muted",
            )}
          >
            {kind.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-subtle">
          <span className="tabular-nums">{draft.trim().length} 字</span>
          <span className="hidden sm:inline"> · Ctrl / ⌘ + Enter 记下</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="ghost">
            记下
          </Button>
          <Button type="button" disabled={shape.pending} onClick={() => void saveAndShape()}>
            {shape.pending ? "正在整理…" : "记下并整理"}
          </Button>
        </div>
      </div>
      {hint ? (
        <p role="status" className="mt-2 text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </form>
  );
}

function JustSaved({ shape }: { shape: ReturnType<typeof useShapeSpark> }) {
  const lastId = useSparks((state) => state.lastId);
  const spark = useSparks((state) => state.sparks.find((item) => item.id === lastId));
  const clearLast = useSparks((state) => state.clearLast);
  const setOpenId = useSparks((state) => state.setOpenId);
  const carve = useCarveSpark();
  const [job, setJob] = useState<"shape" | "carve" | null>(null);
  useEffect(() => {
    if (!shape.pending && !carve.pending) setJob(null);
  }, [shape.pending, carve.pending]);
  if (!spark) return null;
  const shaped = Boolean(spark.description && spark.elevation);
  const working = shape.pending && shape.busyId === spark.id;
  const move = moveOf(spark.intent ?? "");
  const carving = carve.pending && carve.busyId === spark.id;

  return (
    <section className="rise mt-4 rounded-3xl border border-line bg-elevated p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-subtle">
          刚记下 · {kindLabel(spark.kind)}
          {move ? ` · ${move.label}` : ""}
        </p>
        <button type="button" onClick={clearLast} className="h-11 px-2 text-sm text-muted">
          收起
        </button>
      </div>
      <p className="mt-2 font-display text-lg leading-snug text-balance">{spark.raw}</p>
      {spark.work?.body ? (
        <div className="mt-3">
          <p className="text-xs text-subtle">{formLabel(spark.work.form ?? move?.id ?? "passage")}</p>
          {spark.work.title ? <p className="mt-1 font-display text-xl">{spark.work.title}</p> : null}
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-pretty">{spark.work.body}</p>
        </div>
      ) : null}
      {spark.description && !spark.work ? (
        <p className="mt-3 text-sm leading-relaxed text-pretty text-muted">{spark.description.body}</p>
      ) : null}
      {spark.elevation && !spark.work ? (
        <div className="mt-3">
          <p className="font-display text-base">{spark.elevation.stronger}</p>
          {spark.elevation.angle ? (
            <p className="mt-2 border-l border-line-strong pl-3 text-sm text-muted">{spark.elevation.angle}</p>
          ) : null}
          <p className="mt-3 text-xs text-subtle">接着做 · {doneCount(spark.elevation.next)}</p>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {move ? (
          <Button
            disabled={shape.pending || carve.pending}
            onClick={() => {
              setJob("carve");
              void carve.run({
                id: spark.id,
                raw: spark.raw,
                kind: spark.kind,
                form: move.id,
                description: spark.description?.body,
                stronger: spark.elevation?.stronger,
                angle: spark.elevation?.angle,
              });
            }}
          >
            {carving && job === "carve" ? "正在写结果…" : spark.work ? "再写一次" : move.act}
          </Button>
        ) : null}
        <Button
          variant={move ? "ghost" : "primary"}
          disabled={shape.pending || carve.pending}
          onClick={() => {
            setJob("shape");
            void shape.run(spark);
          }}
        >
          {working && job === "shape" ? "正在整理…" : shaped ? "重新整理" : "让灵光整理"}
        </Button>
        <Button variant="ghost" onClick={() => setOpenId(spark.id)}>
          打开
        </Button>
      </div>
      {shape.error && shape.errorId === spark.id ? (
        <p role="status" className="mt-2 text-sm text-muted">
          {shape.error}
        </p>
      ) : null}
      {carve.error && carve.errorId === spark.id ? (
        <p role="status" className="mt-2 text-sm text-muted">
          {carve.error}
        </p>
      ) : null}
    </section>
  );
}

function ReturnLine() {
  const sparks = useSparks((state) => state.sparks);
  const lastId = useSparks((state) => state.lastId);
  const toggleStep = useSparks((state) => state.toggleStep);
  const setOpenId = useSparks((state) => state.setOpenId);
  const invite = invitation(sparks, lastId);
  if (!invite) return null;

  return (
    <section className="mt-8 border-t border-line pt-5">
      <p className="text-xs text-subtle">
        {invite.kind === "step" ? "今日一步" : "还停在纸上"}
        {invite.example ? " · 示例" : ""}
      </p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <button type="button" onClick={() => setOpenId(invite.sparkId)} className="min-w-0 text-left">
          <span className="text-xs text-muted">{invite.title}</span>
          <span className="mt-1 block font-display text-lg leading-snug text-balance">
            {invite.kind === "step" ? invite.text : previewLine(invite.raw, 42)}
          </span>
        </button>
        {invite.kind === "step" ? (
          <Button variant="ghost" onClick={() => toggleStep(invite.sparkId, invite.index)}>
            做好了
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setOpenId(invite.sparkId)}>
            打开
          </Button>
        )}
      </div>
    </section>
  );
}

function QuickDock() {
  const draft = useSparks((state) => state.draft);
  const draftKind = useSparks((state) => state.draftKind);
  const draftIntent = useSparks((state) => state.draftIntent);
  const setDraft = useSparks((state) => state.setDraft);
  const setDraftKind = useSparks((state) => state.setDraftKind);
  const capture = useSparks((state) => state.capture);
  const ref = useRef<HTMLTextAreaElement>(null);

  function cycle() {
    const index = KINDS.findIndex((kind) => kind.id === draftKind);
    const next = KINDS[(index + 1) % KINDS.length];
    if (next) setDraftKind(next.id);
  }

  function submit() {
    const id = capture(draft, draftKind, draftIntent);
    if (!id) ref.current?.focus();
  }

  return (
    <form
      className="dock-pad fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg px-4 pt-3 sm:px-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="mx-auto flex w-full max-w-5xl items-end gap-2">
        <button type="button" onClick={cycle} className="h-11 shrink-0 rounded-lg px-3 text-sm text-muted" aria-label="切换类型">
          {kindLabel(draftKind)}
        </button>
        <label className="min-w-0 flex-1">
          <span className="sr-only">快速记下</span>
          <textarea
            ref={ref}
            rows={2}
            value={draft}
            placeholder="灵感来了，先写在这里"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            className="max-h-28 w-full resize-none bg-transparent py-2 font-display text-base leading-snug text-ink placeholder:text-subtle focus:outline-none"
          />
        </label>
        <Button type="submit">记下</Button>
      </div>
    </form>
  );
}

function SparkRow({ spark, shape }: { spark: Spark; shape: ReturnType<typeof useShapeSpark> }) {
  const setOpenId = useSparks((state) => state.setOpenId);
  const togglePin = useSparks((state) => state.togglePin);
  const worked = spark.work?.title.trim() || spark.elevation?.title.trim() || spark.description?.title.trim() || "";
  const heat = heatOf(spark);
  const marks = [
    spark.example ? "示例" : "",
    (heat === "sharp" || heat === "piece") && spark.elevation && spark.elevation.next.length > 0
      ? doneCount(spark.elevation.next)
      : "",
  ].filter(Boolean);
  const shaped = Boolean(spark.description && spark.elevation);
  const working = shape.pending && shape.busyId === spark.id;

  return (
    <article className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-line py-4">
      <div className="relative min-w-0">
        <p className="flex flex-wrap gap-x-3 text-xs text-subtle">
          <span>{kindLabel(spark.kind)}</span>
          <Time ts={spark.createdAt} />
          <span title={HEAT_NOTE[heat]}>{HEAT_LABEL[heat]}</span>
          {spark.pinned ? <span>置顶</span> : null}
        </p>
        {worked ? <h3 className="mt-1 font-display text-lg text-balance">{worked}</h3> : null}
        {spark.work?.image ? (
          <img
            src={spark.work.image}
            alt={spark.work.title || "这一则的画面"}
            className="mt-2 max-h-40 w-full rounded-2xl border border-line object-cover"
          />
        ) : null}
        {spark.work?.body.trim() ? (
          <p className="mt-1 line-clamp-3 font-display text-lg leading-snug text-pretty whitespace-pre-wrap text-ink">
            {spark.work.body}
          </p>
        ) : null}
        <p
          className={cn(
            "text-pretty whitespace-pre-wrap",
            worked ? "mt-1 line-clamp-2 text-sm text-muted" : "mt-1 line-clamp-3 font-display text-lg text-ink",
          )}
        >
          {spark.raw}
        </p>
        {marks.length > 0 ? <p className="mt-2 text-xs text-subtle">{marks.join(" · ")}</p> : null}
        {shape.error && shape.errorId === spark.id ? (
          <p className="mt-2 text-sm text-muted">{shape.error}</p>
        ) : null}
        <button
          type="button"
          onClick={() => setOpenId(spark.id)}
          aria-label={`打开 ${worked || sparkTitle(spark)}`}
          className="absolute inset-0 rounded-lg"
        />
      </div>
      <div className="flex flex-col items-end">
        <button
          type="button"
          aria-pressed={spark.pinned}
          aria-label={spark.pinned ? "取消置顶" : "置顶"}
          onClick={() => togglePin(spark.id)}
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-lg",
            spark.pinned ? "text-ink" : "text-subtle",
          )}
        >
          <Pin className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          disabled={shape.pending}
          onClick={() => void shape.run(spark)}
          className="h-11 px-2 text-sm text-ink"
        >
          {working ? "整理中" : shaped ? "再整理" : "整理"}
        </button>
      </div>
    </article>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-11 rounded-lg px-3 text-sm",
        active ? "bg-accent text-accent-fg" : "border border-line bg-elevated text-muted",
      )}
    >
      {children}
    </button>
  );
}
