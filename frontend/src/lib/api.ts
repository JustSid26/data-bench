import type { Job, Loaded, Meta, Plan, Preview, Profile } from "./types";

const BASE = "/api";

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(BASE + path, init);
  if (!response.ok) {
    // FastAPI puts the readable message in `detail`; 422 nests it in a list
    let message = response.statusText;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail[0]?.msg ?? message;
    } catch {
      /* body was not json, keep the status text */
    }
    throw new ApiError(message);
  }
  return response.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  health: () => request<{ ok: boolean; datasets: number }>("/health"),

  list: () => request<{ datasets: (Meta & { id: string; created: number })[] }>("/datasets"),

  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Loaded>("/datasets", { method: "POST", body: form });
  },

  fromPath: (path: string) => request<Loaded>("/datasets/from-path", json({ path })),

  describe: (id: string) => request<Omit<Loaded, "preview">>(`/datasets/${id}`),

  preview: (id: string, rows = 50) => request<Preview>(`/datasets/${id}/preview?rows=${rows}`),

  profile: (id: string) => request<Profile>(`/datasets/${id}/profile`),

  plan: (id: string, target: string | null) =>
    request<Plan>(`/datasets/${id}/plan${target ? `?target=${encodeURIComponent(target)}` : ""}`),

  train: (id: string, body: { target: string | null; algorithms?: string[]; max_rows?: number }) =>
    request<{ job: string; state: string; plan: Plan }>(`/datasets/${id}/train`, json(body)),

  job: (jobId: string) => request<Job>(`/jobs/${jobId}`),

  forget: (id: string) => request<{ removed: string }>(`/datasets/${id}`, { method: "DELETE" }),
};
