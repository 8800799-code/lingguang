import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { synthesizeCluster } from "@/lib/inspire.functions";
import { clusterToText, kindLabel, sortSparks, sparkTitle } from "@/lib/sparks";
import { useSparks } from "@/lib/store";
import { Button, StepList, copyText } from "@/components/ui";
import { cn } from "@/lib/cn";

export function GatherView() {
  const sparks = useSparks((state) => state.sparks);
  const clusters = useSparks((state) => state.clusters);
  const activeClusterId = useSparks((state) => state.activeClusterId);
  const pending = useSparks((state) => state.pending);
  const setPending = useSparks((state) => state.setPending);
  const setActiveClusterId = useSparks((state) => state.setActiveClusterId);
  const addCluster = useSparks((state) => state.addCluster);
  const renameCluster = useSparks((state) => state.renameCluster);
  const removeCluster = useSparks((state) => state.removeCluster);
  const addToCluster = useSparks((state) => state.addToCluster);
  const removeFromCluster = useSparks((state) => state.removeFromCluster);
  const setSynthesis = useSparks((state) => state.setSynthesis);
  const toggleMove = useSparks((state) => state.toggleMove);
  const setMoveText = useSparks((state) => state.setMoveText);
  const setOpenId = useSparks((state) => state.setOpenId);
  const synthesize = useServerFn(synthesizeCluster);

  const active = clusters.find((cluster) => cluster.id === activeClusterId) ?? clusters[0] ?? null;
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [nameDraft, setNameDraft] = useState(active?.name ?? "");

  useEffect(() => {
    setNameDraft(active?.name ?? "");
    setPicking(false);
    setPicked([]);
    setConfirming(false);
    setError("");
  }, [active?.id, active?.name]);

  const members = active
    ? sortSparks(sparks.filter((spark) => active.sparkIds.includes(spark.id)))
    : [];
  const available = sortSparks(sparks.filter((spark) => !active?.sparkIds.includes(spark.id)));

  async function runSynthesis() {
    if (!active || useSparks.getState().pending) return;
    setError("");
    setPending(true);
    try {
      const forModel = [...members].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
      const result = await synthesize({
        data: {
          sparks: forModel.map((spark) => ({ kind: spark.kind, raw: spark.raw })),
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSynthesis(active.id, {
        ...result.synthesis,
        moves: result.synthesis.moves.map((text) => ({ text, done: false })),
      });
    } catch {
      setError("没能连上写作助手。这组还在，请再试一次。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div>
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl text-balance">汇总</h2>
          <Button variant="ghost" onClick={() => setNaming(true)}>
            新的一组
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted">把散落的几则收成一条线。</p>
        {naming ? (
          <form
            className="mt-4 flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addCluster(name);
              setName("");
              setNaming(false);
            }}
          >
            <label className="sr-only" htmlFor="cluster-name">
              组名
            </label>
            <input
              id="cluster-name"
              value={name}
              autoFocus
              placeholder="这组叫什么"
              onChange={(event) => setName(event.target.value.slice(0, 24))}
              className="h-11 rounded-lg border border-line bg-elevated px-3 text-sm focus:outline-none"
            />
            <div className="flex gap-2">
              <Button type="submit">建好</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setNaming(false);
                  setName("");
                }}
              >
                取消
              </Button>
            </div>
          </form>
        ) : null}
        {clusters.length === 0 ? (
          <p className="mt-6 text-sm text-muted">还没有组。建一组，把相近的灵光放进来。</p>
        ) : (
          <ul className="mt-4 border-t border-line">
            {clusters.map((cluster) => (
              <li key={cluster.id} className="border-b border-line">
                <button
                  type="button"
                  onClick={() => setActiveClusterId(cluster.id)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm",
                    active?.id === cluster.id ? "text-ink" : "text-muted",
                  )}
                  aria-current={active?.id === cluster.id ? "true" : undefined}
                >
                  <span className="truncate">{cluster.name}</span>
                  <span className="tabular-nums text-subtle">{cluster.sparkIds.length}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {active ? (
        <article className="min-w-0">
          <input
            aria-label="组名"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value.slice(0, 24))}
            onBlur={() => {
              if (nameDraft.trim() && nameDraft !== active.name) renameCluster(active.id, nameDraft);
            }}
            className="w-full bg-transparent font-display text-2xl text-ink focus:outline-none"
          />
          {active.example ? <p className="mt-2 text-xs text-subtle">示例组</p> : null}

          {members.length === 0 ? (
            <p className="mt-4 text-sm text-muted">这一组还是空的。从灵笺里挑几则放进来。</p>
          ) : (
            <ul className="mt-4 border-t border-line">
              {members.map((spark) => {
                const label = spark.elevation?.title.trim() || spark.description?.title.trim() || "";
                return (
                  <li key={spark.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-line py-4">
                    <div className="relative min-w-0">
                      <p className="text-xs text-subtle">
                        {kindLabel(spark.kind)}
                        {spark.example ? " · 示例" : ""}
                      </p>
                      {label ? <p className="mt-1 font-display text-lg text-balance">{label}</p> : null}
                      <p
                        className={cn(
                          "text-pretty",
                          label
                            ? "mt-1 line-clamp-2 text-sm text-muted"
                            : "mt-1 line-clamp-3 font-display text-lg",
                        )}
                      >
                        {spark.raw}
                      </p>
                      <button
                        type="button"
                        aria-label={`打开 ${label || sparkTitle(spark)}`}
                        onClick={() => setOpenId(spark.id)}
                        className="absolute inset-0 rounded-lg"
                      />
                    </div>
                    <Button variant="quiet" onClick={() => removeFromCluster(active.id, spark.id)}>
                      移出
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setPicking((value) => !value)}>
              {picking ? "收起" : "从灵笺加入"}
            </Button>
            <Button disabled={pending || members.length < 2} onClick={() => void runSynthesis()}>
              {pending ? "正在写…" : active.synthesis ? "重新汇总" : "生成汇总"}
            </Button>
            <Button
              variant="quiet"
              onClick={async () => {
                const ok = await copyText(clusterToText(active, members));
                setCopied(ok);
                window.setTimeout(() => setCopied(false), 1400);
              }}
            >
              {copied ? "已复制" : "复制这一组"}
            </Button>
          </div>
          {members.length > 8 ? (
            <p className="mt-2 text-xs text-subtle">汇总先读这一组里较新的 8 则。</p>
          ) : null}
          {members.length < 2 ? <p className="mt-2 text-xs text-subtle">再放一则，才能看出它们的线。</p> : null}
          {error ? (
            <p role="status" className="mt-3 text-sm text-muted">
              {error}
            </p>
          ) : null}

          {picking ? (
            <fieldset className="mt-4 rounded-3xl border border-line bg-elevated p-4">
              <legend className="px-1 text-sm text-muted">选择要加入的灵笺</legend>
              {available.length === 0 ? (
                <p className="text-sm text-muted">没有更多可加入的了。</p>
              ) : (
                <ul className="max-h-64 overflow-y-auto">
                  {available.map((spark) => {
                    const checked = picked.includes(spark.id);
                    return (
                      <li key={spark.id}>
                        <label className="flex min-h-11 items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setPicked((current) =>
                                checked ? current.filter((item) => item !== spark.id) : [...current, spark.id],
                              )
                            }
                            className="size-4 accent-accent"
                          />
                          <span className="min-w-0 truncate">
                            {kindLabel(spark.kind)} · {sparkTitle(spark)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Button
                className="mt-3"
                disabled={picked.length === 0}
                onClick={() => {
                  addToCluster(active.id, picked);
                  setPicked([]);
                  setPicking(false);
                }}
              >
                加入这组
              </Button>
            </fieldset>
          ) : null}

          {active.synthesis ? (
            <div className="mt-8 border-t border-line pt-6">
              <p className="text-xs text-subtle">共同的线</p>
              <h2 className="mt-2 font-display text-2xl text-balance">{active.synthesis.theme}</h2>
              <p className="mt-4 text-base leading-relaxed text-pretty">{active.synthesis.summary}</p>
              {active.synthesis.throughline ? (
                <p className="mt-4 border-l border-line-strong pl-4 text-sm text-muted">{active.synthesis.throughline}</p>
              ) : null}
              <p className="mt-6 text-xs text-subtle">可以变成</p>
              <StepList
                steps={active.synthesis.moves}
                onToggle={(index) => toggleMove(active.id, index)}
                onText={(index, text) => setMoveText(active.id, index, text)}
              />
            </div>
          ) : null}

          <div className="mt-8">
            {confirming ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-muted">解散这一组？里面的灵笺还在。</p>
                <Button
                  onClick={() => {
                    removeCluster(active.id);
                    setConfirming(false);
                  }}
                >
                  解散
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  取消
                </Button>
              </div>
            ) : (
              <Button variant="quiet" className="px-0 text-subtle" onClick={() => setConfirming(true)}>
                解散这一组
              </Button>
            )}
          </div>
        </article>
      ) : null}
    </div>
  );
}
