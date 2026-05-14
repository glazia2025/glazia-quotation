"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import axios, { AxiosError } from "axios";
import { Plus, Save, Search } from "lucide-react";
import { QUOTATION_API_BASE_URL } from "@/services/api";
import { defaultSettingsSection } from "@/modules/settings/constants";
import { loadGlobalConfig, saveGlobalConfig } from "../../../utils/globalConfig";
import { getAuthToken } from "@/utils/auth-cookie";

type RateRow = {
  id: string;
  systemType?: string;
  name: string;
  unit: string;
  code: string;
  rate: number;
  rates: number[];
  colors?: ColorRate[];
  canDelete?: boolean;
};

type ColorRate = {
  name: string;
  rate: number;
};

type OptionSetType = "meshType" | "glassSpec" | "colorFinish" | "handle";
type RateSectionType = OptionSetType;
type FlatRateSectionType = Exclude<RateSectionType, "handle">;
type GroupedRows = Record<string, RateRow[]>;
type NewItemDraft = { name: string; rate: string };
type NewHardwareDraft = { name: string; blackRate: string; silverRate: string };
type NewHardwareDrafts = Record<string, NewHardwareDraft>;

const SETTINGS_PREFIXES = [
   process.env.NEXT_PUBLIC_QUOTATION_SETTINGS_PATH,
   "/api/user/quotation-data",
  "",
].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value as string) === index);

const settingsApi = axios.create({
  baseURL: QUOTATION_API_BASE_URL,
  withCredentials: true,
});

function getSettingsAuthToken(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem("adminToken") || getAuthToken() || "";
}


function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const candidateKeys = ["items", "data", "rows", "results", "rates", "descriptionRates", "hardware", "optionSets"];

    for (const key of candidateKeys) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[];
      }
    }
  }

  return [];
}

function normalizeRateRow(item: unknown): RateRow {
  const raw = (item ?? {}) as Record<string, unknown>;
  const rawColors = raw.colors;
  const colors: ColorRate[] = Array.isArray(rawColors)
    ? rawColors.map((entry) => {
        const record = (entry ?? {}) as Record<string, unknown>;
        return { name: asString(record.name), rate: asNumber(record.rate) };
      }).filter((entry) => entry.name)
    : rawColors && typeof rawColors === "object"
      ? Object.entries(rawColors as Record<string, unknown>).map(([name, rate]) => ({ name, rate: asNumber(rate) }))
      : [];
  const rawRatesArray = Array.isArray(raw.rates)
    ? (raw.rates as unknown[]).map((entry) => asNumber(entry)).filter((entry) => Number.isFinite(entry))
    : Array.isArray(raw.adminRates)
      ? (raw.adminRates as unknown[]).map((entry) => asNumber(entry)).filter((entry) => Number.isFinite(entry))
      : [];
  const id =
    asString(raw.id) ||
    asString(raw._id) ||
    asString(raw.name) ||
    asString(raw.description) ||
    asString(raw.particular) ||
    asString(raw.itemName);

  return {
    id,
    systemType: asString(raw.systemType),
    name:
      asString(raw.name) ||
      asString(raw.description) ||
      asString(raw.particular) ||
      asString(raw.itemName) ||
      "-",
    code: asString(raw.sapCode) || asString(raw.code) || [asString(raw.systemType), asString(raw.series)].filter(Boolean).join(" / "),
    unit: asString(raw.unit) || asString(raw.per),
    rate: rawRatesArray.length > 0 ? rawRatesArray[0] : asNumber(raw.rate ?? raw.price ?? raw.baseRate),
    rates: rawRatesArray,
    colors,
    canDelete: raw.canDelete === true,
  };
}

function extractOptionSetItems(items: unknown): RateRow[] {
  if (Array.isArray(items)) {
    return items.map(normalizeRateRow);
  }

  if (items && typeof items === "object") {
    const values = Object.values(items as Record<string, unknown>);
    return values.flatMap((value) => (Array.isArray(value) ? value.map(normalizeRateRow) : []));
  }

  return [];
}

function normalizeHandleRowsBySystem(items: unknown): GroupedRows {
  if (!items || typeof items !== "object" || Array.isArray(items)) {
    return {};
  }

  const rowsBySystem: GroupedRows = {};
  Object.entries(items as Record<string, unknown>).forEach(([system, rawRows]) => {
    if (!Array.isArray(rawRows)) {
      return;
    }

    rowsBySystem[system] = rawRows.map((item) => {
      const row = normalizeRateRow(item);
      return {
        ...row,
        id: row.id || `${system}::${row.name}`,
      };
    });
  });

  return rowsBySystem;
}

function formatSystemLabel(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeOptionSetRows(data: unknown): { meshType: RateRow[]; glassSpec: RateRow[]; colorFinish: RateRow[]; handle: GroupedRows } {
  const sets = extractArray(data);

  const byType: { meshType: RateRow[]; glassSpec: RateRow[]; colorFinish: RateRow[]; handle: GroupedRows } = {
    meshType: [],
    glassSpec: [],
    colorFinish: [],
    handle: {},
  };

  sets.forEach((setItem) => {
    const setRecord = (setItem ?? {}) as Record<string, unknown>;
    const rawType = asString(setRecord.type).trim();
    const typeMap: Record<string, OptionSetType> = {
      meshType: "meshType",
      meshtype: "meshType",
      glassSpec: "glassSpec",
      glassspec: "glassSpec",
      colorFinish: "colorFinish",
      colorfinish: "colorFinish",
      handle: "handle",
    };
    const type = typeMap[rawType] ?? typeMap[rawType.toLowerCase()];

    if (!type) {
      return;
    }

    if (type === "handle") {
      byType.handle = normalizeHandleRowsBySystem(setRecord.items);
      return;
    }

    const rows = extractOptionSetItems(setRecord.items);
    byType[type] = rows;
  });

  return byType;
}

async function requestWithFallback<T>(
  method: "get" | "post" | "put" | "delete",
  endpoint: string,
  payload?: unknown
): Promise<T> {
  let lastError: unknown;

  for (const prefix of SETTINGS_PREFIXES) {
    try {
      const path = `${prefix}${endpoint}`;
      const token = getSettingsAuthToken();
      const response = await settingsApi.request<T>({
        method,
        url: path,
        data: payload,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      if (status === 404) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error("Unable to reach quotation settings API.");
}

async function requestUserQuotationSettings<T>(
  method: "post" | "put" | "delete",
  endpoint: string,
  payload?: unknown
): Promise<T> {
  const token = getSettingsAuthToken();
  const response = await settingsApi.request<T>({
    method,
    url: `/api/user/quotation-data${endpoint}`,
    data: payload,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return response.data;
}

async function listDescriptionRates(): Promise<RateRow[]> {
  const data = await requestWithFallback<unknown>("get", "/description-rates");
  return extractArray(data).map(normalizeRateRow).filter((row) => row.id);
}

async function addDescriptionRate(payload: { name: string; rate: number; code?: string; unit?: string }) {
  return requestWithFallback("post", "/description-rates", payload);
}

async function setDescriptionRate(id: string, rates: number[]) {
  const safeRates = rates.slice(0, 3);
  while (safeRates.length < 3) {
    safeRates.push(safeRates[0] ?? 0);
  }

  return requestWithFallback("put", `/description-rates/${encodeURIComponent(id)}`, {
    rate: safeRates[0],
    rates: safeRates,
    adminRates: safeRates,
  });
}

async function listOptionSetRates() {
  const data = await requestWithFallback<unknown>("get", "/option-sets");
  return normalizeOptionSetRows(data);
}

async function addOptionSetItem(type: OptionSetType, payload: { name: string; rate: number; system?: string }) {
  return requestWithFallback("post", `/option-sets/${encodeURIComponent(type)}/items`, payload);
}

async function setOptionSetRate(type: OptionSetType, name: string, rate: number) {
  return requestWithFallback(
    "put",
    `/option-sets/${encodeURIComponent(type)}/admin-items/${encodeURIComponent(name)}/rate`,
    { rate }
  );
}

async function createHandleOption(payload: { systemType: string; name: string; colors: Record<string, number> }) {
  return requestUserQuotationSettings("post", "/handle-options", payload);
}

async function updateHandleOption(id: string, payload: { colors: Record<string, number> }) {
  return requestUserQuotationSettings("put", `/handle-options/${encodeURIComponent(id)}`, payload);
}

async function deleteHandleOption(id: string) {
  return requestUserQuotationSettings("delete", `/handle-options/${encodeURIComponent(id)}`);
}

type RateSectionProps = {
  title: string;
  rows: RateRow[];
  search: string;
  isLoading: boolean;
  isSaving: boolean;
  newName: string;
  newRate: string;
  onSearchChange: (value: string) => void;
  onNewNameChange: (value: string) => void;
  onNewRateChange: (value: string) => void;
  onRowRateChange: (id: string, rate: number) => void;
  onAdd: () => void;
  onSave: () => void;
  onReset: () => void;
};

function RateSection({
  title,
  rows,
  search,
  isLoading,
  isSaving,
  newName,
  newRate,
  onSearchChange,
  onNewNameChange,
  onNewRateChange,
  onRowRateChange,
  onAdd,
  onSave,
  onReset,
}: RateSectionProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[#124657]">{title}</h2>

      <div className="bg-gray-100 rounded-lg px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#124657] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto">
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={(e) => onNewNameChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#124657] focus:outline-none"
          />
          <input
            type="number"
            placeholder="Rate"
            value={newRate}
            onChange={(e) => onNewRateChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#124657] focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={onAdd}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 border border-[#124657] text-[#124657] px-4 py-2 rounded-md text-sm hover:bg-[#124657] hover:text-white transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">Item Name</th>
              <th className="px-4 py-3 text-left">Price Level</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={2} className="px-4 py-4 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            )}

            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-4 text-center text-gray-500">
                  No items found.
                </td>
              </tr>
            )}

            {!isLoading &&
              rows.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) => onRowRateChange(item.id, asNumber(e.target.value))}
                      className="w-28 px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#124657] focus:outline-none"
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end items-center gap-4 pt-4">
        <button type="button" onClick={onReset} className="text-gray-600 text-sm hover:text-[#124657]">
          Reset
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || isLoading}
          className="bg-[#124657] text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

type HardwareSectionProps = {
  groupedRows: GroupedRows;
  search: string;
  isLoading: boolean;
  isSaving: boolean;
  newItems: NewHardwareDrafts;
  onSearchChange: (value: string) => void;
  onNewNameChange: (system: string, value: string) => void;
  onNewBlackRateChange: (system: string, value: string) => void;
  onNewSilverRateChange: (system: string, value: string) => void;
  onAdd: (system: string) => void;
  onRowColorRateChange: (system: string, id: string, color: string, rate: number) => void;
  onDelete: (system: string, id: string) => void;
  onSave: () => void;
  onReset: () => void;
};

function HardwareSection({
  groupedRows,
  search,
  isLoading,
  isSaving,
  newItems,
  onSearchChange,
  onNewNameChange,
  onNewBlackRateChange,
  onNewSilverRateChange,
  onAdd,
  onRowColorRateChange,
  onDelete,
  onSave,
  onReset,
}: HardwareSectionProps) {
  const systems = Object.entries(groupedRows);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[#124657]">Hardware</h2>

      <div className="bg-gray-100 rounded-lg px-4 py-3 flex justify-end">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#124657] focus:outline-none"
          />
        </div>
      </div>

      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-6 text-center text-gray-500">Loading...</div>
      )}

      {!isLoading && systems.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-6 text-center text-gray-500">
          No hardware items found.
        </div>
      )}

      {!isLoading &&
        systems.map(([system, rows]) => (
          <div key={system} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-base font-semibold text-[#124657]">{formatSystemLabel(system)}</h3>
            </div>

            <div className="px-4 py-3 border-b border-gray-100 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_140px_140px_auto] gap-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={newItems[system]?.name || ""}
                  onChange={(e) => onNewNameChange(system, e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#124657] focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Black rate"
                  value={newItems[system]?.blackRate || ""}
                  onChange={(e) => onNewBlackRateChange(system, e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#124657] focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Silver rate"
                  value={newItems[system]?.silverRate || ""}
                  onChange={(e) => onNewSilverRateChange(system, e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#124657] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => onAdd(system)}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 border border-[#124657] text-[#124657] px-4 py-2 rounded-md text-sm hover:bg-[#124657] hover:text-white transition disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">Handle Name</th>
                  <th className="px-4 py-3 text-left">Colour Rates</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-gray-500">
                      No items found.
                    </td>
                  </tr>
                )}
                {rows.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{item.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3">
                        {(item.colors?.length ? item.colors : [{ name: "Black", rate: 0 }, { name: "Silver", rate: 0 }]).map((color) => (
                          <label key={`${item.id}-${color.name}`} className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="min-w-12">{color.name}</span>
                            <input
                              type="number"
                              value={color.rate}
                              onChange={(e) => onRowColorRateChange(system, item.id, color.name, asNumber(e.target.value))}
                              className="w-28 px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#124657] focus:outline-none"
                            />
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.canDelete ? (
                        <button
                          type="button"
                          onClick={() => onDelete(system, item.id)}
                          disabled={isSaving}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Admin item</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      <div className="flex justify-end items-center gap-4 pt-4">
        <button type="button" onClick={onReset} className="text-gray-600 text-sm hover:text-[#124657]">
          Reset
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || isLoading}
          className="bg-[#124657] text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

type ProfileRateSectionProps = {
  rows: RateRow[];
  search: string;
  isLoading: boolean;
  isSaving: boolean;
  onSearchChange: (value: string) => void;
  onRateChange: (id: string, index: number, value: number) => void;
  onSave: () => void;
  onReset: () => void;
};

function ProfileRateSection({
  rows,
  search,
  isLoading,
  isSaving,
  onSearchChange,
  onRateChange,
  onSave,
  onReset,
}: ProfileRateSectionProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[#124657]">Profile Rate</h2>

      <div className="bg-gray-100 rounded-lg px-4 py-3 flex justify-end">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#124657] focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">System / Series</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">0-10 sqft</th>
              <th className="px-4 py-3 text-left">10-20 sqft</th>
              <th className="px-4 py-3 text-left">+20 sqft</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            )}

            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                  No profile rates found.
                </td>
              </tr>
            )}

            {!isLoading &&
              rows.map((row) => {
                const rates = row.rates.length > 0 ? row.rates : [row.rate, row.rate, row.rate];
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{row.code || "-"}</td>
                    <td className="px-4 py-3">{row.name}</td>
                    {[0, 1, 2].map((index) => (
                      <td key={`${row.id}-${index}`} className="px-4 py-3">
                        <input
                          type="number"
                          value={rates[index] ?? 0}
                          onChange={(e) => onRateChange(row.id, index, asNumber(e.target.value))}
                          className="w-28 px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#124657] focus:outline-none"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end items-center gap-4 pt-4">
        <button type="button" onClick={onReset} className="text-gray-600 text-sm hover:text-[#124657]">
          Reset
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || isLoading}
          className="bg-[#124657] text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

export default function QuotationSettingsPage() {
  const [config, setConfig] = useState<any>({});
  const [status, setStatus] = useState<string>("");
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("section") || defaultSettingsSection;

  const [profileSearch, setProfileSearch] = useState("");
  const [meshSearch, setMeshSearch] = useState("");
  const [glassSearch, setGlassSearch] = useState("");
  const [colorFinishSearch, setColorFinishSearch] = useState("");
  const [hardwareSearch, setHardwareSearch] = useState("");

  const [profileRows, setProfileRows] = useState<RateRow[]>([]);
  const [meshRows, setMeshRows] = useState<RateRow[]>([]);
  const [glassRows, setGlassRows] = useState<RateRow[]>([]);
  const [colorFinishRows, setColorFinishRows] = useState<RateRow[]>([]);
  const [hardwareRows, setHardwareRows] = useState<GroupedRows>({});

  const [initialProfileRows, setInitialProfileRows] = useState<RateRow[]>([]);
  const [initialMeshRows, setInitialMeshRows] = useState<RateRow[]>([]);
  const [initialGlassRows, setInitialGlassRows] = useState<RateRow[]>([]);
  const [initialColorFinishRows, setInitialColorFinishRows] = useState<RateRow[]>([]);
  const [initialHardwareRows, setInitialHardwareRows] = useState<GroupedRows>({});

  const [newMesh, setNewMesh] = useState({ name: "", code: "", unit: "", rate: "" });
  const [newGlass, setNewGlass] = useState({ name: "", code: "", unit: "", rate: "" });
  const [newColorFinish, setNewColorFinish] = useState({ name: "", code: "", unit: "", rate: "" });
  const [newHardwareBySystem, setNewHardwareBySystem] = useState<NewHardwareDrafts>({});

  const [isRatesLoading, setIsRatesLoading] = useState(false);
  const [isRatesSaving, setIsRatesSaving] = useState(false);

  const fetchData = async () => {
    const globalConfig = await loadGlobalConfig();
    if (globalConfig) {
      setConfig(globalConfig);
    }
  };

  const fetchRates = async () => {
    setIsRatesLoading(true);
    try {
      const [descriptions, optionSets] = await Promise.all([
        listDescriptionRates(),
        listOptionSetRates(),
      ]);

      setProfileRows(descriptions);
      setInitialProfileRows(descriptions);

      setMeshRows(optionSets.meshType);
      setInitialMeshRows(optionSets.meshType);

      setGlassRows(optionSets.glassSpec);
      setInitialGlassRows(optionSets.glassSpec);

      setColorFinishRows(optionSets.colorFinish);
      setInitialColorFinishRows(optionSets.colorFinish);

      setHardwareRows(optionSets.handle);
      setInitialHardwareRows(optionSets.handle);
    } catch (error) {
      const message =
        (error as AxiosError<{ message?: string }>)?.response?.data?.message ||
        (error as Error).message ||
        "Failed to load quotation settings.";
      setStatus(message);
    } finally {
      setIsRatesLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    void fetchRates();
  }, []);

  const handleSave = () => {
    saveGlobalConfig(config);
    setStatus("Saved.");
    window.setTimeout(() => setStatus(""), 2000);
  };

  const handleLogoUpload = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setConfig((prev: any) => ({ ...prev, logoUrl: result, logo: result }));
    };
    reader.readAsDataURL(file);
  };

  const filteredProfiles = useMemo(
    () => profileRows.filter((item) => item.name.toLowerCase().includes(profileSearch.toLowerCase())),
    [profileRows, profileSearch]
  );

  const filteredMesh = useMemo(
    () => meshRows.filter((item) => item.name.toLowerCase().includes(meshSearch.toLowerCase())),
    [meshRows, meshSearch]
  );

  const filteredGlass = useMemo(
    () => glassRows.filter((item) => item.name.toLowerCase().includes(glassSearch.toLowerCase())),
    [glassRows, glassSearch]
  );

  const filteredColorFinish = useMemo(
    () => colorFinishRows.filter((item) => item.name.toLowerCase().includes(colorFinishSearch.toLowerCase())),
    [colorFinishRows, colorFinishSearch]
  );

  const filteredHardware = useMemo(() => {
    const query = hardwareSearch.toLowerCase().trim();
    if (!query) {
      return hardwareRows;
    }

    return Object.entries(hardwareRows).reduce<GroupedRows>((acc, [system, rows]) => {
      const filtered = rows.filter((item) => item.name.toLowerCase().includes(query));
      if (filtered.length > 0) {
        acc[system] = filtered;
      }
      return acc;
    }, {});
  }, [hardwareRows, hardwareSearch]);

  const updateProfileRateValue = (id: string, index: number, value: number) => {
    setProfileRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) {
          return row;
        }

        const nextRates = row.rates.length > 0 ? [...row.rates] : [row.rate, row.rate, row.rate];
        nextRates[index] = value;
        return { ...row, rates: nextRates, rate: nextRates[0] ?? 0 };
      })
    );
  };

  const updateRowRate = (type: RateSectionType, id: string, rate: number) => {
    const updater = (rows: RateRow[]) => rows.map((row) => (row.id === id ? { ...row, rate } : row));

    if (type === "meshType") {
      setMeshRows((prev) => updater(prev));
      return;
    }
    if (type === "glassSpec") {
      setGlassRows((prev) => updater(prev));
      return;
    }
    setColorFinishRows((prev) => updater(prev));
  };

  const updateHardwareRate = (system: string, id: string, rate: number) => {
    setHardwareRows((prev) => ({
      ...prev,
      [system]: (prev[system] || []).map((row) => (row.id === id ? { ...row, rate } : row)),
    }));
  };

  const updateNewHardwareDraft = (system: string, field: keyof NewHardwareDraft, value: string) => {
    setNewHardwareBySystem((prev) => ({
      ...prev,
      [system]: {
        name: prev[system]?.name || "",
        blackRate: prev[system]?.blackRate || "",
        silverRate: prev[system]?.silverRate || "",
        [field]: value,
      },
    }));
  };

  const addHardwareItem = async (system: string) => {
    const draft = newHardwareBySystem[system] || { name: "", blackRate: "", silverRate: "" };
    const name = draft.name.trim();
    const systemType = hardwareRows[system]?.[0]?.systemType || formatSystemLabel(system);

    if (!name) {
      setStatus("Name is required.");
      return;
    }

    setIsRatesSaving(true);
    try {
      await createHandleOption({
        systemType,
        name,
        colors: {
          Black: asNumber(draft.blackRate),
          Silver: asNumber(draft.silverRate),
        },
      });
      await fetchRates();
      setNewHardwareBySystem((prev) => ({
        ...prev,
        [system]: { name: "", blackRate: "", silverRate: "" },
      }));
      setStatus("Item added.");
    } catch (error) {
      const message =
        (error as AxiosError<{ message?: string }>)?.response?.data?.message ||
        (error as Error).message ||
        "Failed to add item.";
      setStatus(message);
    } finally {
      setIsRatesSaving(false);
      window.setTimeout(() => setStatus(""), 2200);
    }
  };

  const deleteHardwareItem = async (system: string, id: string) => {
    const row = hardwareRows[system]?.find((item) => item.id === id);
    if (!row?.canDelete) return;

    setIsRatesSaving(true);
    try {
      await deleteHandleOption(id);
      await fetchRates();
      setStatus("Item deleted.");
    } catch (error) {
      const message =
        (error as AxiosError<{ message?: string }>)?.response?.data?.message ||
        (error as Error).message ||
        "Failed to delete item.";
      setStatus(message);
    } finally {
      setIsRatesSaving(false);
      window.setTimeout(() => setStatus(""), 2200);
    }
  };

  const addItem = async (type: FlatRateSectionType) => {
    const source =
      type === "meshType"
        ? newMesh
        : type === "glassSpec"
          ? newGlass
          : newColorFinish;

    const name = source.name.trim();
    const rate = asNumber(source.rate);

    if (!name) {
      setStatus("Name is required.");
      return;
    }

    setIsRatesSaving(true);
    try {
      if (type === "meshType") {
        await addOptionSetItem("meshType", { name, rate });
        setNewMesh({ name: "", code: "", unit: "", rate: "" });
      } else if (type === "glassSpec") {
        await addOptionSetItem("glassSpec", { name, rate });
        setNewGlass({ name: "", code: "", unit: "", rate: "" });
      } else {
        await addOptionSetItem("colorFinish", { name, rate });
        setNewColorFinish({ name: "", code: "", unit: "", rate: "" });
      }

      await fetchRates();
      setStatus("Item added.");
    } catch (error) {
      const message =
        (error as AxiosError<{ message?: string }>)?.response?.data?.message ||
        (error as Error).message ||
        "Failed to add item.";
      setStatus(message);
    } finally {
      setIsRatesSaving(false);
      window.setTimeout(() => setStatus(""), 2200);
    }
  };

  const saveProfileRates = async () => {
    setIsRatesSaving(true);
    try {
      await Promise.all(
        profileRows.map((row) => setDescriptionRate(row.id, row.rates.length > 0 ? row.rates : [row.rate, row.rate, row.rate]))
      );

      await fetchRates();
      setStatus("Profile rates updated.");
    } catch (error) {
      const message =
        (error as AxiosError<{ message?: string }>)?.response?.data?.message ||
        (error as Error).message ||
        "Failed to update profile rates.";
      setStatus(message);
    } finally {
      setIsRatesSaving(false);
      window.setTimeout(() => setStatus(""), 2200);
    }
  };

  const saveSectionRates = async (type: RateSectionType) => {
    if (type === "handle") {
      setIsRatesSaving(true);
      try {
        const allHandleRows = Object.values(hardwareRows).flat();
        await Promise.all(
          allHandleRows.map((row) =>
            updateHandleOption(
              row.id,
              { colors: Object.fromEntries((row.colors ?? []).map((color) => [color.name, color.rate])) }
            )
          )
        );
        await fetchRates();
        setStatus("Rates updated.");
      } catch (error) {
        const message =
          (error as AxiosError<{ message?: string }>)?.response?.data?.message ||
          (error as Error).message ||
          "Failed to update rates.";
        setStatus(message);
      } finally {
        setIsRatesSaving(false);
        window.setTimeout(() => setStatus(""), 2200);
      }
      return;
    }

    const rows =
      type === "meshType"
        ? meshRows
        : type === "glassSpec"
          ? glassRows
          : colorFinishRows;

    setIsRatesSaving(true);
    try {
      await Promise.all(rows.map((row) => setOptionSetRate(type, row.name, row.rate)));

      await fetchRates();
      setStatus("Rates updated.");
    } catch (error) {
      const message =
        (error as AxiosError<{ message?: string }>)?.response?.data?.message ||
        (error as Error).message ||
        "Failed to update rates.";
      setStatus(message);
    } finally {
      setIsRatesSaving(false);
      window.setTimeout(() => setStatus(""), 2200);
    }
  };

  const resetProfileRates = () => {
    setProfileRows(initialProfileRows);
  };

  const resetSectionRates = (type: RateSectionType) => {
    if (type === "meshType") {
      setMeshRows(initialMeshRows);
      return;
    }
    if (type === "glassSpec") {
      setGlassRows(initialGlassRows);
      return;
    }
    if (type === "handle") {
      setHardwareRows(initialHardwareRows);
      return;
    }
    setColorFinishRows(initialColorFinishRows);
  };

  const updateHardwareColorRate = (system: string, id: string, colorName: string, rate: number) => {
    setHardwareRows((prev) => ({
      ...prev,
      [system]: (prev[system] || []).map((row) => {
        if (row.id !== id) {
          return row;
        }

        const existingColors = row.colors?.length ? row.colors : [{ name: "Black", rate: 0 }, { name: "Silver", rate: 0 }];
        const hasColor = existingColors.some((color) => color.name === colorName);
        const colors = hasColor
          ? existingColors.map((color) => (color.name === colorName ? { ...color, rate } : color))
          : [...existingColors, { name: colorName, rate }];

        return { ...row, colors };
      }),
    }));
  };

  const logoPreview = config?.logoUrl || config?.logo || "";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-4 pb-8">
        <div className="space-y-8">
          {activeTab === "profileStructure" && (
              <>
                <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-[#124657]">Quotation Structure</h1>
                    <p className="mt-1 text-sm text-gray-500">Save branding, legal terms, and quotation cost defaults.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    {status ? <span className="text-sm text-green-600">{status}</span> : null}
                    <button
                      type="button"
                      onClick={handleSave}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#124657] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b3642]"
                    >
                      <Save className="h-4 w-4" />
                      <span>Save Settings</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Branding</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Logo Image</label>

                      {logoPreview && (
                        <div className="mb-4 flex items-center gap-4">
                          <img
                            src={logoPreview}
                            alt="Logo preview"
                            className="h-16 w-auto rounded border border-gray-200 bg-white p-2"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setConfig((prev: any) => ({
                                ...prev,
                                logoUrl: "",
                                logo: "",
                              }))
                            }
                            className="text-sm font-medium text-red-600 hover:text-red-700"
                          >
                            Remove logo
                          </button>
                        </div>
                      )}

                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#124657] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                      <input
                        type="text"
                        value={config?.website || ""}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, website: e.target.value }))}
                        placeholder="www.example.com"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#124657] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Legal</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Terms & Conditions</label>
                      <textarea
                        value={config?.terms}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, terms: e.target.value }))}
                        rows={6}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#124657] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Prerequisites of Installation</label>
                      <textarea
                        value={config?.prerequisites}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, prerequisites: e.target.value }))}
                        rows={6}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#124657] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Additional Costs</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Installation (₹/sqft)</label>
                      <input
                        type="number"
                        value={config?.additionalCosts?.installation}
                        onChange={(e) =>
                          setConfig((prev: any) => ({
                            ...prev,
                            additionalCosts: {
                              ...prev.additionalCosts,
                              installation: Number(e.target.value) || 0,
                            },
                          }))
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#124657] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Transport (₹)</label>
                      <input
                        type="number"
                        value={config?.additionalCosts?.transport}
                        onChange={(e) =>
                          setConfig((prev: any) => ({
                            ...prev,
                            additionalCosts: {
                              ...prev.additionalCosts,
                              transport: Number(e.target.value) || 0,
                            },
                          }))
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#124657] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Loading & Unloading (₹)</label>
                      <input
                        type="number"
                        value={config?.additionalCosts?.loadingUnloading}
                        onChange={(e) =>
                          setConfig((prev: any) => ({
                            ...prev,
                            additionalCosts: {
                              ...prev.additionalCosts,
                              loadingUnloading: Number(e.target.value) || 0,
                            },
                          }))
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#124657] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Discount (%)</label>
                      <input
                        type="number"
                        value={config?.additionalCosts?.discountPercent}
                        onChange={(e) =>
                          setConfig((prev: any) => ({
                            ...prev,
                            additionalCosts: {
                              ...prev.additionalCosts,
                              discountPercent: Number(e.target.value) || 0,
                            },
                          }))
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#124657] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </>
          )}

          {activeTab === "profileRate" && (
            <ProfileRateSection
              rows={filteredProfiles}
              search={profileSearch}
              isLoading={isRatesLoading}
              isSaving={isRatesSaving}
              onSearchChange={setProfileSearch}
              onRateChange={updateProfileRateValue}
              onSave={() => void saveProfileRates()}
              onReset={resetProfileRates}
            />
          )}

          {activeTab === "meshRate" && (
            <RateSection
              title="Mesh Rate"
              rows={filteredMesh}
              search={meshSearch}
              isLoading={isRatesLoading}
              isSaving={isRatesSaving}
              newName={newMesh.name}
              newRate={newMesh.rate}
              onSearchChange={setMeshSearch}
              onNewNameChange={(value) => setNewMesh((prev) => ({ ...prev, name: value }))}
              onNewRateChange={(value) => setNewMesh((prev) => ({ ...prev, rate: value }))}
              onRowRateChange={(id, rate) => updateRowRate("meshType", id, rate)}
              onAdd={() => void addItem("meshType")}
              onSave={() => void saveSectionRates("meshType")}
              onReset={() => resetSectionRates("meshType")}
            />
          )}

          {activeTab === "glassRate" && (
            <RateSection
              title="Glass Rate"
              rows={filteredGlass}
              search={glassSearch}
              isLoading={isRatesLoading}
              isSaving={isRatesSaving}
              newName={newGlass.name}
              newRate={newGlass.rate}
              onSearchChange={setGlassSearch}
              onNewNameChange={(value) => setNewGlass((prev) => ({ ...prev, name: value }))}
              onNewRateChange={(value) => setNewGlass((prev) => ({ ...prev, rate: value }))}
              onRowRateChange={(id, rate) => updateRowRate("glassSpec", id, rate)}
              onAdd={() => void addItem("glassSpec")}
              onSave={() => void saveSectionRates("glassSpec")}
              onReset={() => resetSectionRates("glassSpec")}
            />
          )}

          {activeTab === "colorFinishRate" && (
            <RateSection
              title="Colour Finish Rate"
              rows={filteredColorFinish}
              search={colorFinishSearch}
              isLoading={isRatesLoading}
              isSaving={isRatesSaving}
              newName={newColorFinish.name}
              newRate={newColorFinish.rate}
              onSearchChange={setColorFinishSearch}
              onNewNameChange={(value) => setNewColorFinish((prev) => ({ ...prev, name: value }))}
              onNewRateChange={(value) => setNewColorFinish((prev) => ({ ...prev, rate: value }))}
              onRowRateChange={(id, rate) => updateRowRate("colorFinish", id, rate)}
              onAdd={() => void addItem("colorFinish")}
              onSave={() => void saveSectionRates("colorFinish")}
              onReset={() => resetSectionRates("colorFinish")}
            />
          )}

          {activeTab === "hardwareRate" && (
            <HardwareSection
              groupedRows={filteredHardware}
              search={hardwareSearch}
              isLoading={isRatesLoading}
              isSaving={isRatesSaving}
              newItems={newHardwareBySystem}
              onSearchChange={setHardwareSearch}
              onNewNameChange={(system, value) => updateNewHardwareDraft(system, "name", value)}
              onNewBlackRateChange={(system, value) => updateNewHardwareDraft(system, "blackRate", value)}
              onNewSilverRateChange={(system, value) => updateNewHardwareDraft(system, "silverRate", value)}
              onAdd={(system) => void addHardwareItem(system)}
              onRowColorRateChange={updateHardwareColorRate}
              onDelete={(system, id) => void deleteHardwareItem(system, id)}
              onSave={() => void saveSectionRates("handle")}
              onReset={() => resetSectionRates("handle")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
