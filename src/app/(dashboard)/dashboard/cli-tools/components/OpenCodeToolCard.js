"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Button, ManualConfigModal } from "@/shared/components";

export default function OpenCodeToolCard({
  tool,
  isExpanded,
  onToggle,
  baseUrl,
  apiKeys,
  activeProviders,
  cloudEnabled,
  hasActiveProviders,
}) {
  const [opencodeStatus, setOpencodeStatus] = useState(null);
  const [checkingOpencode, setCheckingOpencode] = useState(false);
  const [applying, setApplying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedApiKey, setSelectedApiKey] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [showManualConfigModal, setShowManualConfigModal] = useState(false);
  const hasInitializedApiKey = useRef(false);

  const getConfigStatus = () => {
    if (!opencodeStatus?.installed) return null;
    const currentProvider = opencodeStatus.settings?.provider?.["9router"];
    if (!currentProvider) return "not_configured";
    const base = currentProvider.options?.baseURL || "";
    const localMatch = base.includes("localhost") || base.includes("127.0.0.1") || base.includes("0.0.0.0");
    if (localMatch) return "configured";
    return "other";
  };

  const configStatus = getConfigStatus();

  useEffect(() => {
    if (apiKeys?.length > 0 && !selectedApiKey) {
      setSelectedApiKey(apiKeys[0].key);
    }
  }, [apiKeys, selectedApiKey]);

  useEffect(() => {
    if (isExpanded && !opencodeStatus) {
      checkOpencodeStatus();
    }
  }, [isExpanded, opencodeStatus]);

  useEffect(() => {
    if (opencodeStatus?.installed && !hasInitializedApiKey.current) {
      hasInitializedApiKey.current = true;
      const provider = opencodeStatus.settings?.provider?.["9router"];
      if (provider?.options?.apiKey && apiKeys?.some(k => k.key === provider.options.apiKey)) {
        setSelectedApiKey(provider.options.apiKey);
      }
    }
  }, [opencodeStatus, apiKeys]);

  const checkOpencodeStatus = async () => {
    setCheckingOpencode(true);
    try {
      const res = await fetch("/api/cli-tools/opencode-settings");
      const data = await res.json();
      setOpencodeStatus(data);
    } catch (error) {
      setOpencodeStatus({ installed: false, error: error.message });
    } finally {
      setCheckingOpencode(false);
    }
  };

  const normalizeLocalhost = (url) => url.replace("://localhost", "://127.0.0.1");

  const getLocalBaseUrl = () => {
    if (typeof window !== "undefined") {
      return normalizeLocalhost(window.location.origin);
    }
    return "http://127.0.0.1:20128";
  };

  const getEffectiveBaseUrl = () => {
    const url = customBaseUrl || getLocalBaseUrl();
    return url.endsWith("/v1") ? url : `${url}/v1`;
  };

  const getDisplayUrl = () => {
    const url = customBaseUrl || getLocalBaseUrl();
    return url.endsWith("/v1") ? url : `${url}/v1`;
  };

  const handleApplySettings = async () => {
    setApplying(true);
    setMessage(null);
    try {
      const keyToUse = selectedApiKey?.trim()
        || (apiKeys?.length > 0 ? apiKeys[0].key : null)
        || (!cloudEnabled ? "sk_9router" : null);

      if (!keyToUse) {
        setMessage({ type: "error", text: "API key is required. Create one in the Keys page or use sk_9router when running locally." });
        setApplying(false);
        return;
      }

      const res = await fetch("/api/cli-tools/opencode-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: getEffectiveBaseUrl(),
          apiKey: keyToUse,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message || "Settings applied successfully!" });
        checkOpencodeStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to apply settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setApplying(false);
    }
  };

  const handleResetSettings = async () => {
    setRestoring(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cli-tools/opencode-settings", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message || "Settings reset successfully!" });
        setSelectedApiKey("");
        checkOpencodeStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to reset settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setRestoring(false);
    }
  };

  const getManualConfigs = () => {
    const keyToUse = (selectedApiKey && selectedApiKey.trim())
      ? selectedApiKey
      : (!cloudEnabled ? "sk_9router" : "<API_KEY_FROM_DASHBOARD>");

    const providerBlock = {
      "9router": {
        npm: "@ai-sdk/openai-compatible",
        name: "9Router",
        options: {
          baseURL: getEffectiveBaseUrl(),
          apiKey: keyToUse,
        },
        models: {
          "my-combo": { name: "my-combo (combo)" },
          "cc/claude-sonnet-4-5-20250929": { name: "Claude 4.5 Sonnet" },
        },
      },
    };

    const fullConfig = {
      "$schema": "https://opencode.ai/config.json",
      provider: providerBlock,
    };

    const configPath = opencodeStatus?.configPath || "~/.config/opencode/opencode.json";
    return [
      {
        filename: configPath,
        content: JSON.stringify(fullConfig, null, 2),
      },
    ];
  };

  const renderIcon = () => (
    <span
      className="material-symbols-outlined text-[28px]"
      style={tool.color ? { color: tool.color } : undefined}
      aria-hidden
    >
      {tool.icon || "terminal"}
    </span>
  );

  return (
    <Card padding="sm" className="overflow-hidden">
      <div className="flex items-center justify-between hover:cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className="size-8 flex items-center justify-center shrink-0">
            {renderIcon()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">{tool.name}</h3>
              {configStatus === "configured" && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">Connected</span>}
              {configStatus === "not_configured" && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-full">Not configured</span>}
              {configStatus === "other" && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">Other</span>}
            </div>
            <p className="text-xs text-text-muted truncate">{tool.description}</p>
          </div>
        </div>
        <span className={`material-symbols-outlined text-text-muted text-[20px] transition-transform ${isExpanded ? "rotate-180" : ""}`}>expand_more</span>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
          {checkingOpencode && (
            <div className="flex items-center gap-2 text-text-muted">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              <span>Checking OpenCode CLI...</span>
            </div>
          )}

          {!checkingOpencode && opencodeStatus && !opencodeStatus.installed && (
            <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <span className="material-symbols-outlined text-yellow-500">warning</span>
              <div className="flex-1">
                <p className="font-medium text-yellow-600 dark:text-yellow-400">OpenCode CLI not installed</p>
                <p className="text-sm text-text-muted">
                  Install with: <code className="px-1.5 py-0.5 bg-black/5 dark:bg-white/5 rounded font-mono text-xs">npm i -g opencode-ai</code> or see{" "}
                  <a href="https://opencode.ai/docs" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">opencode.ai/docs</a>.
                </p>
              </div>
            </div>
          )}

          {!checkingOpencode && opencodeStatus?.installed && (
            <>
              <div className="flex flex-col gap-2">
                {opencodeStatus?.settings?.provider?.["9router"]?.options?.baseURL && (
                  <div className="flex items-center gap-2">
                    <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">Current</span>
                    <span className="material-symbols-outlined text-text-muted text-[14px]">arrow_forward</span>
                    <span className="flex-1 px-2 py-1.5 text-xs text-text-muted truncate">
                      {opencodeStatus.settings.provider["9router"].options.baseURL}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">Base URL</span>
                  <span className="material-symbols-outlined text-text-muted text-[14px]">arrow_forward</span>
                  <input
                    type="text"
                    value={getDisplayUrl()}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    placeholder="https://.../v1"
                    className="flex-1 px-2 py-1.5 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  {customBaseUrl && (
                    <button onClick={() => setCustomBaseUrl("")} className="p-1 text-text-muted hover:text-primary rounded transition-colors" title="Reset to default">
                      <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">API Key</span>
                  <span className="material-symbols-outlined text-text-muted text-[14px]">arrow_forward</span>
                  {apiKeys?.length > 0 ? (
                    <select value={selectedApiKey} onChange={(e) => setSelectedApiKey(e.target.value)} className="flex-1 px-2 py-1.5 bg-surface rounded text-xs border border-border focus:outline-none focus:ring-1 focus:ring-primary/50">
                      {apiKeys.map((key) => (
                        <option key={key.id} value={key.key}>{key.key}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="flex-1 text-xs text-text-muted px-2 py-1.5">
                      {cloudEnabled ? "No API keys - Create one in Keys page" : "sk_9router (default)"}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-text-muted">
                Apply will add the 9Router provider and sync combos and models to the native OpenCode model picker.
              </p>

              {message && (
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${message.type === "success" ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
                  <span className="material-symbols-outlined text-[14px]">{message.type === "success" ? "check_circle" : "error"}</span>
                  <span>{message.text}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={handleApplySettings} loading={applying}>
                  <span className="material-symbols-outlined text-[14px] mr-1">save</span>Apply
                </Button>
                <Button variant="outline" size="sm" onClick={handleResetSettings} disabled={!opencodeStatus?.has9Router} loading={restoring}>
                  <span className="material-symbols-outlined text-[14px] mr-1">restore</span>Reset
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowManualConfigModal(true)}>
                  <span className="material-symbols-outlined text-[14px] mr-1">content_copy</span>Manual Config
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <ManualConfigModal
        isOpen={showManualConfigModal}
        onClose={() => setShowManualConfigModal(false)}
        title="OpenCode - Manual Configuration"
        configs={getManualConfigs()}
      />
    </Card>
  );
}
