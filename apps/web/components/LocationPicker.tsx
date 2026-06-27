"use client";

import { useEffect, useState } from "react";
import { LOCATION_GROUPS, RECOMMENDED_LOCATION_IDS, type LocationCity } from "@/types";

interface Props {
  open: boolean;
  value: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}

type CityState = "none" | "partial" | "all";

function cityState(city: LocationCity, selected: Set<string>): CityState {
  const ids = city.districts.map((d) => d.id);
  const count = ids.filter((id) => selected.has(id)).length;
  if (count === 0) return "none";
  if (count === ids.length) return "all";
  return "partial";
}

function CityCheckbox({ state }: { state: CityState }) {
  if (state === "all") {
    return (
      <span className="bg-primary-600 flex h-4 w-4 shrink-0 items-center justify-center rounded text-white">
        <svg
          viewBox="0 0 10 8"
          className="h-2.5 w-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M1 4l2.5 2.5L9 1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (state === "partial") {
    return (
      <span className="bg-primary-600 flex h-4 w-4 shrink-0 items-center justify-center rounded text-white">
        <svg
          viewBox="0 0 10 2"
          className="h-2.5 w-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M1 1h8" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 bg-white" />
  );
}

function DistrictCheckbox({ checked }: { checked: boolean }) {
  return checked ? (
    <span className="bg-primary-600 flex h-4 w-4 shrink-0 items-center justify-center rounded text-white">
      <svg
        viewBox="0 0 10 8"
        className="h-2.5 w-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M1 4l2.5 2.5L9 1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  ) : (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 bg-white" />
  );
}

export function LocationPicker({ open, value, onChange, onClose }: Props) {
  const [draft, setDraft] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [activeCityCode, setActiveCityCode] = useState(
    LOCATION_GROUPS[0]?.cityCode ?? ""
  );
  const [recommendedExpanded, setRecommendedExpanded] = useState(true);

  useEffect(() => {
    if (open) {
      setDraft(value);
      setQuery("");
      setActiveCityCode(LOCATION_GROUPS[0]?.cityCode ?? "");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const draftSet = new Set(draft);

  function toggleDistrict(id: string) {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleCity(city: LocationCity) {
    const ids = city.districts.map((d) => d.id);
    const allSelected = ids.every((id) => draftSet.has(id));
    if (allSelected) {
      setDraft((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setDraft((prev) => [...new Set([...prev, ...ids])]);
    }
  }

  const trimmedQuery = query.trim();
  const searchResults = trimmedQuery
    ? LOCATION_GROUPS.flatMap((city) =>
        city.districts
          .filter(
            (d) =>
              d.districtLabel.includes(trimmedQuery) ||
              city.cityLabel.includes(trimmedQuery)
          )
          .map((d) => ({ ...d, cityLabel: city.cityLabel }))
      )
    : [];

  const activeCity = LOCATION_GROUPS.find((c) => c.cityCode === activeCityCode);

  const recommendedDistricts = LOCATION_GROUPS.flatMap((c) =>
    c.districts.filter((d) => RECOMMENDED_LOCATION_IDS.includes(d.id))
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[600px] w-[700px] max-w-[95vw] flex-col rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <svg
            className="h-4 w-4 shrink-0 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋縣市或地區..."
            className="flex-1 text-sm outline-none placeholder:text-gray-400"
          />
          <span className="shrink-0 text-sm font-medium text-gray-700">地區類別選單</span>
          <button
            onClick={onClose}
            className="ml-2 text-gray-400 hover:text-gray-600"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        {/* Counter + clear + recommended toggle */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">已選擇：{draft.length}</span>
            {draft.length > 0 && (
              <button
                onClick={() => setDraft([])}
                className="text-primary-600 hover:text-primary-500 text-sm"
              >
                清除全部
              </button>
            )}
          </div>
          <button
            onClick={() => setRecommendedExpanded((e) => !e)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            推薦地區
            <svg
              className={`h-3.5 w-3.5 transition-transform ${recommendedExpanded ? "rotate-180" : ""}`}
              viewBox="0 0 10 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Recommended chips */}
        {recommendedExpanded && (
          <div className="border-b px-4 py-2.5">
            <div className="flex flex-wrap gap-1.5">
              {recommendedDistricts.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDistrict(d.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    draftSet.has(d.id)
                      ? "bg-primary-600 text-white"
                      : "border border-gray-200 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Body: search results OR two-panel */}
        {trimmedQuery ? (
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {searchResults.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">找不到符合的地區</p>
            ) : (
              searchResults.map((d) => (
                <label
                  key={d.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 hover:bg-gray-50"
                >
                  <DistrictCheckbox checked={draftSet.has(d.id)} />
                  <button
                    type="button"
                    className="flex-1 text-left text-sm text-gray-700"
                    onClick={() => toggleDistrict(d.id)}
                  >
                    {d.label}
                  </button>
                </label>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Left: city list */}
            <div className="w-36 shrink-0 overflow-y-auto border-r bg-gray-50">
              {LOCATION_GROUPS.map((city) => {
                const state = cityState(city, draftSet);
                const count = city.districts.filter((d) => draftSet.has(d.id)).length;
                const isActive = activeCityCode === city.cityCode;
                return (
                  <button
                    key={city.cityCode}
                    type="button"
                    onClick={() => setActiveCityCode(city.cityCode)}
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition ${
                      isActive
                        ? "text-primary-600 bg-white font-medium"
                        : "text-gray-700 hover:bg-white"
                    }`}
                  >
                    <span>{city.cityLabel}</span>
                    {count > 0 && (
                      <span
                        className={`ml-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs text-white ${
                          state === "all" ? "bg-primary-600" : "bg-primary-500"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right: districts */}
            {activeCity && (
              <div className="flex-1 overflow-y-auto p-3">
                {/* City select-all row */}
                <button
                  type="button"
                  onClick={() => toggleCity(activeCity)}
                  className="mb-1 flex w-full items-center gap-2.5 rounded-md px-2 py-2 hover:bg-gray-50"
                >
                  <CityCheckbox state={cityState(activeCity, draftSet)} />
                  <span className="text-sm font-medium text-gray-800">
                    {activeCity.cityLabel}
                  </span>
                </button>

                {/* District rows */}
                <div className="ml-2 space-y-0.5">
                  {activeCity.districts.map((d) => {
                    const checked = draftSet.has(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDistrict(d.id)}
                        className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition hover:bg-gray-50 ${
                          checked ? "bg-primary-100" : ""
                        }`}
                      >
                        <DistrictCheckbox checked={checked} />
                        <span className="text-sm text-gray-700">{d.districtLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end border-t px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onChange(draft);
              onClose();
            }}
            className="bg-primary-600 hover:bg-primary-500 rounded-lg px-8 py-2 text-sm font-medium text-white transition"
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
}
