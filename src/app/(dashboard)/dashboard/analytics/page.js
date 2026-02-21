"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, Select, Input, Button, CardSkeleton } from "@/shared/components";

/**
 * Format throughput value (tokens/sec) with appropriate precision
 * @param {number|null|undefined} value - Throughput value
 * @returns {string} Formatted value
 */
function fmtThroughput(value) {
  if (value === null || value === undefined) return "—";
  if (value < 1) return value.toFixed(2);
  if (value < 100) return value.toFixed(1);
  return Math.round(value).toLocaleString();
}

/**
 * Get a human-readable percentile label
 * @param {string} p - Percentile string (p50, p95, p99)
 * @returns {string} Human-readable label
 */
function getPercentileLabel(p) {
  const labels = {
    p0: "Min",
    p25: "Q1",
    p50: "Median",
    p75: "Q3",
    p90: "P90",
    p95: "P95",
    p99: "P99",
    p100: "Max",
  };
  return labels[p] || p;
}

/**
 * Get color class for throughput performance
 * @param {number|null|undefined} value - Throughput value
 * @returns {string} Color class
 */
function getThroughputColor(value) {
  if (value === null || value === undefined) return "text-text-muted";
  if (value >= 100) return "text-success";
  if (value >= 50) return "text-primary";
  if (value >= 20) return "text-warning";
  return "text-error";
}

function ThroughputStats({ data, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-4 bg-bg-subtle rounded w-24 mb-2"></div>
            <div className="h-8 bg-bg-subtle rounded w-32"></div>
          </Card>
        ))}
      </div>
    );
  }

  if (!data?.summary) {
    return (
      <Card className="p-6 text-center text-text-muted">
        No throughput data available. Make some requests to see metrics here.
      </Card>
    );
  }

  const { summary, percentiles = ["p50", "p95", "p99"] } = data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {percentiles.map((p) => (
        <Card key={p} className="px-4 py-3 flex flex-col gap-1">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <span className="text-text-muted text-sm uppercase font-semibold">
                {getPercentileLabel(p)} Throughput
              </span>
              <span className={`text-2xl font-bold ${getThroughputColor(summary[p])}`}>
                {fmtThroughput(summary[p])} <span className="text-sm font-normal text-text-muted">tok/s</span>
              </span>
            </div>
          </div>
          <span className="text-xs text-text-muted">
            Sample: {summary.sampleSize?.toLocaleString() || 0} requests
          </span>
        </Card>
      ))}
    </div>
  );
}

function ProviderBreakdown({ data, loading }) {
  if (loading) {
    return (
      <Card className="animate-pulse">
        <div className="h-6 bg-bg-subtle rounded w-32 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-bg-subtle rounded"></div>
          ))}
        </div>
      </Card>
    );
  }

  const providers = data?.byProvider || {};
  const providerList = Object.entries(providers).sort((a, b) => (b[1]?.p50 || 0) - (a[1]?.p50 || 0));

  if (providerList.length === 0) {
    return (
      <Card>
        <div className="p-4 border-b border-border bg-bg-subtle/50">
          <h3 className="font-semibold">Throughput by Provider</h3>
        </div>
        <div className="p-6 text-center text-text-muted">
          No provider data available.
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border bg-bg-subtle/50">
        <h3 className="font-semibold">Throughput by Provider</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-bg-subtle/30 text-text-muted uppercase text-xs">
            <tr>
              <th className="px-6 py-3">Provider</th>
              <th className="px-6 py-3 text-right">Median (tok/s)</th>
              <th className="px-6 py-3 text-right">P95 (tok/s)</th>
              <th className="px-6 py-3 text-right">P99 (tok/s)</th>
              <th className="px-6 py-3 text-right">Sample Size</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {providerList.map(([provider, stats]) => (
              <tr key={provider} className="hover:bg-bg-subtle/50 transition-colors">
                <td className="px-6 py-3 font-medium">{provider}</td>
                <td className={`px-6 py-3 text-right ${getThroughputColor(stats?.p50)}`}>
                  {fmtThroughput(stats?.p50)}
                </td>
                <td className={`px-6 py-3 text-right ${getThroughputColor(stats?.p95)}`}>
                  {fmtThroughput(stats?.p95)}
                </td>
                <td className={`px-6 py-3 text-right ${getThroughputColor(stats?.p99)}`}>
                  {fmtThroughput(stats?.p99)}
                </td>
                <td className="px-6 py-3 text-right text-text-muted">
                  {stats?.sampleSize?.toLocaleString() || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ModelBreakdown({ data, loading }) {
  if (loading) {
    return (
      <Card className="animate-pulse">
        <div className="h-6 bg-bg-subtle rounded w-32 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-bg-subtle rounded"></div>
          ))}
        </div>
      </Card>
    );
  }

  const models = data?.byModel || {};
  const modelList = Object.entries(models).sort((a, b) => (b[1]?.p50 || 0) - (a[1]?.p50 || 0));

  if (modelList.length === 0) {
    return (
      <Card>
        <div className="p-4 border-b border-border bg-bg-subtle/50">
          <h3 className="font-semibold">Throughput by Model</h3>
        </div>
        <div className="p-6 text-center text-text-muted">
          No model data available.
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border bg-bg-subtle/50">
        <h3 className="font-semibold">Throughput by Model</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-bg-subtle/30 text-text-muted uppercase text-xs">
            <tr>
              <th className="px-6 py-3">Model</th>
              <th className="px-6 py-3 text-right">Median (tok/s)</th>
              <th className="px-6 py-3 text-right">P95 (tok/s)</th>
              <th className="px-6 py-3 text-right">P99 (tok/s)</th>
              <th className="px-6 py-3 text-right">Sample Size</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {modelList.map(([model, stats]) => (
              <tr key={model} className="hover:bg-bg-subtle/50 transition-colors">
                <td className="px-6 py-3 font-medium font-mono text-xs">{model}</td>
                <td className={`px-6 py-3 text-right ${getThroughputColor(stats?.p50)}`}>
                  {fmtThroughput(stats?.p50)}
                </td>
                <td className={`px-6 py-3 text-right ${getThroughputColor(stats?.p95)}`}>
                  {fmtThroughput(stats?.p95)}
                </td>
                <td className={`px-6 py-3 text-right ${getThroughputColor(stats?.p99)}`}>
                  {fmtThroughput(stats?.p99)}
                </td>
                <td className="px-6 py-3 text-right text-text-muted">
                  {stats?.sampleSize?.toLocaleString() || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function FilterBar({ filters, onFilterChange, onClearFilters }) {
  const handleChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <Input
            type="date"
            label="Start Date"
            value={filters.startDate || ""}
            onChange={(e) => handleChange("startDate", e.target.value)}
            max={filters.endDate || new Date().toISOString().split("T")[0]}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <Input
            type="date"
            label="End Date"
            value={filters.endDate || ""}
            onChange={(e) => handleChange("endDate", e.target.value)}
            min={filters.startDate}
            max={new Date().toISOString().split("T")[0]}
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <Input
            label="Provider"
            placeholder="All providers"
            value={filters.provider || ""}
            onChange={(e) => handleChange("provider", e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <Input
            label="Model"
            placeholder="All models"
            value={filters.model || ""}
            onChange={(e) => handleChange("model", e.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          onClick={onClearFilters}
          className="mb-0.5"
        >
          Clear Filters
        </Button>
      </div>
    </Card>
  );
}

function AnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize filters from URL params
  const [filters, setFilters] = useState({
    provider: searchParams.get("provider") || "",
    model: searchParams.get("model") || "",
    startDate: searchParams.get("startDate") || "",
    endDate: searchParams.get("endDate") || "",
  });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Build query string from filters
  const buildQueryString = useCallback((f) => {
    const params = new URLSearchParams();
    if (f.provider) params.set("provider", f.provider);
    if (f.model) params.set("model", f.model);
    if (f.startDate) params.set("startDate", f.startDate);
    if (f.endDate) params.set("endDate", f.endDate);
    return params.toString();
  }, []);

  // Fetch throughput data
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const queryString = buildQueryString(filters);
      const res = await fetch(`/api/analytics/throughput?${queryString}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch throughput analytics:", error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [filters, buildQueryString]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update URL when filters change
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    router.push(`/dashboard/analytics?${params.toString()}`, { scroll: false });
  };

  const handleClearFilters = () => {
    const emptyFilters = { provider: "", model: "", startDate: "", endDate: "" };
    setFilters(emptyFilters);
    router.push("/dashboard/analytics", { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />

      <ThroughputStats data={data} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProviderBreakdown data={data} loading={loading} />
        <ModelBreakdown data={data} loading={loading} />
      </div>

      {data?.summary?.calculatedAt && (
        <p className="text-xs text-text-muted text-center">
          Last updated: {new Date(data.summary.calculatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <AnalyticsContent />
    </Suspense>
  );
}
