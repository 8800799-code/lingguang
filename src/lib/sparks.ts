export const KINDS = [
  { id: "line", label: "一句" },
  { id: "scene", label: "画面" },
  { id: "story", label: "故事" },
  { id: "product", label: "产品" },
  { id: "sound", label: "声音" },
  { id: "note", label: "随记" },
] as const;

export type Kind = (typeof KINDS)[number]["id"];
export type View = "capture" | "archive" | "gather";

export type Step = { text: string; done: boolean };

export type Spark = {
  id: string;
  raw: string;
  kind: Kind;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  example?: boolean;
  intent?: FormId;
  description?: { title: string; body: string };
  elevation?: { title: string; stronger: string; angle: string; next: Step[] };
  work?: { title: string; body: string; form?: FormId; image?: string };
};

export type Cluster = {
  id: string;
  name: string;
  sparkIds: string[];
  createdAt: number;
  example?: boolean;
  synthesis?: {
    theme: string;
    summary: string;
    throughline: string;
    moves: Step[];
  };
};

export const WRITTEN = [
  { id: "poem", label: "诗" },
  { id: "passage", label: "一段话" },
  { id: "picture", label: "图片" },
  { id: "landscape", label: "风景" },
  { id: "idea", label: "创意" },
  { id: "seed", label: "灵感" },
  { id: "use", label: "应用" },
] as const;

export const MOVES = [
  { id: "land", label: "落实", act: "马上落实", place: "把那个项目或想法写下来。不完整也行。" },
  { id: "upgrade", label: "升级", act: "升级这一则", place: "你看见的产品现在什么样，你想把它做成什么样。" },
  { id: "path", label: "路径", act: "理清这条路", place: "那条新闻是什么，你联想到的做法又是什么。" },
  { id: "mine", label: "我做", act: "换成我来做", place: "你看见谁在做一件事，你觉得自己怎么做会更好。" },
] as const;

export const FORMS = [...WRITTEN, ...MOVES] as const;

export type FormId = (typeof FORMS)[number]["id"];

export function isForm(value: string): value is FormId {
  return FORMS.some((form) => form.id === value);
}

export function formLabel(form: string): string {
  return FORMS.find((item) => item.id === form)?.label ?? "一段话";
}

export function defaultForm(kind: string): FormId {
  if (kind === "line") return "poem";
  if (kind === "scene") return "landscape";
  if (kind === "product") return "use";
  if (kind === "sound") return "seed";
  return "passage";
}

export function formTakesImage(form: string): boolean {
  return form === "picture" || form === "landscape";
}

export function isMove(form: string): boolean {
  return MOVES.some((move) => move.id === form);
}

export function moveOf(form: string) {
  return MOVES.find((move) => move.id === form);
}

export const STEMS = ["我看见", "如果", "有一句", "做成"] as const;

export const DRAFT_LIMIT = 4000;

export function isKind(value: string): value is Kind {
  return KINDS.some((kind) => kind.id === value);
}

export function kindLabel(kind: string): string {
  return KINDS.find((item) => item.id === kind)?.label ?? "随记";
}

export function previewLine(raw: string, max = 36): string {
  const line = raw.trim().split(/\n+/)[0] ?? "";
  if (line.length <= max) return line;
  return `${line.slice(0, max)}…`;
}

export function sparkTitle(spark: Spark): string {
  const titled = spark.work?.title.trim() || spark.elevation?.title.trim() || spark.description?.title.trim();
  if (titled) return titled;
  return previewLine(spark.raw, 28);
}

export function sortSparks(sparks: Spark[]): Spark[] {
  return [...sparks].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
}

export function formatWhen(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day} 天前`;
  const date = new Date(ts);
  const month = date.getMonth() + 1;
  const dayOfMonth = date.getDate();
  const hm = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  if (date.getFullYear() === new Date(now).getFullYear()) return `${month}月${dayOfMonth}日 ${hm}`;
  return `${date.getFullYear()}年${month}月${dayOfMonth}日`;
}

export function doneCount(steps: Step[]): string {
  const done = steps.filter((step) => step.done).length;
  return `${done}/${steps.length} 已做`;
}

export type Heat = "flash" | "drawn" | "sharp" | "piece";

export function heatOf(spark: Spark): Heat {
  if (spark.work?.body.trim() || spark.work?.image) return "piece";
  if (spark.elevation?.stronger.trim()) return "sharp";
  if (spark.description?.body.trim()) return "drawn";
  return "flash";
}

export const HEAT_LABEL: Record<Heat, string> = {
  flash: "闪",
  drawn: "描",
  sharp: "锋",
  piece: "作",
};

export const HEAT_NOTE: Record<Heat, string> = {
  flash: "还只有原稿",
  drawn: "已写成一段",
  sharp: "已推到能做的一步",
  piece: "已刻成一件作品",
};

export const STAGES: { id: Heat; label: string }[] = [
  { id: "flash", label: "闪" },
  { id: "drawn", label: "描" },
  { id: "sharp", label: "锋" },
  { id: "piece", label: "作" },
];

const GRAM_STOP = new Set("的了是在不有就这那也和与或而把被从对到还又很让给".split(""));

function grams(text: string): Set<string> {
  const chars = [...text].filter((char) => /[\u4e00-\u9fff]/.test(char));
  const found = new Set<string>();
  for (let index = 0; index < chars.length - 1; index += 1) {
    const pair = `${chars[index]}${chars[index + 1]}`;
    if ([...pair].some((char) => GRAM_STOP.has(char))) continue;
    found.add(pair);
  }
  return found;
}

export type Beside = { id: string; title: string; why: string };

export function beside(spark: Spark, sparks: Spark[], clusters: Cluster[]): Beside[] {
  const seen = new Set<string>([spark.id]);
  const found: Beside[] = [];
  for (const cluster of clusters) {
    if (!cluster.sparkIds.includes(spark.id)) continue;
    for (const id of cluster.sparkIds) {
      if (seen.has(id)) continue;
      const other = sparks.find((item) => item.id === id);
      if (!other) continue;
      seen.add(id);
      found.push({ id, title: sparkTitle(other), why: cluster.name });
      if (found.length >= 3) return found;
    }
  }
  const mine = grams(`${spark.raw}\n${spark.description?.body ?? ""}\n${spark.elevation?.stronger ?? ""}\n${spark.work?.body ?? ""}`);
  const lexical = sparks
    .filter((item) => !seen.has(item.id))
    .map((item) => {
      const shared = [...grams(`${item.raw}\n${item.elevation?.stronger ?? ""}\n${item.work?.body ?? ""}`)].filter((pair) => mine.has(pair));
      return { item, shared };
    })
    .filter((item) => item.shared.length >= 2)
    .sort((a, b) => b.shared.length - a.shared.length)
    .slice(0, 2);
  for (const item of lexical) {
    found.push({ id: item.item.id, title: sparkTitle(item.item), why: item.shared.slice(0, 2).join("、") });
  }
  return found.slice(0, 3);
}

export type Invitation =
  | { kind: "step"; sparkId: string; index: number; title: string; text: string; example: boolean }
  | { kind: "rest"; sparkId: string; title: string; raw: string; example: boolean };

function pickInvitation(sparks: Spark[], lastId: string | null): Invitation | null {
  const stepped = sparks
    .map((spark) => ({
      spark,
      index: spark.elevation?.next.findIndex((step) => !step.done && step.text.trim()) ?? -1,
    }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => b.spark.updatedAt - a.spark.updatedAt);
  const step = stepped[0];
  if (step?.spark.elevation) {
    const next = step.spark.elevation.next[step.index];
    if (next) {
      return {
        kind: "step",
        sparkId: step.spark.id,
        index: step.index,
        title: sparkTitle(step.spark),
        text: next.text,
        example: Boolean(step.spark.example),
      };
    }
  }
  const resting = sparks
    .filter((spark) => spark.id !== lastId && heatOf(spark) === "flash")
    .sort((a, b) => a.createdAt - b.createdAt);
  const rest = resting[0];
  if (!rest) return null;
  return { kind: "rest", sparkId: rest.id, title: sparkTitle(rest), raw: rest.raw, example: Boolean(rest.example) };
}

export function invitation(sparks: Spark[], lastId: string | null): Invitation | null {
  const own = pickInvitation(
    sparks.filter((spark) => !spark.example),
    lastId,
  );
  if (own) return own;
  if (lastId) return null;
  return pickInvitation(sparks, lastId);
}

export function slipText(spark: Spark): string {
  if (spark.work?.body.trim() || spark.work?.image) {
    const lines = [formLabel(spark.work.form ?? "passage"), spark.work.title, "", spark.work.body];
    lines.push("", "原稿", spark.raw.trim());
    return lines.filter((line) => line !== undefined).join("\n").trim();
  }
  if (spark.elevation?.stronger.trim()) {
    const lines = [spark.elevation.title, "", spark.elevation.stronger];
    if (spark.elevation.angle.trim()) lines.push("", spark.elevation.angle);
    lines.push("", "原稿", spark.raw.trim());
    return lines.join("\n").trim();
  }
  if (spark.description?.body.trim()) {
    return [spark.description.title, "", spark.description.body, "", "原稿", spark.raw.trim()].join("\n").trim();
  }
  return spark.raw.trim();
}

export function sparkToText(spark: Spark): string {
  const lines = [kindLabel(spark.kind), "", spark.raw.trim()];
  if (spark.description) {
    lines.push("", "描写", spark.description.title, spark.description.body);
  }
  if (spark.elevation) {
    lines.push(
      "",
      "提升",
      spark.elevation.title,
      spark.elevation.stronger,
      "",
      spark.elevation.angle,
      "",
      ...spark.elevation.next.map((step, index) => `${index + 1}. ${step.done ? "已做" : "待做"} ${step.text}`),
    );
  }
  if (spark.work?.body.trim() || spark.work?.image) {
    lines.push("", formLabel(spark.work.form ?? "passage"), spark.work.title, spark.work.body);
  }
  return lines.join("\n").trim();
}

export function clusterToText(cluster: Cluster, sparks: Spark[]): string {
  const lines = [cluster.name, ""];
  for (const spark of sparks) {
    lines.push(`- ${kindLabel(spark.kind)} ${sparkTitle(spark)}`, spark.raw.trim(), "");
  }
  if (cluster.synthesis) {
    lines.push(
      "汇总",
      cluster.synthesis.theme,
      cluster.synthesis.summary,
      "",
      cluster.synthesis.throughline,
      "",
      ...cluster.synthesis.moves.map((step, index) => `${index + 1}. ${step.done ? "已做" : "待做"} ${step.text}`),
    );
  }
  return lines.join("\n").trim();
}

const rainAt = Date.UTC(2026, 9, 9, 20, 40);
const boatAt = Date.UTC(2026, 9, 9, 16, 5);
const bookAt = Date.UTC(2026, 9, 8, 11, 20);

export const SEED_SPARKS: Spark[] = [
  {
    id: "ex-rain",
    kind: "line",
    raw: "雨刚停，柏油把整条街倒过来。有人撑着伞走过去，伞是干的。",
    createdAt: rainAt,
    updatedAt: rainAt,
    pinned: false,
    example: true,
    description: {
      title: "干伞走过倒影",
      body: "雨停之后，街面还是湿的，黑得像一面刚擦过的镜子。整条街被倒扣在脚边：檐口、窗、天空。人从这面镜子上走过去，伞却没有水痕，骨也没有滴下来。湿的是路，干的是那把伞。反差就停在这一步里，不必再解释他从哪来。",
    },
    elevation: {
      title: "干伞",
      stronger: "雨停了，街还湿着。一个人撑伞走过去，伞是干的。湿的只是地面，干的是他。",
      angle: "它咬住的不是雨，是一个和周遭反着的人。",
      next: [
        { text: "只保留这一句，删掉任何解释", done: false },
        { text: "给这把伞一个不说话的主人，写下他接下来的十步", done: false },
        { text: "若做成画面，镜头贴在柏油的倒影上，不要抬到脸", done: false },
      ],
    },
    work: {
      title: "干伞",
      form: "passage",
      body: "雨停了。柏油还湿，把整条街倒扣在脚边。一个人撑着伞走过去，伞是干的，骨上没有水。湿的是路。他没有停，倒影在脚下裂开，又在身后合上。",
    },
  },
  {
    id: "ex-boat",
    kind: "scene",
    raw: "厨房只留一盏灯。她把没寄出的信折成船，放进洗手池。水是温的，船却慢慢往水龙头那边漂。",
    createdAt: boatAt,
    updatedAt: boatAt,
    pinned: false,
    example: true,
  },
  {
    id: "ex-book",
    kind: "product",
    raw: "一个只服务十秒的本子。灵感来了就打开，写下那一句，不必成篇。十秒后它自己合上，免得被整理欲吓跑。",
    createdAt: bookAt,
    updatedAt: bookAt,
    pinned: false,
    example: true,
  },
];

export const SEED_CLUSTERS: Cluster[] = [
  {
    id: "ex-cluster",
    name: "十秒里的倒影",
    sparkIds: ["ex-rain", "ex-boat", "ex-book"],
    createdAt: Date.UTC(2026, 9, 9, 21, 0),
    example: true,
  },
];
