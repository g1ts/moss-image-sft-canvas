import { clampInt, numVal } from "./geometry";

export interface LoraInfo {
  name: string;
  path: string;
}

export interface LoraRow {
  path: string;
  mult: string;
}

export interface GenForm {
  prompt: string;
  negativePrompt: string;
  width: string;
  height: string;
  count: string;
  steps: string;
  cfg: string;
  seed: string;
  clip: string;
  scheduler: string;
  method: string;
  loras: LoraRow[];
}

export interface GenBody {
  prompt: string;
  negative_prompt: string;
  width: number;
  height: number;
  batch_count: number;
  seed: number;
  clip_skip: number;
  sample_params: {
    scheduler: string;
    sample_method: string;
    sample_steps: number;
    guidance: { txt_cfg: number };
  };
  lora: { path: string; multiplier: number; is_high_noise: boolean }[];
  output_format: string;
}

export function buildGenBody(f: GenForm): {
  body: GenBody;
  clamped: { width: number; height: number; count: number; steps: number };
} {
  const prompt = f.prompt.trim();
  if (!prompt) throw new Error("specify a prompt");
  const width = clampInt(f.width, 64, 4096, 512);
  const height = clampInt(f.height, 64, 4096, 512);
  const count = clampInt(f.count, 1, 4, 1);
  const steps = clampInt(f.steps, 1, 500, 20);
  const cfg = numVal(f.cfg, 7);
  const seed = clampInt(f.seed, -1, 2147483647, -1);
  if (!(cfg > 0)) throw new Error("cfg must be > 0");
  const body: GenBody = {
    prompt,
    negative_prompt: f.negativePrompt.trim(),
    width,
    height,
    batch_count: count,
    seed,
    clip_skip: clampInt(f.clip, 1, 12, 2),
    sample_params: {
      scheduler: f.scheduler.trim() || "default",
      sample_method: f.method.trim() || "euler",
      sample_steps: steps,
      guidance: { txt_cfg: cfg }
    },
    lora: f.loras
      .filter(l => l.path.trim())
      .map(l => ({ path: l.path.trim(), multiplier: numVal(l.mult, 1), is_high_noise: false })),
    output_format: "png"
  };
  return { body, clamped: { width, height, count, steps } };
}

export interface B64Image {
  b64_json?: string;
  [k: string]: unknown;
}

export interface JobResult {
  images?: B64Image[];
  output_format?: string;
  [k: string]: unknown;
}

export interface Job {
  status?: string;
  result?: JobResult;
  error?: string;
  id?: string | number;
  job_id?: string | number;
  [k: string]: unknown;
}

export async function apiFetch(url: string, options?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (e) {
    throw new Error("could not connect to the server: " + (e as Error).message);
  }
  let data: unknown = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const d = data as { error?: string; message?: string } | null;
    const msg = (d && (d.error || d.message)) || "HTTP " + res.status;
    throw new Error(msg);
  }
  return data;
}

function nameList(res: PromiseSettledResult<unknown>): string[] {
  if (res.status !== "fulfilled" || !Array.isArray(res.value)) return [];
  return res.value
    .map(x => (x as { name?: unknown } | null)?.name)
    .filter((n): n is string => typeof n === "string" && n.length > 0);
}

function loraList(res: PromiseSettledResult<unknown>): LoraInfo[] {
  if (res.status !== "fulfilled" || !Array.isArray(res.value)) return [];
  return res.value
    .filter((x): x is LoraInfo => !!x && typeof (x as LoraInfo).path === "string")
    .map(x => ({ name: typeof x.name === "string" ? x.name : x.path, path: x.path }));
}

export interface GenCatalog {
  samplers: string[];
  schedulers: string[];
  loras: LoraInfo[];
  error: string | null;
}

export async function fetchGenCatalog(base: string): Promise<GenCatalog> {
  const b = base.replace(/\/+$/, "");
  const [samplersRes, schedulersRes, lorasRes] = await Promise.allSettled([
    apiFetch(b + "/sdapi/v1/samplers"),
    apiFetch(b + "/sdapi/v1/schedulers"),
    apiFetch(b + "/sdapi/v1/loras")
  ]);
  const samplers = nameList(samplersRes);
  const schedulers = nameList(schedulersRes);
  const loras = loraList(lorasRes);
  const errors: string[] = [];
  if (samplersRes.status === "rejected") errors.push("samplers: " + (samplersRes.reason as Error).message);
  if (schedulersRes.status === "rejected") errors.push("schedulers: " + (schedulersRes.reason as Error).message);
  if (lorasRes.status === "rejected") errors.push("loras: " + (lorasRes.reason as Error).message);
  return { samplers, schedulers, loras, error: errors.length ? errors.join("; ") : null };
}

export class JobCancelledError extends Error {
  constructor() {
    super("job cancelled");
    this.name = "JobCancelledError";
  }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function waitForJob(base: string, job: Job | string): Promise<JobResult> {
  if (typeof job === "object" && job.status === "completed" && job.result) return job.result;
  const id = typeof job === "string" ? job : job.id;
  const start = Date.now();
  for (;;) {
    const current = (await apiFetch(base + "/sdcpp/v1/jobs/" + id)) as Job;
    if (current.status === "completed") return current.result as JobResult;
    if (current.status === "failed") throw new Error("job failed: " + (current.error || "unknown"));
    if (current.status === "cancelled") throw new JobCancelledError();
    if (Date.now() - start > 600000) throw new Error("wait timeout (10 min), status: " + current.status);
    await sleep(2000);
  }
}

export async function cancelJob(base: string, id: string | number): Promise<void> {
  try {
    await apiFetch(base + "/sdcpp/v1/jobs/" + id + "/cancel", { method: "POST" });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "HTTP 404" || msg === "HTTP 410") return;
    throw e;
  }
}

export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not decode the image"));
    img.src = dataUrl;
  });
}
