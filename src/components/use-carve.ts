import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { carveSpark } from "@/lib/inspire.functions";
import { useSparks } from "@/lib/store";

export function useCarveSpark() {
  const carve = useServerFn(carveSpark);
  const pending = useSparks((state) => state.pending);
  const busyId = useSparks((state) => state.busyId);
  const setPending = useSparks((state) => state.setPending);
  const setWork = useSparks((state) => state.setWork);
  const [error, setError] = useState("");
  const [errorId, setErrorId] = useState<string | null>(null);

  async function run(spark: {
    id: string;
    raw: string;
    kind: string;
    form?: string;
    description?: string;
    stronger?: string;
    angle?: string;
  }) {
    if (useSparks.getState().pending) return;
    setError("");
    setErrorId(null);
    setPending(true, spark.id);
    try {
      const result = await carve({
        data: {
          raw: spark.raw,
          kind: spark.kind,
          form: spark.form ?? "passage",
          description: spark.description ?? "",
          stronger: spark.stronger ?? "",
          angle: spark.angle ?? "",
        },
      });
      if (!result.ok) {
        setError(result.error);
        setErrorId(spark.id);
        return;
      }
      setWork(spark.id, result.work);
      if (result.warning) {
        setError(result.warning);
        setErrorId(spark.id);
      }
    } catch {
      setError("没能连上写作助手。原稿还在，请再试一次。");
      setErrorId(spark.id);
    } finally {
      setPending(false);
    }
  }

  return { run, pending, busyId, error, errorId };
}
