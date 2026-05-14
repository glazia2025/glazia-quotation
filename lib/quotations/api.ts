import axios from "axios";

import { QUOTATION_API_BASE_URL } from "@/services/api";
import type { Description, HandleOption, OptionWithRate, OptionsResponse } from "@/lib/quotations/types";

type UnknownRecord = Record<string, unknown>;

const emptyOptions: OptionsResponse = {
  colorFinishes: [],
  meshTypes: [],
  glassSpecs: [],
  handleOptions: []
};

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNameRateList(value: unknown): OptionWithRate[] {
  return asArray(value)
    .map((entry) => {
      if (typeof entry === "string") {
        return { name: entry, rate: 0 };
      }

      const record = asRecord(entry);
      if (!record) return null;

      const name = record.name ?? record.label ?? record.value ?? record.finish ?? record.color ?? record.option;
      if (typeof name !== "string" || !name.trim()) return null;

      const rateValue = record.rate ?? record.price ?? record.amount ?? record.additionalRate ?? 0;
      const rate = typeof rateValue === "number" ? rateValue : Number(rateValue ?? 0);

      return {
        name,
        rate: Number.isFinite(rate) ? rate : 0
      };
    })
    .filter((entry): entry is OptionWithRate => Boolean(entry));
}

function toHandleOptions(value: unknown): HandleOption[] {
  return asArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return null;

      const name = record.name ?? record.label ?? record.handleType ?? record.option;
      if (typeof name !== "string" || !name.trim()) return null;

      const colors = toNameRateList(record.colors ?? record.handleColors ?? record.options ?? []);

      return { name, colors };
    })
    .filter((entry): entry is HandleOption => Boolean(entry));
}

function toDescriptions(value: unknown): Description[] {
  return asArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return null;

      const name = record.name ?? record.label ?? record.description;
      if (typeof name !== "string" || !name.trim()) return null;

      const baseRates = asArray(record.baseRates ?? record.rates ?? record.areaRates).map((rate) => Number(rate)).filter((rate) => Number.isFinite(rate));
      const defaultHandleCountRaw = record.defaultHandleCount ?? record.handleCount ?? 0;
      const defaultHandleCount = typeof defaultHandleCountRaw === "number" ? defaultHandleCountRaw : Number(defaultHandleCountRaw ?? 0);

      const normalized: Description = {
        name,
        baseRates,
        defaultHandleCount: Number.isFinite(defaultHandleCount) ? defaultHandleCount : 0
      };

      return normalized;
    })
    .filter((entry): entry is Description => entry !== null);
}

function unwrapData<T>(value: unknown, preferredKeys: string[]): T {
  const record = asRecord(value);
  if (!record) {
    return value as T;
  }

  for (const key of preferredKeys) {
    if (key in record) {
      return record[key] as T;
    }
  }

  if ("data" in record) {
    return record.data as T;
  }

  return value as T;
}

export async function fetchSystems() {
  const response = await axios.get(`${QUOTATION_API_BASE_URL}/api/quotations/systems`);
  const rawSystems = unwrapData<unknown>(response.data, ["systems"]);
  const systems = asArray(rawSystems)
    .map((entry) => {
      if (typeof entry === "string") return entry;
      const record = asRecord(entry);
      const value = record?.name ?? record?.label ?? record?.systemType ?? record?.value;
      return typeof value === "string" ? value : null;
    })
    .filter((entry): entry is string => Boolean(entry));

  return { systems };
}

export async function fetchSeries(systemType: string) {
  const response = await axios.get(`${QUOTATION_API_BASE_URL}/api/quotations/systems/${encodeURIComponent(systemType)}/series`);
  const rawSeries = unwrapData<unknown>(response.data, ["series"]);
  const series = asArray(rawSeries)
    .map((entry) => {
      if (typeof entry === "string") return entry;
      const record = asRecord(entry);
      const value = record?.name ?? record?.label ?? record?.series ?? record?.value;
      return typeof value === "string" ? value : null;
    })
    .filter((entry): entry is string => Boolean(entry));

  return { series };
}

export async function fetchDescriptions(systemType: string, series: string) {
  const response = await axios.get(
    `${QUOTATION_API_BASE_URL}/api/quotations/systems/${encodeURIComponent(systemType)}/series/${encodeURIComponent(series)}/descriptions`
  );
  const rawDescriptions = unwrapData<unknown>(response.data, ["descriptions"]);
  return { descriptions: toDescriptions(rawDescriptions) };
}

export async function fetchOptions(systemType: string) {
  const response = await axios.get(`${QUOTATION_API_BASE_URL}/api/quotations/options`, {
    params: systemType ? { systemType } : undefined
  });
  const rawOptions = unwrapData<unknown>(response.data, ["options"]);
  const record = asRecord(rawOptions);

  if (!record) {
    return emptyOptions;
  }

  return {
    colorFinishes: toNameRateList(record.colorFinishes ?? record.colours ?? record.colors ?? record.colorOptions ?? []),
    meshTypes: toNameRateList(record.meshTypes ?? record.meshOptions ?? []),
    glassSpecs: toNameRateList(record.glassSpecs ?? record.glassTypes ?? record.glassOptions ?? []),
    handleOptions: toHandleOptions(record.handleOptions ?? record.handles ?? [])
  };
}
