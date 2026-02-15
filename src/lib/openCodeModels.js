/**
 * Build the OpenCode provider.9router.models map from 9router combos and connections.
 * Used by the opencode-settings API to populate the native model picker.
 */
import { PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";

/**
 * @param {Array<{ name: string }>} combos
 * @param {Array<{ provider: string; isActive?: boolean }>} connections
 * @returns {{ [id: string]: { name: string } }}
 */
export function buildOpenCodeModelsMap(combos, connections) {
  const activeConnections = (connections || []).filter(c => c.isActive !== false);
  const activeAliases = new Set();
  for (const conn of activeConnections) {
    const alias = PROVIDER_ID_TO_ALIAS[conn.provider] || conn.provider;
    activeAliases.add(alias);
  }

  const models = {};

  // Combos first
  for (const combo of combos || []) {
    const id = combo.name;
    if (id) {
      models[id] = { name: `${id} (combo)` };
    }
  }

  // Provider models
  for (const [alias, providerModels] of Object.entries(PROVIDER_MODELS)) {
    if (activeConnections.length > 0 && !activeAliases.has(alias)) {
      continue;
    }
    for (const model of providerModels) {
      const id = `${alias}/${model.id}`;
      models[id] = { name: model.name || model.id };
    }
  }

  return models;
}
