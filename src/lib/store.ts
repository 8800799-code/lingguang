import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DRAFT_LIMIT,
  SEED_CLUSTERS,
  SEED_SPARKS,
  type Cluster,
  type Kind,
  type Spark,
  type Step,
  type View,
  isMove,
  type FormId,
} from "@/lib/sparks";

type Description = { title: string; body: string };
type Elevation = { title: string; stronger: string; angle: string; next: Step[] };
type Work = NonNullable<Spark["work"]>;
type Synthesis = { theme: string; summary: string; throughline: string; moves: Step[] };

type State = {
  sparks: Spark[];
  clusters: Cluster[];
  draft: string;
  draftKind: Kind;
  draftIntent: FormId | null;
  view: View;
  activeClusterId: string | null;
  openId: string | null;
  pending: boolean;
  busyId: string | null;
  savedAt: number;
  lastId: string | null;
  setDraft: (draft: string) => void;
  setDraftKind: (kind: Kind) => void;
  setDraftIntent: (intent: FormId | null) => void;
  setView: (view: View) => void;
  setOpenId: (id: string | null) => void;
  setPending: (pending: boolean, busyId?: string | null) => void;
  clearLast: () => void;
  setActiveClusterId: (id: string | null) => void;
  capture: (raw: string, kind: Kind, intent?: FormId | null) => string | null;
  updateRaw: (id: string, raw: string) => void;
  togglePin: (id: string) => void;
  removeSpark: (id: string) => void;
  clearExamples: () => void;
  setDescription: (id: string, description: Description) => void;
  setElevation: (id: string, elevation: Elevation) => void;
  setWork: (id: string, work: Work) => void;
  toggleStep: (id: string, index: number) => void;
  setStepText: (id: string, index: number, text: string) => void;
  addStep: (id: string) => void;
  addCluster: (name: string) => string;
  renameCluster: (id: string, name: string) => void;
  removeCluster: (id: string) => void;
  addToCluster: (clusterId: string, sparkIds: string[]) => void;
  removeFromCluster: (clusterId: string, sparkId: string) => void;
  setSynthesis: (id: string, synthesis: Synthesis) => void;
  toggleMove: (id: string, index: number) => void;
  setMoveText: (id: string, index: number, text: string) => void;
};

function withSeedWork(sparks: Spark[]): Spark[] {
  return sparks.map((spark) => {
    if (!spark.example || spark.work?.body.trim()) return spark;
    const seed = SEED_SPARKS.find((item) => item.id === spark.id);
    if (!seed?.work) return spark;
    return { ...spark, work: seed.work };
  });
}

export const useSparks = create<State>()(
  persist(
    (set, get) => ({
      sparks: SEED_SPARKS,
      clusters: SEED_CLUSTERS,
      draft: "",
      draftKind: "line",
      draftIntent: null,
      view: "capture",
      activeClusterId: SEED_CLUSTERS[0]?.id ?? null,
      openId: null,
      pending: false,
      busyId: null,
      savedAt: 0,
      lastId: null,
      setDraft: (draft) => set({ draft: draft.slice(0, DRAFT_LIMIT) }),
      setDraftKind: (draftKind) => set({ draftKind }),
      setDraftIntent: (draftIntent) => set({ draftIntent: draftIntent && isMove(draftIntent) ? draftIntent : null }),
      setView: (view) => set({ view }),
      setOpenId: (openId) => set({ openId }),
      setPending: (pending, busyId = null) => set({ pending, busyId: pending ? busyId : null }),
      clearLast: () => set({ lastId: null }),
      setActiveClusterId: (activeClusterId) => set({ activeClusterId }),
      capture: (raw, kind, intent) => {
        const text = raw.trim();
        if (!text) return null;
        const now = Date.now();
        const spark: Spark = {
          id: crypto.randomUUID(),
          raw: text.slice(0, DRAFT_LIMIT),
          kind,
          intent: intent && isMove(intent) ? intent : undefined,
          createdAt: now,
          updatedAt: now,
          pinned: false,
        };
        set({
          sparks: [spark, ...get().sparks],
          draft: "",
          draftIntent: null,
          savedAt: now,
          lastId: spark.id,
        });
        return spark.id;
      },
      updateRaw: (id, raw) =>
        set((state) => ({
          sparks: state.sparks.map((spark) =>
            spark.id === id
              ? { ...spark, raw: raw.trim().slice(0, DRAFT_LIMIT), updatedAt: Date.now(), example: false }
              : spark,
          ),
        })),
      togglePin: (id) =>
        set((state) => ({
          sparks: state.sparks.map((spark) =>
            spark.id === id ? { ...spark, pinned: !spark.pinned } : spark,
          ),
        })),
      removeSpark: (id) =>
        set((state) => ({
          sparks: state.sparks.filter((spark) => spark.id !== id),
          clusters: state.clusters.map((cluster) => ({
            ...cluster,
            sparkIds: cluster.sparkIds.filter((sparkId) => sparkId !== id),
          })),
          openId: state.openId === id ? null : state.openId,
        })),
      clearExamples: () =>
        set((state) => {
          const clusters = state.clusters.filter((cluster) => !cluster.example);
          const activeStillThere = clusters.some((cluster) => cluster.id === state.activeClusterId);
          return {
            sparks: state.sparks.filter((spark) => !spark.example),
            clusters,
            activeClusterId: activeStillThere ? state.activeClusterId : (clusters[0]?.id ?? null),
            openId: state.sparks.find((spark) => spark.id === state.openId && spark.example)
              ? null
              : state.openId,
          };
        }),
      setDescription: (id, description) =>
        set((state) => ({
          sparks: state.sparks.map((spark) =>
            spark.id === id ? { ...spark, description, updatedAt: Date.now() } : spark,
          ),
        })),
      setElevation: (id, elevation) =>
        set((state) => ({
          sparks: state.sparks.map((spark) =>
            spark.id === id ? { ...spark, elevation, updatedAt: Date.now() } : spark,
          ),
        })),
      setWork: (id, work) =>
        set((state) => ({
          sparks: state.sparks.map((spark) => (spark.id === id ? { ...spark, work, updatedAt: Date.now() } : spark)),
        })),
      toggleStep: (id, index) =>
        set((state) => ({
          sparks: state.sparks.map((spark) => {
            if (spark.id !== id || !spark.elevation) return spark;
            return {
              ...spark,
              elevation: {
                ...spark.elevation,
                next: spark.elevation.next.map((step, stepIndex) =>
                  stepIndex === index ? { ...step, done: !step.done } : step,
                ),
              },
            };
          }),
        })),
      setStepText: (id, index, text) =>
        set((state) => ({
          sparks: state.sparks.map((spark) => {
            if (spark.id !== id || !spark.elevation) return spark;
            return {
              ...spark,
              elevation: {
                ...spark.elevation,
                next: spark.elevation.next.map((step, stepIndex) =>
                  stepIndex === index ? { ...step, text: text.slice(0, 80) } : step,
                ),
              },
            };
          }),
        })),
      addStep: (id) =>
        set((state) => ({
          sparks: state.sparks.map((spark) => {
            if (spark.id !== id || !spark.elevation || spark.elevation.next.length >= 5) return spark;
            return {
              ...spark,
              elevation: {
                ...spark.elevation,
                next: [...spark.elevation.next, { text: "", done: false }],
              },
            };
          }),
        })),
      addCluster: (name) => {
        const id = crypto.randomUUID();
        const cluster: Cluster = {
          id,
          name: name.trim().slice(0, 24) || "未命名的一组",
          sparkIds: [],
          createdAt: Date.now(),
        };
        set((state) => ({
          clusters: [cluster, ...state.clusters],
          activeClusterId: id,
        }));
        return id;
      },
      renameCluster: (id, name) =>
        set((state) => ({
          clusters: state.clusters.map((cluster) =>
            cluster.id === id
              ? { ...cluster, name: name.trim().slice(0, 24) || cluster.name }
              : cluster,
          ),
        })),
      removeCluster: (id) =>
        set((state) => {
          const clusters = state.clusters.filter((cluster) => cluster.id !== id);
          return {
            clusters,
            activeClusterId:
              state.activeClusterId === id ? (clusters[0]?.id ?? null) : state.activeClusterId,
          };
        }),
      addToCluster: (clusterId, sparkIds) =>
        set((state) => ({
          clusters: state.clusters.map((cluster) => {
            if (cluster.id !== clusterId) return cluster;
            const next = [...cluster.sparkIds];
            for (const sparkId of sparkIds) {
              if (!next.includes(sparkId)) next.push(sparkId);
            }
            return { ...cluster, sparkIds: next.slice(0, 24) };
          }),
        })),
      removeFromCluster: (clusterId, sparkId) =>
        set((state) => ({
          clusters: state.clusters.map((cluster) =>
            cluster.id === clusterId
              ? { ...cluster, sparkIds: cluster.sparkIds.filter((id) => id !== sparkId) }
              : cluster,
          ),
        })),
      setSynthesis: (id, synthesis) =>
        set((state) => ({
          clusters: state.clusters.map((cluster) =>
            cluster.id === id ? { ...cluster, synthesis } : cluster,
          ),
        })),
      toggleMove: (id, index) =>
        set((state) => ({
          clusters: state.clusters.map((cluster) => {
            if (cluster.id !== id || !cluster.synthesis) return cluster;
            return {
              ...cluster,
              synthesis: {
                ...cluster.synthesis,
                moves: cluster.synthesis.moves.map((step, stepIndex) =>
                  stepIndex === index ? { ...step, done: !step.done } : step,
                ),
              },
            };
          }),
        })),
      setMoveText: (id, index, text) =>
        set((state) => ({
          clusters: state.clusters.map((cluster) => {
            if (cluster.id !== id || !cluster.synthesis) return cluster;
            return {
              ...cluster,
              synthesis: {
                ...cluster.synthesis,
                moves: cluster.synthesis.moves.map((step, stepIndex) =>
                  stepIndex === index ? { ...step, text: text.slice(0, 80) } : step,
                ),
              },
            };
          }),
        })),
    }),
    {
      name: "lingguang-v1",
      skipHydration: true,
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<State>;
        const sparks = Array.isArray(stored.sparks) ? withSeedWork(stored.sparks) : current.sparks;
        return { ...current, ...stored, sparks };
      },
      partialize: (state) => ({
        sparks: state.sparks,
        clusters: state.clusters,
        draft: state.draft,
        draftKind: state.draftKind,
        draftIntent: state.draftIntent,
        view: state.view,
        activeClusterId: state.activeClusterId,
      }),
    },
  ),
);
