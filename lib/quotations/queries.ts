"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchDescriptions, fetchOptions, fetchSeries, fetchSystems } from "@/lib/quotations/api";

export function useSystemsQuery() {
  return useQuery({
    queryKey: ["quotation-systems"],
    queryFn: fetchSystems
  });
}

export function useSeriesQuery(systemType: string) {
  return useQuery({
    queryKey: ["quotation-series", systemType],
    queryFn: () => fetchSeries(systemType),
    enabled: Boolean(systemType)
  });
}

export function useDescriptionsQuery(systemType: string, series: string) {
  return useQuery({
    queryKey: ["quotation-descriptions", systemType, series],
    queryFn: () => fetchDescriptions(systemType, series),
    enabled: Boolean(systemType && series)
  });
}

export function useOptionsQuery(systemType: string) {
  return useQuery({
    queryKey: ["quotation-options", systemType],
    queryFn: () => fetchOptions(systemType),
    enabled: Boolean(systemType)
  });
}
