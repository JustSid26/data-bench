import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/** The profile for the open dataset. One query key everywhere, so every screen
 *  and the pipeline indicator share the same cached result. */
export function useProfile(datasetId: string | undefined) {
  return useQuery({
    queryKey: ["profile", datasetId],
    queryFn: () => api.profile(datasetId!),
    enabled: Boolean(datasetId),
  });
}

export function usePlan(datasetId: string | undefined, target: string | null) {
  return useQuery({
    queryKey: ["plan", datasetId, target],
    queryFn: () => api.plan(datasetId!, target),
    enabled: Boolean(datasetId),
  });
}
