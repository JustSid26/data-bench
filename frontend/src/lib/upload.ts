import { ApiError } from "./api";
import type { Loaded } from "./types";

/** `api.upload` over XMLHttpRequest instead of fetch, for one reason: fetch
 *  cannot report upload progress. Same endpoint, same body, same errors. */
export function uploadWithProgress(file: File, onProgress: (fraction: number) => void, signal?: AbortSignal) {
  return new Promise<Loaded>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/datasets");
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.upload.onload = () => onProgress(1);
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) return resolve(request.response as Loaded);
      // FastAPI puts the readable message in `detail`; 422 nests it in a list
      const detail = request.response?.detail;
      const message = typeof detail === "string" ? detail : Array.isArray(detail) ? detail[0]?.msg : request.statusText;
      reject(new ApiError(message || `upload failed (${request.status})`));
    };
    request.onerror = () => reject(new ApiError("network error -- is the api running?"));
    request.onabort = () => reject(new ApiError("upload cancelled"));
    signal?.addEventListener("abort", () => request.abort());
    const form = new FormData();
    form.append("file", file);
    request.send(form);
  });
}
