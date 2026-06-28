"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useReport() {
  return useMutation({
    mutationFn: (body: {
      reported_id: string;
      listing_id?: string;
      reason: string;
    }) => api.post("/reports", body),
  });
}
