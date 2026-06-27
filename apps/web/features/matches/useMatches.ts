import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/features/queryKeys";

export function useOutgoing<T = unknown>() {
  return useQuery<{ items: T[] }>({
    queryKey: qk.outgoing(),
    queryFn: () => api.get("/matches/outgoing?limit=50").then((r) => r.data),
  });
}

export function useMatched<T = unknown>() {
  return useQuery<{ items: T[] }>({
    queryKey: qk.matched(),
    queryFn: () => api.get("/matches/mutual?limit=50").then((r) => r.data),
  });
}
