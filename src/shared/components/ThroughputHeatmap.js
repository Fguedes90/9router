"use client";

import PropTypes from "prop-types";
import { cn } from "@/shared/utils/cn";

/**
 * ThroughputHeatmap - Visualizes provider/model performance by input token category
 * 
 * @param {Object} props
 * @param {Array} props.data - Array of throughput data objects
 * @param {string} props.data[].provider - Provider name
 * @param {string} props.data[].model - Model name (optional)
 * @param {number} props.data[].low - Throughput for low input tokens (tokens/sec)
 * @param {number} props.data[].medium - Throughput for medium input tokens (tokens/sec)
 * @param {number} props.data[].high - Throughput for high input tokens (tokens/sec)
 * @param {string} props.title - Optional title for the heatmap
 * @param {string} props.className - Additional CSS classes
 * 
 * Input token categories:
 * - Low: 0-4K tokens
 * - Medium: 4K-32K tokens
 * - High: 32K+ tokens
 */

// Color thresholds (tokens per second)
const THRESHOLDS = {
  fast: 50,    // >= 50 tok/s = green
  medium: 20,   // >= 20 tok/s = yellow
  // < 20 tok/s = red
};

function getPerformanceColor(throughput) {
  if (throughput >= THRESHOLDS.fast) return "bg-success/80";
  if (throughput >= THRESHOLDS.medium) return "bg-warning/80";
  return "bg-error/80";
}

function getPerformanceTextColor(throughput) {
  if (throughput >= THRESHOLDS.fast) return "text-success";
  if (throughput >= THRESHOLDS.medium) return "text-warning";
  return "text-error";
}

function formatThroughput(value) {
  if (value === undefined || value === null || value === 0) return "—";
  return `${value.toFixed(1)}`;
}

function Tooltip({ value, category, provider, model }) {
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 
                    bg-text text-bg-subtle text-xs rounded-lg shadow-lg whitespace-nowrap
                    opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
      <div className="font-semibold">{provider} {model && `/ ${model}`}</div>
      <div className="text-text-muted">{category}: {value?.toFixed(1) || "—"} tok/s</div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 
                      w-2 h-2 bg-text"></div>
    </div>
  );
}

Tooltip.propTypes = {
  value: PropTypes.number,
  category: PropTypes.string.isRequired,
  provider: PropTypes.string.isRequired,
  model: PropTypes.string,
};

function HeatmapCell({ value, category, provider, model }) {
  const colorClass = getPerformanceColor(value);
  const textColorClass = getPerformanceTextColor(value);
  
  return (
    <div className="relative group">
      <Tooltip value={value} category={category} provider={provider} model={model} />
      <div className={cn(
        "w-full h-10 rounded-md flex items-center justify-center text-xs font-mono",
        "transition-all duration-200 hover:scale-105 hover:shadow-md",
        colorClass,
        value === undefined || value === null || value === 0 && "bg-bg-subtle"
      )}>
        <span className={cn(
          value !== undefined && value !== null && value > 0 && textColorClass
        )}>
          {formatThroughput(value)}
        </span>
      </div>
    </div>
  );
}

HeatmapCell.propTypes = {
  value: PropTypes.number,
  category: PropTypes.string.isRequired,
  provider: PropTypes.string.isRequired,
  model: PropTypes.string,
};

export default function ThroughputHeatmap({
  data = [],
  title = "Throughput by Input Size",
  className,
}) {
  const categories = [
    { key: "low", label: "Low (0-4K)", description: "Small prompts" },
    { key: "medium", label: "Medium (4K-32K)", description: "Medium prompts" },
    { key: "high", label: "High (32K+)", description: "Large prompts" },
  ];

  return (
    <div className={cn("w-full", className)}>
      {title && (
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-2 font-medium text-text-muted">
                Provider
              </th>
              {categories.map((cat) => (
                <th key={cat.key} className="text-center py-3 px-2">
                  <div className="font-medium text-text">{cat.label}</div>
                  <div className="text-xs text-text-muted">{cat.description}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-text-muted">
                  No throughput data available. Make some requests to see performance metrics.
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={row.provider + (row.model || "") + idx} 
                    className="hover:bg-bg-subtle/50 transition-colors">
                  <td className="py-3 px-2">
                    <div className="font-medium">{row.provider}</div>
                    {row.model && (
                      <div className="text-xs text-text-muted">{row.model}</div>
                    )}
                  </td>
                  {categories.map((cat) => (
                    <td key={cat.key} className="py-3 px-2">
                      <HeatmapCell 
                        value={row[cat.key]} 
                        category={cat.label}
                        provider={row.provider}
                        model={row.model}
                      />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-4 mt-4 text-xs text-text-muted">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-success/80"></div>
          <span>Fast (≥{THRESHOLDS.fast} tok/s)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-warning/80"></div>
          <span>Medium (≥{THRESHOLDS.medium} tok/s)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-error/80"></div>
          <span>Slow (&lt;{THRESHOLDS.medium} tok/s)</span>
        </div>
      </div>
    </div>
  );
}

ThroughputHeatmap.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    provider: PropTypes.string.isRequired,
    model: PropTypes.string,
    low: PropTypes.number,
    medium: PropTypes.number,
    high: PropTypes.number,
  })),
  title: PropTypes.string,
  className: PropTypes.string,
};
