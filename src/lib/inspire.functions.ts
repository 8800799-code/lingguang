import { createServerFn } from "@tanstack/react-start";
import { formTakesImage, isForm, kindLabel, type FormId } from "@/lib/sparks";

const SYSTEM = [
  "你是一位克制、具体的中文编辑，帮人把闪念写成还能用的东西。",
  "保留用户自己的意象和判断，不要换成另一个点子，不要鸡汤，不要表情符号，不要排比口号。",
  "只输出一个 JSON 对象，不要使用 Markdown。",
].join("");

const KIND_HINT: Record<string, string> = {
  line: "这是一句灵感。守住节奏和意象，不要扩成故事梗概。提升时给出更锋利的一句，以及怎么用它。",
  scene: "这是一个画面。描写时补感官和空间，不要解释主题。提升时指出镜头该停在哪里。",
  story: "这是故事碎片。保住人物的欲望和转折。提升时指出下一拍，而不是整部大纲。",
  product: "这是产品念头。描写使用发生的那一刻。提升时收成今天能做的最小试验。",
  sound: "这是声音或旋律的印象。写质地、速度和它出现的场合。提升时给出可以记录下来的下一步。",
  note: "这是一则随记。把含混处写清楚。提升时收成一个可执行的判断。",
};

type ChatResult = { ok: true; text: string } | { ok: false; error: string };

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+\n/g, "\n").trim().slice(0, max);
}

function asList(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) return String(part.text ?? "");
      return "";
    })
    .join("");
}

function parseObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return asRecord(JSON.parse(trimmed.slice(start, end + 1)));
  } catch {
    return null;
  }
}

async function chat(user: string, maxTokens: number): Promise<ChatResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "写作助手暂时不在。原稿还在这台设备上，可以稍后再试，或自己铺开。" };
  }

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(90_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.5,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: false, error: "写作助手这次没有完成。原稿还在，请再试一次。" };
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const text = messageText(body.choices?.[0]?.message?.content);
    if (!text.trim()) {
      return { ok: false, error: "没有得到可用的文字。请再试一次。" };
    }
    return { ok: true, text };
  } catch {
    return { ok: false, error: "没能连上写作助手。原稿还在，请再试一次。" };
  }
}

function readObject(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const parsed = parseObject(text);
  if (!parsed) return { ok: false, error: "结果没能整理成文。请再试一次。" };
  return { ok: true, value: parsed };
}

export const describeSpark = createServerFn({ method: "POST" })
  .validator((input: { raw: string; kind: string }) => input)
  .handler(async ({ data }) => {
    const raw = clip(typeof data?.raw === "string" ? data.raw : "", 4000);
    if (raw.length < 2) return { ok: false as const, error: "再写几个字，才能描写。" };
    const kind = clip(typeof data?.kind === "string" ? data.kind : "note", 24);
    const hint = KIND_HINT[kind] ?? KIND_HINT.note;
    const result = await chat(
      [
        `类型：${kindLabel(kind)}`,
        hint,
        "",
        "原稿：",
        raw,
        "",
        '输出 JSON：{"title":"不超过14个字","body":"140到220个字，具体，有感官，保留原稿意象"}',
      ].join("\n"),
      700,
    );
    if (!result.ok) return result;
    const parsed = readObject(result.text);
    if (!parsed.ok) return parsed;
    const title = asString(parsed.value.title, 18);
    const body = asString(parsed.value.body, 500);
    if (body.length < 20) return { ok: false as const, error: "描写太短，没有成形。请再试一次。" };
    return { ok: true as const, description: { title: title || raw.slice(0, 14), body } };
  });

export const elevateSpark = createServerFn({ method: "POST" })
  .validator((input: { raw: string; kind: string; description?: string }) => input)
  .handler(async ({ data }) => {
    const raw = clip(typeof data?.raw === "string" ? data.raw : "", 4000);
    if (raw.length < 2) return { ok: false as const, error: "再写几个字，才能提升。" };
    const kind = clip(typeof data?.kind === "string" ? data.kind : "note", 24);
    const description = clip(typeof data?.description === "string" ? data.description : "", 500);
    const hint = KIND_HINT[kind] ?? KIND_HINT.note;
    const result = await chat(
      [
        `类型：${kindLabel(kind)}`,
        hint,
        "",
        "原稿：",
        raw,
        description ? `\n已有描写：\n${description}` : "",
        "",
        '输出 JSON：{"title":"不超过14个字","stronger":"80到160个字，更锋利，仍是同一个点子","angle":"一句话，这则灵感真正咬住的是什么","next":["今天就能做的一小步","第二步","第三步"]}',
      ].join("\n"),
      800,
    );
    if (!result.ok) return result;
    const parsed = readObject(result.text);
    if (!parsed.ok) return parsed;
    const stronger = asString(parsed.value.stronger, 400);
    const next = asList(parsed.value.next, 3, 48);
    if (stronger.length < 8 || next.length < 2) {
      return { ok: false as const, error: "提升没有成形。请再试一次。" };
    }
    return {
      ok: true as const,
      elevation: {
        title: asString(parsed.value.title, 18) || raw.slice(0, 14),
        stronger,
        angle: asString(parsed.value.angle, 80),
        next,
      },
    };
  });

export const shapeSpark = createServerFn({ method: "POST" })
  .validator((input: { raw: string; kind: string }) => input)
  .handler(async ({ data }) => {
    const raw = clip(typeof data?.raw === "string" ? data.raw : "", 4000);
    if (raw.length < 2) return { ok: false as const, error: "再写几个字，才能整理。" };
    const kind = clip(typeof data?.kind === "string" ? data.kind : "note", 24);
    const hint = KIND_HINT[kind] ?? KIND_HINT.note;
    const result = await chat(
      [
        `类型：${kindLabel(kind)}`,
        hint,
        "一次做完两件事：先把原稿描写清楚，再提升成还能往下做的一版。不要改成另一个点子。",
        "",
        "原稿：",
        raw,
        "",
        '输出 JSON：{"description":{"title":"不超过14个字","body":"140到220个字"},"elevation":{"title":"不超过14个字","stronger":"80到160个字","angle":"一句话，这则灵感真正咬住的是什么","next":["今天就能做的一小步","第二步","第三步"]}}',
      ].join("\n"),
      1100,
    );
    if (!result.ok) return result;
    const parsed = readObject(result.text);
    if (!parsed.ok) return parsed;
    const described = asRecord(parsed.value.description);
    const lifted = asRecord(parsed.value.elevation);
    const body = asString(described?.body, 500);
    const stronger = asString(lifted?.stronger, 400);
    const next = asList(lifted?.next, 3, 48);
    if (body.length < 20 || stronger.length < 8 || next.length < 2) {
      return { ok: false as const, error: "整理没有成形。请再试一次。" };
    }
    return {
      ok: true as const,
      description: {
        title: asString(described?.title, 18) || raw.slice(0, 14),
        body,
      },
      elevation: {
        title: asString(lifted?.title, 18) || raw.slice(0, 14),
        stronger,
        angle: asString(lifted?.angle, 80),
        next,
      },
    };
  });

const FORM_HINT: Record<string, string> = {
  poem: "刻成一首短诗。四到八行，每行单独换行。留住一个具体的物。不要把标题再写进正文。",
  passage: "刻成一段能单独读完的话。120到220个字，不分点，不口号。",
  picture: "正文是看这幅画时能对上的一句话，40到80个字。另写 imagePrompt：具体的英文画面，不要文字、水印、名人。",
  landscape: "正文是身在这处风景里的两句，40到80个字。imagePrompt 用英文写安静的风景，有光线和天气，不要文字、水印、名人。",
  idea: "刻成一个创意。说清这是什么、给谁、和现成的差在哪里。80到140个字。",
  seed: "刻成一则还能接着长的灵感。留下一个物、一个疑问、一条没走完的路。60到120个字。不要写成成品。",
  use: "刻成一个今天就能动手的应用。写做什么、用什么、第一步、怎样算做成。80到160个字。",
  land: "用户突然有一个项目或想法，要马上变成能做的结果。用换行分成四小段，每段先写一个短标题再写内容：结果（最小能交付的是什么）、今天（做完今天手里有什么）、第一步（接下来三小时只做这一件）、会卡在（一个障碍和绕过去的办法）。不要计划书，不要口号。140到200个字。",
  upgrade: "用户看见一个已有的产品或作品，想升级它。用换行分成四小段：现在弱在（只说一处）、更好的一版（具体长什么样）、只改这里（今天动的那一个地方）、做出来是（别人能看见的差别）。不要把原物贬低一通。140到200个字。",
  path: "用户从一条新闻联想到一条能走的路。用换行分成五小段：变了的事实（新闻里真正变了什么）、谁会付钱（谁、为什么是现在）、怎么走（一件具体的事，不是行业空话）、第一步、会断在（最可能走不通的地方）。不承诺赚到钱，不写违法、欺骗或钻空子的做法。如果这条路不干净，直接写不该做，并给一条干净的替代。160到220个字。",
  mine: "用户看见别人在做一件事，觉得自己来做会更好。用换行分成四小段：看见的事、我会更好的一点（只留一点）、我的版本（做什么、给谁）、今天开始（一步）。不要嘲笑那个人。140到200个字。",
};

async function paint(prompt: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "画面暂时画不出来。文字可以先留下。" };
  try {
    const response = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      signal: AbortSignal.timeout(90_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-imagine-image",
        prompt: prompt.slice(0, 1200),
        n: 1,
        response_format: "url",
      }),
    });
    if (!response.ok) return { ok: false, error: "画面没有出来。文字先留下了，可以再试一次。" };
    const payload = (await response.json()) as { data?: { url?: string }[] };
    const url = payload.data?.[0]?.url ?? "";
    if (!url.startsWith("https://")) return { ok: false, error: "画面没有出来。文字先留下了，可以再试一次。" };
    return { ok: true, url };
  } catch {
    return { ok: false, error: "画面没有出来。文字先留下了，可以再试一次。" };
  }
}

export const carveSpark = createServerFn({ method: "POST" })
  .validator(
    (input: { raw: string; kind: string; form?: string; description?: string; stronger?: string; angle?: string }) =>
      input,
  )
  .handler(async ({ data }) => {
    const raw = clip(typeof data?.raw === "string" ? data.raw : "", 4000);
    if (raw.length < 2) return { ok: false as const, error: "再写几个字，才能雕琢。" };
    const kind = clip(typeof data?.kind === "string" ? data.kind : "note", 24);
    const requested = typeof data?.form === "string" ? data.form : "";
    const form: FormId = isForm(requested) ? requested : "passage";
    const description = clip(typeof data?.description === "string" ? data.description : "", 500);
    const stronger = clip(typeof data?.stronger === "string" ? data.stronger : "", 400);
    const angle = clip(typeof data?.angle === "string" ? data.angle : "", 80);
    const visual = formTakesImage(form);
    const result = await chat(
      [
        `类型：${kindLabel(kind)}`,
        KIND_HINT[kind] ?? KIND_HINT.note,
        FORM_HINT[form] ?? FORM_HINT.passage,
        "不要换成另一个点子，不要鸡汤，不要排比口号。原稿里的具体事物必须还在。",
        "",
        "原稿：",
        raw,
        description ? `\n已有描写：\n${description}` : "",
        stronger ? `\n已有提升：\n${stronger}` : "",
        angle ? `\n它咬住的是：\n${angle}` : "",
        "",
        visual
          ? '输出 JSON：{"title":"不超过12个字","body":"看画时的那句话","imagePrompt":"English visual prompt"}'
          : '输出 JSON：{"title":"不超过12个字","body":"按上面的篇幅。诗需要断行时用换行，不要用 Markdown"}',
      ].join("\n"),
      visual ? 500 : 800,
    );
    if (!result.ok) return result;
    const parsed = readObject(result.text);
    if (!parsed.ok) return parsed;
    const body = asString(parsed.value.body, 700);
    if (body.length < (visual ? 8 : 16)) return { ok: false as const, error: "作品没有成形。请再试一次。" };
    const work = {
      title: asString(parsed.value.title, 16) || raw.slice(0, 12),
      body,
      form,
    };
    if (!visual) return { ok: true as const, work };
    const painted = await paint(asString(parsed.value.imagePrompt, 800));
    if (!painted.ok) return { ok: true as const, work, warning: painted.error };
    return { ok: true as const, work: { ...work, image: painted.url } };
  });

export const synthesizeCluster = createServerFn({ method: "POST" })
  .validator((input: { sparks: { kind: string; raw: string }[] }) => input)
  .handler(async ({ data }) => {
    const sparks = Array.isArray(data?.sparks) ? data.sparks : [];
    const items = sparks
      .map((spark) => ({
        kind: clip(typeof spark?.kind === "string" ? spark.kind : "note", 24),
        raw: clip(typeof spark?.raw === "string" ? spark.raw : "", 500),
      }))
      .filter((spark) => spark.raw.length >= 2)
      .slice(0, 8);
    if (items.length < 2) return { ok: false as const, error: "至少放进两则，才能看出它们的线。" };
    const result = await chat(
      [
        "下面是同一组灵感。找出贯穿它们的那根线，不要逐条复述。",
        "",
        ...items.map((spark, index) => `${index + 1}. [${kindLabel(spark.kind)}] ${spark.raw}`),
        "",
        '输出 JSON：{"theme":"不超过12个字","summary":"120到200个字","throughline":"一句话","moves":["可以把这组变成什么","第二步","第三步"]}',
      ].join("\n"),
      900,
    );
    if (!result.ok) return result;
    const parsed = readObject(result.text);
    if (!parsed.ok) return parsed;
    const summary = asString(parsed.value.summary, 500);
    const moves = asList(parsed.value.moves, 3, 48);
    if (summary.length < 20 || moves.length < 2) {
      return { ok: false as const, error: "汇总没有成形。请再试一次。" };
    }
    return {
      ok: true as const,
      synthesis: {
        theme: asString(parsed.value.theme, 16) || "同一根线",
        summary,
        throughline: asString(parsed.value.throughline, 80),
        moves,
      },
    };
  });
