"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";

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

// Share lookup data between dropdowns, rate calculation, and item serialization.
// A short freshness window avoids repeated requests while still refreshing catalog rates.
export function descriptionsQueryOptions(systemType: string, series: string) {
  return queryOptions({
    queryKey: ["quotation-descriptions", systemType, series],
    queryFn: () => fetchDescriptions(systemType, series),
    staleTime: 60_000,
  });
}

export function optionsQueryOptions(systemType: string) {
  return queryOptions({
    queryKey: ["quotation-options", systemType],
    queryFn: () => fetchOptions(systemType),
    staleTime: 60_000,
  });
}

export function useDescriptionsQuery(systemType: string, series: string) {
  return useQuery({
    ...descriptionsQueryOptions(systemType, series),
    enabled: Boolean(systemType)
  });
}

export function useOptionsQuery(systemType: string) {
  return useQuery({
    ...optionsQueryOptions(systemType),
    enabled: Boolean(systemType)
  });
}
