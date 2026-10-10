import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { shapeSpark } from "@/lib/inspire.functions";
import { useSparks } from "@/lib/store";

export function useShapeSpark() {
  const shape = useServerFn(shapeSpark);
  const pending = useSparks((state) => state.pending);
  const busyId = useSparks((state) => state.busyId);
  const setPending = useSparks((state) => state.setPending);
  const setDescription = useSparks((state) => state.setDescription);
  const setElevation = useSparks((state) => state.setElevation);
  const [error, setError] = useState("");
  const [errorId, setErrorId] = useState<string | null>(null);

  async function run(spark: { id: string; raw: string; kind: string }) {
    if (useSparks.getState().pending) return;
    setError("");
    setErrorId(null);
    setPending(true, spark.id);
    try {
      const result = await shape({ data: { raw: spark.raw, kind: spark.kind } });
      if (!result.ok) {
        setError(result.error);
        setErrorId(spark.id);
        return;
      }
      setDescription(spark.id, result.description);
      setElevation(spark.id, {
        title: result.elevation.title,
        stronger: result.elevation.stronger,
        angle: result.elevation.angle,
        next: result.elevation.next.map((text) => ({ text, done: false })),
      });
    } catch {
      setError("没能连上写作助手。原稿还在，请再试一次。");
      setErrorId(spark.id);
    } finally {
      setPending(false);
    }
  }

  return { run, pending, busyId, error, errorId, setError };
}
