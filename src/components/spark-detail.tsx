import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Pin, Trash2 } from "lucide-react";
import { describeSpark, elevateSpark } from "@/lib/inspire.functions";
import {
  KINDS,
  MOVES,
  WRITTEN,
  HEAT_NOTE,
  STAGES,
  beside,
  defaultForm,
  doneCount,
  formLabel,
  formTakesImage,
  heatOf,
  isForm,
  kindLabel,
  previewLine,
  slipText,
  sparkToText,
  type FormId,
  type Heat,
  type Kind,
  type Spark,
} from "@/lib/sparks";
import { useSparks } from "@/lib/store";
import { Button, StepList, Time, copyText } from "@/components/ui";
import { useCarveSpark } from "@/components/use-carve";
import { useShapeSpark } from "@/components/use-shape";
import { cn } from "@/lib/cn";

export function SparkDetail({ id }: { id: string }) {
  const spark = useSparks((state) => state.sparks.find((item) => item.id === id));
  const clusters = useSparks((state) => state.clusters);
  const pending = useSparks((state) => state.pending);
  const setOpenId = useSparks((state) => state.setOpenId);
  const setPending = useSparks((state) => state.setPending);
  const updateRaw = useSparks((state) => state.updateRaw);
  const togglePin = useSparks((state) => state.togglePin);
  const removeSpark = useSparks((state) => state.removeSpark);
  const setDescription = useSparks((state) => state.setDescription);
  const setElevation = useSparks((state) => state.setElevation);
  const setWork = useSparks((state) => state.setWork);
  const toggleStep = useSparks((state) => state.toggleStep);
  const setStepText = useSparks((state) => state.setStepText);
  const addStep = useSparks((state) => state.addStep);
  const addToCluster = useSparks((state) => state.addToCluster);
  const removeFromCluster = useSparks((state) => state.removeFromCluster);
  const describe = useServerFn(describeSpark);
  const elevate = useServerFn(elevateSpark);
  const shape = useShapeSpark();
  const carve = useCarveSpark();

  const closeRef = useRef<HTMLButtonElement>(null);
  const describeRef = useRef<HTMLDivElement>(null);
  const elevateRef = useRef<HTMLDivElement>(null);
  const [raw, setRaw] = useState(spark?.raw ?? "");
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [slip, setSlip] = useState(false);
  const [picked, setPicked] = useState<FormId>("passage");
  const [clusterId, setClusterId] = useState(clusters[0]?.id ?? "");

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    if (spark) setRaw(spark.raw);
  }, [spark]);

  useEffect(() => {
    if (!spark) return;
    const current = spark.work?.form;
    const intent = spark.intent;
    setPicked(
      current && isForm(current) ? current : intent && isForm(intent) ? intent : defaultForm(spark.kind),
    );
  }, [spark?.id, spark?.kind, spark?.work?.form, spark?.intent]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [setOpenId]);

  if (!spark) return null;

  const membership = clusters.filter((cluster) => cluster.sparkIds.includes(spark.id));

  async function runDescribe() {
    if (!spark || useSparks.getState().pending) return;
    setError("");
    setPending(true);
    try {
      const result = await describe({ data: { raw: spark.raw, kind: spark.kind } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDescription(spark.id, result.description);
      scrollTo(describeRef.current);
    } catch {
      setError("没能连上写作助手。原稿还在，请再试一次。");
    } finally {
      setPending(false);
    }
  }

  async function runElevate() {
    if (!spark || useSparks.getState().pending) return;
    setError("");
    setPending(true);
    try {
      const result = await elevate({
        data: { raw: spark.raw, kind: spark.kind, description: spark.description?.body ?? "" },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setElevation(spark.id, {
        ...result.elevation,
        next: result.elevation.next.map((text) => ({ text, done: false })),
      });
      scrollTo(elevateRef.current);
    } catch {
      setError("没能连上写作助手。原稿还在，请再试一次。");
    } finally {
      setPending(false);
    }
  }

  function saveRaw() {
    const next = raw.trim();
    if (!spark) return;
    if (!next) {
      setRaw(spark.raw);
      setEditing(false);
      return;
    }
    if (next !== spark.raw) updateRaw(spark.id, next);
    setEditing(false);
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" className="absolute inset-0 bg-ink/30" aria-label="关闭" onClick={() => setOpenId(null)} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="spark-title"
        className="panel-in relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-bg"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-bg px-4 py-3 sm:px-6">
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpenId(null)}
            className="inline-flex h-11 items-center gap-1 rounded-lg px-2 text-sm text-ink"
          >
            <ChevronLeft className="size-4" aria-hidden />
            返回
          </button>
          <div className="flex items-center gap-1">
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
              aria-label="删除"
              onClick={() => setConfirming(true)}
              className="inline-flex size-11 items-center justify-center rounded-lg text-subtle"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-8 px-4 py-6 sm:px-6">
          <header>
            <p className="text-sm text-muted">
              {kindLabel(spark.kind)}
              <span className="px-2 text-subtle">·</span>
              <Time ts={spark.createdAt} />
              {spark.example ? <span className="px-2 text-subtle">示例</span> : null}
            </p>
            <StageRail heat={heatOf(spark)} />
            {slip ? (
              <h2 id="spark-title" className="sr-only">
                {spark.raw}
              </h2>
            ) : editing ? (
              <textarea
                value={raw}
                aria-label="原稿"
                onChange={(event) => setRaw(event.target.value.slice(0, 4000))}
                onBlur={saveRaw}
                className="mt-3 min-h-32 w-full resize-y bg-transparent font-display text-2xl leading-snug text-ink focus:outline-none"
              />
            ) : (
              <h2 id="spark-title" className="mt-3 font-display text-2xl leading-snug text-balance whitespace-pre-wrap">
                「{spark.raw}」
              </h2>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setSlip(false);
                  setEditing((value) => !value);
                }}
              >
                {editing ? "完成编辑" : "改原稿"}
              </Button>
              <label className="sr-only" htmlFor="spark-kind">
                类型
              </label>
              <KindSelect id={spark.id} kind={spark.kind} />
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setSlip((value) => !value);
                }}
              >
                {slip ? "回到修改" : "看成笺"}
              </Button>
              <Button
                variant="quiet"
                onClick={async () => {
                  const ok = await copyText(slip ? slipText(spark) : sparkToText(spark));
                  setCopied(ok);
                  window.setTimeout(() => setCopied(false), 1400);
                }}
              >
                {copied ? "已复制" : slip ? "复制成笺" : "复制"}
              </Button>
            </div>
            {confirming ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <p className="text-sm text-muted">删掉这一则？</p>
                <Button
                  variant="primary"
                  onClick={() => {
                    removeSpark(spark.id);
                  }}
                >
                  确认删除
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  取消
                </Button>
              </div>
            ) : null}
          </header>

          {slip ? (
            <Slip
              spark={spark}
              pending={pending || shape.pending}
              onShape={() => void shape.run(spark)}
              onCarve={() => void carve.run(carvePayload(spark, picked))}
              painting={formTakesImage(picked)}
            />
          ) : (
            <>
          {error || (shape.errorId === spark.id ? shape.error : "") || (carve.errorId === spark.id ? carve.error : "") ? (
            <p role="status" className="text-sm text-muted">
              {error || shape.error || carve.error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={pending || shape.pending} onClick={() => void shape.run(spark)}>
              {shape.pending && shape.busyId === spark.id
                ? "正在整理…"
                : spark.description && spark.elevation
                  ? "重新整理"
                  : "让灵光整理"}
            </Button>
            <p className="text-sm text-muted">一次写成描写，并推进到能做的几步。原稿不动。</p>
          </div>

          <section ref={describeRef} aria-labelledby="describe-heading">
            <SectionLabel id="describe-heading" title="描写" note="把这一闪写成一段。不改原稿。" />
            {spark.description ? (
              <div className="mt-4">
                <input
                  aria-label="描写标题"
                  value={spark.description.title}
                  onChange={(event) =>
                    setDescription(spark.id, {
                      title: event.target.value.slice(0, 18),
                      body: spark.description?.body ?? "",
                    })
                  }
                  className="w-full bg-transparent font-display text-xl text-ink focus:outline-none"
                />
                <textarea
                  aria-label="描写正文"
                  value={spark.description.body}
                  onChange={(event) =>
                    setDescription(spark.id, {
                      title: spark.description?.title ?? "",
                      body: event.target.value.slice(0, 800),
                    })
                  }
                  className="mt-3 min-h-36 w-full resize-y bg-transparent text-base leading-relaxed text-pretty text-ink focus:outline-none"
                />
                <Button className="mt-3" variant="ghost" disabled={pending} onClick={() => void runDescribe()}>
                  {pending ? "正在写…" : "重新描写"}
                </Button>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button disabled={pending} onClick={() => void runDescribe()}>
                  {pending ? "正在写…" : "写成一段"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setDescription(spark.id, {
                      title: previewLine(spark.raw, 14),
                      body: spark.raw,
                    })
                  }
                >
                  自己铺开
                </Button>
              </div>
            )}
          </section>

          <section ref={elevateRef} aria-labelledby="elevate-heading">
            <SectionLabel
              id="elevate-heading"
              title="提升"
              note={
                spark.elevation
                  ? `接着做 · ${doneCount(spark.elevation.next)}`
                  : "收成更锋利的一版，并给出今天能做的几步。"
              }
            />
            {spark.elevation ? (
              <div className="mt-4 flex flex-col gap-4">
                <input
                  aria-label="提升后的题目"
                  value={spark.elevation.title}
                  onChange={(event) =>
                    setElevation(spark.id, { ...spark.elevation!, title: event.target.value.slice(0, 18) })
                  }
                  className="w-full bg-transparent font-display text-xl text-ink focus:outline-none"
                />
                <textarea
                  aria-label="更锋利的一版"
                  value={spark.elevation.stronger}
                  onChange={(event) =>
                    setElevation(spark.id, { ...spark.elevation!, stronger: event.target.value.slice(0, 600) })
                  }
                  className="min-h-28 w-full resize-y bg-transparent font-display text-lg leading-relaxed text-ink focus:outline-none"
                />
                <label className="block">
                  <span className="text-xs text-subtle">这一则真正咬住的</span>
                  <input
                    aria-label="角度"
                    value={spark.elevation.angle}
                    onChange={(event) =>
                      setElevation(spark.id, { ...spark.elevation!, angle: event.target.value.slice(0, 80) })
                    }
                    className="mt-2 w-full border-l border-line-strong bg-transparent py-1 pl-4 text-sm text-muted focus:outline-none"
                  />
                </label>
                <div>
                  <p className="text-xs text-subtle">接着做</p>
                  <StepList
                    steps={spark.elevation.next}
                    onToggle={(index) => toggleStep(spark.id, index)}
                    onText={(index, text) => setStepText(spark.id, index, text)}
                  />
                  {spark.elevation.next.length < 5 ? (
                    <Button variant="quiet" className="mt-1 px-0" onClick={() => addStep(spark.id)}>
                      加一步
                    </Button>
                  ) : null}
                </div>
                <Button variant="ghost" disabled={pending} onClick={() => void runElevate()}>
                  {pending ? "正在写…" : "重新提升"}
                </Button>
                <p className="text-xs text-subtle">重新生成会换掉这一版，原稿不动。</p>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button disabled={pending} onClick={() => void runElevate()}>
                  {pending ? "正在写…" : "再推进一步"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setElevation(spark.id, {
                      title: previewLine(spark.raw, 14),
                      stronger: "",
                      angle: "",
                      next: [{ text: "今天就能做的最小一步", done: false }],
                    })
                  }
                >
                  自己推进
                </Button>
              </div>
            )}
          </section>

          <section aria-labelledby="work-heading">
            <SectionLabel
              id="work-heading"
              title="作品"
              note={
                spark.work
                  ? "这是刻成的那一件。换一种样子，可以再雕琢。原稿不动。"
                  : "选一种样子，再刻。诗、一段话、图片、风景、创意、灵感，或一个能做的应用。"
              }
            />
            <FormPick value={picked} onChange={setPicked} />
            {spark.work?.image ? (
              <img
                src={spark.work.image}
                alt={spark.work.title || "这一则的画面"}
                className="mt-4 max-h-80 w-full rounded-2xl border border-line object-cover"
              />
            ) : null}
            {spark.work ? (
              <div className="mt-4 flex flex-col gap-4">
                <p className="text-xs text-subtle">{formLabel(spark.work.form ?? "passage")}</p>
                <input
                  aria-label="作品标题"
                  value={spark.work.title}
                  onChange={(event) =>
                    setWork(spark.id, {
                      title: event.target.value.slice(0, 16),
                      body: spark.work?.body ?? "",
                      form: spark.work?.form,
                      image: spark.work?.image,
                    })
                  }
                  className="w-full bg-transparent font-display text-2xl text-ink focus:outline-none"
                />
                <textarea
                  aria-label="作品正文"
                  value={spark.work.body}
                  onChange={(event) =>
                    setWork(spark.id, {
                      title: spark.work?.title ?? "",
                      body: event.target.value.slice(0, 700),
                      form: spark.work?.form,
                      image: spark.work?.image,
                    })
                  }
                  className="min-h-40 w-full resize-y bg-transparent font-display text-lg leading-relaxed whitespace-pre-wrap text-pretty text-ink focus:outline-none"
                />
                <Button variant="ghost" disabled={pending || carve.pending} onClick={() => void carve.run(carvePayload(spark, picked))}>
                  {carve.pending && carve.busyId === spark.id
                    ? formTakesImage(picked)
                      ? "正在画…"
                      : "正在雕琢…"
                    : "重新雕琢"}
                </Button>
                <p className="text-xs text-subtle">重新雕琢会换掉这一件，原稿不动。</p>
              </div>
            ) : (
              <div className="mt-4">
                <Button disabled={pending || carve.pending} onClick={() => void carve.run(carvePayload(spark, picked))}>
                  {carve.pending && carve.busyId === spark.id
                    ? formTakesImage(picked)
                      ? "正在画…"
                      : "正在雕琢…"
                    : "雕琢成作"}
                </Button>
              </div>
            )}
          </section>

          <section aria-labelledby="cluster-heading">
            <SectionLabel id="cluster-heading" title="放进汇总" note="和相近的几则放在一起，回头看它们的线。" />
            {membership.length > 0 ? (
              <ul className="mt-3 flex flex-col">
                {membership.map((cluster) => (
                  <li key={cluster.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-line">
                    <span className="text-sm">{cluster.name}</span>
                    <Button variant="quiet" onClick={() => removeFromCluster(cluster.id, spark.id)}>
                      移出
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">还没有放进任何一组。</p>
            )}
            {clusters.length > 0 ? (
              <form
                className="mt-3 flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!clusterId) return;
                  addToCluster(clusterId, [spark.id]);
                }}
              >
                <label className="sr-only" htmlFor="cluster-pick">
                  选择一组
                </label>
                <select
                  id="cluster-pick"
                  value={clusterId}
                  onChange={(event) => setClusterId(event.target.value)}
                  className="h-11 rounded-lg border border-line bg-elevated px-3 text-sm text-ink"
                >
                  {clusters.map((cluster) => (
                    <option key={cluster.id} value={cluster.id}>
                      {cluster.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="ghost">
                  加入
                </Button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-muted">先到汇总里建一组。</p>
            )}
          </section>

          <Beside id={spark.id} />
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Slip({
  spark,
  onShape,
  onCarve,
  pending,
  painting,
}: {
  spark: Spark;
  onShape: () => void;
  onCarve: () => void;
  pending: boolean;
  painting: boolean;
}) {
  const heat = heatOf(spark);
  const title = spark.work?.title.trim() || spark.elevation?.title.trim() || spark.description?.title.trim() || "";
  const body = spark.work?.body.trim() || spark.elevation?.stronger.trim() || spark.description?.body.trim() || spark.raw;
  const angle = heat === "piece" ? "" : (spark.elevation?.angle.trim() ?? "");

  return (
    <article className="rounded-3xl border border-line bg-elevated px-5 py-6">
      <StageRail heat={heat} />
      <p className="mt-2 text-xs text-subtle">
        {HEAT_NOTE[heat]}
        {spark.work ? ` · ${formLabel(spark.work.form ?? "passage")}` : ""}
      </p>
      {spark.work?.image ? (
        <img
          src={spark.work.image}
          alt={title || "这一则的画面"}
          className="mt-4 max-h-80 w-full rounded-2xl border border-line object-cover"
        />
      ) : null}
      {title ? <h3 className="mt-4 font-display text-3xl leading-tight text-balance">{title}</h3> : null}
      <p
        className={cn(
          "text-pretty whitespace-pre-wrap",
          title ? "mt-4 font-display text-lg leading-relaxed" : "mt-4 font-display text-2xl leading-snug",
        )}
      >
        {body}
      </p>
      {angle ? <p className="mt-5 border-l border-line-strong pl-4 text-sm leading-relaxed text-muted">{angle}</p> : null}
      {heat === "flash" ? (
        <p className="mt-6 text-sm text-muted">这一闪可以就停在这里，也可以刻成诗、画面，或一件能做的事。</p>
      ) : (
        <p className="mt-6 text-sm leading-relaxed text-pretty text-muted">
          <span className="text-subtle">原稿 · </span>
          {spark.raw}
        </p>
      )}
      {heat === "piece" ? null : heat === "sharp" ? (
        <Button className="mt-5" disabled={pending} onClick={onCarve}>
          {pending ? (painting ? "正在画…" : "正在雕琢…") : "雕琢成作"}
        </Button>
      ) : (
        <Button className="mt-5" disabled={pending} onClick={onShape}>
          {pending ? "正在整理…" : "让灵光整理"}
        </Button>
      )}
    </article>
  );
}

function FormPick({ value, onChange }: { value: FormId; onChange: (form: FormId) => void }) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <ChipRow label="落到" name="落到哪一种" forms={MOVES} value={value} onChange={onChange} />
      <ChipRow label="写成" name="写成什么" forms={WRITTEN} value={value} onChange={onChange} />
    </div>
  );
}

function ChipRow({
  label,
  name,
  forms,
  value,
  onChange,
}: {
  label: string;
  name: string;
  forms: readonly { id: FormId; label: string }[];
  value: FormId;
  onChange: (form: FormId) => void;
}) {
  return (
    <div role="group" aria-label={name}>
      <p className="text-xs text-subtle">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {forms.map((form) => (
          <button
            key={form.id}
            type="button"
            aria-pressed={value === form.id}
            onClick={() => onChange(form.id)}
            className={cn(
              "h-11 rounded-lg px-3 text-sm",
              value === form.id ? "bg-accent text-accent-fg" : "border border-line text-muted",
            )}
          >
            {form.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function carvePayload(spark: Spark, form: FormId) {
  return {
    id: spark.id,
    raw: spark.raw,
    kind: spark.kind,
    form,
    description: spark.description?.body,
    stronger: spark.elevation?.stronger,
    angle: spark.elevation?.angle,
  };
}

function StageRail({ heat }: { heat: Heat }) {
  const current = STAGES.findIndex((stage) => stage.id === heat);
  return (
    <ol className="mt-3 flex flex-wrap items-center gap-x-2 text-xs" aria-label="从闪到作品">
      {STAGES.map((stage, index) => (
        <li key={stage.id} className="flex items-center gap-2">
          {index > 0 ? (
            <span aria-hidden className="text-line-strong">
              —
            </span>
          ) : null}
          <span className={index === current ? "text-ink" : index < current ? "text-muted" : "text-subtle"} aria-current={index === current ? "step" : undefined}>
            {stage.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Beside({ id }: { id: string }) {
  const spark = useSparks((state) => state.sparks.find((item) => item.id === id));
  const sparks = useSparks((state) => state.sparks);
  const clusters = useSparks((state) => state.clusters);
  const setOpenId = useSparks((state) => state.setOpenId);
  if (!spark) return null;
  const items = beside(spark, sparks, clusters);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="beside-heading">
      <SectionLabel id="beside-heading" title="挨着" note="同一组，或用了相近的字。" />
      <ul className="mt-2">
        {items.map((item) => (
          <li key={item.id} className="border-b border-line">
            <button
              type="button"
              onClick={() => setOpenId(item.id)}
              className="flex min-h-11 w-full items-baseline justify-between gap-4 py-2 text-left"
            >
              <span className="font-display text-base">{item.title}</span>
              <span className="shrink-0 text-xs text-subtle">{item.why}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function KindSelect({ id, kind }: { id: string; kind: Kind }) {
  return (
    <select
      id="spark-kind"
      aria-label="类型"
      value={kind}
      onChange={(event) => {
        const match = KINDS.find((item) => item.id === event.target.value);
        if (!match) return;
        useSparks.setState((state) => ({
          sparks: state.sparks.map((item) =>
            item.id === id ? { ...item, kind: match.id, example: false, updatedAt: Date.now() } : item,
          ),
        }));
      }}
      className="h-11 rounded-lg border border-line bg-elevated px-3 text-sm text-ink"
    >
      {KINDS.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

function SectionLabel({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <div>
      <h3 id={id} className="font-display text-lg">
        {title}
      </h3>
      <p className="mt-1 text-sm text-muted">{note}</p>
    </div>
  );
}

function scrollTo(node: HTMLElement | null) {
  if (!node) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
}
