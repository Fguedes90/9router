#!/usr/bin/env node

/**
 * GLM/ZAI Model Availability Tester
 * Tests which models are actually available on api.z.ai and open.bigmodel.cn
 * Reads API key from the local 9router DB (~/.9router/db.json)
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DB_PATH = path.join(os.homedir(), ".9router", "db.json");

// Models to test per provider
const GLM_MODELS = [
  "glm-5",
  "glm-5-code",
  "glm-4.7",
  "glm-4.6",
  "glm-4.6v",
  "glm-4.5",
  "glm-4.5-air",
];

const GLM_CN_MODELS = [
  "glm-5",
  "glm-5-code",
  "glm-4.7",
  "glm-4.6",
  "glm-4.5",
  "glm-4.5-air",
];

// Provider endpoints
const PROVIDERS = {
  glm: {
    url: "https://api.z.ai/api/anthropic/v1/messages",
    format: "claude",
  },
  "glm-cn": {
    url: "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions",
    format: "openai",
  },
};

function loadApiKeys() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`DB not found at ${DB_PATH}`);
    process.exit(1);
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  const connections = db.providerConnections || [];

  const keys = {};
  for (const conn of connections) {
    if ((conn.provider === "glm" || conn.provider === "glm-cn") && conn.apiKey) {
      if (!keys[conn.provider]) {
        keys[conn.provider] = conn.apiKey;
        console.log(`Found API key for ${conn.provider} (account: ${conn.name || conn.id})`);
      }
    }
  }

  return keys;
}

async function testModelClaude(url, apiKey, model) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 5,
      messages: [{ role: "user", content: "Say hi" }],
    }),
  });

  const body = await res.text();
  let parsed;
  try { parsed = JSON.parse(body); } catch { parsed = null; }

  return {
    status: res.status,
    ok: res.status === 200,
    error: parsed?.error?.message || (res.status !== 200 ? body.slice(0, 200) : null),
  };
}

async function testModelOpenAI(url, apiKey, model) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 5,
      messages: [{ role: "user", content: "Say hi" }],
    }),
  });

  const body = await res.text();
  let parsed;
  try { parsed = JSON.parse(body); } catch { parsed = null; }

  return {
    status: res.status,
    ok: res.status === 200,
    error: parsed?.error?.message || parsed?.message || (res.status !== 200 ? body.slice(0, 200) : null),
  };
}

async function testProvider(providerId, apiKey) {
  const config = PROVIDERS[providerId];
  const models = providerId === "glm" ? GLM_MODELS : GLM_CN_MODELS;
  const testFn = config.format === "claude" ? testModelClaude : testModelOpenAI;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Provider: ${providerId} (${config.url})`);
  console.log(`Format: ${config.format}`);
  console.log(`${"=".repeat(60)}\n`);

  const results = [];

  for (const model of models) {
    process.stdout.write(`  Testing ${model.padEnd(20)} ... `);
    try {
      const result = await testFn(config.url, apiKey, model);
      if (result.ok) {
        console.log(`\x1b[32mOK\x1b[0m (${result.status})`);
      } else {
        console.log(`\x1b[31mFAIL\x1b[0m (${result.status}) ${result.error || ""}`);
      }
      results.push({ model, ...result });
    } catch (err) {
      console.log(`\x1b[31mERROR\x1b[0m ${err.message}`);
      results.push({ model, status: 0, ok: false, error: err.message });
    }
  }

  // Summary
  console.log(`\n  ${"─".repeat(50)}`);
  const working = results.filter(r => r.ok);
  const failing = results.filter(r => !r.ok);
  console.log(`  Working: ${working.length}/${results.length}`);
  if (working.length > 0) {
    console.log(`  \x1b[32m✓\x1b[0m ${working.map(r => r.model).join(", ")}`);
  }
  if (failing.length > 0) {
    console.log(`  \x1b[31m✗\x1b[0m ${failing.map(r => r.model).join(", ")}`);
  }

  return results;
}

async function main() {
  console.log("GLM/ZAI Model Availability Tester\n");

  const keys = loadApiKeys();

  if (Object.keys(keys).length === 0) {
    console.error("\nNo GLM API keys found in the database.");
    console.error("Please add a GLM provider connection in the 9router dashboard first.");
    process.exit(1);
  }

  for (const [providerId, apiKey] of Object.entries(keys)) {
    await testProvider(providerId, apiKey);
  }

  console.log("\nDone.\n");
}

main().catch(console.error);
