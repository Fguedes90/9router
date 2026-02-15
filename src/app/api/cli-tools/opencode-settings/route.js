"use server";

import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { getProviderConnections, getCombos } from "@/lib/localDb";
import { buildOpenCodeModelsMap } from "@/lib/openCodeModels";

const execAsync = promisify(exec);

function getOpenCodeConfigDir() {
  if (os.platform() === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "opencode");
  }
  return path.join(os.homedir(), ".config", "opencode");
}

function getOpenCodeConfigPath() {
  return path.join(getOpenCodeConfigDir(), "opencode.json");
}

const checkOpencodeInstalled = async () => {
  try {
    const isWindows = os.platform() === "win32";
    const command = isWindows ? "where opencode" : "command -v opencode";
    await execAsync(command);
    return true;
  } catch {
    return false;
  }
};

const readConfig = async () => {
  try {
    const configPath = getOpenCodeConfigPath();
    const content = await fs.readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

const has9RouterConfig = (config) => {
  if (!config || !config.provider) return false;
  return !!config.provider["9router"];
};

export async function GET() {
  try {
    const isInstalled = await checkOpencodeInstalled();

    if (!isInstalled) {
      return NextResponse.json({
        installed: false,
        settings: null,
        message: "OpenCode CLI is not installed",
      });
    }

    const settings = await readConfig();

    return NextResponse.json({
      installed: true,
      settings,
      has9Router: has9RouterConfig(settings),
      configPath: getOpenCodeConfigPath(),
    });
  } catch (error) {
    console.log("Error checking opencode settings:", error);
    return NextResponse.json({ error: "Failed to check opencode settings" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { baseUrl, apiKey } = await request.json();

    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: "baseUrl and apiKey are required" }, { status: 400 });
    }

    const configDir = getOpenCodeConfigDir();
    const configPath = getOpenCodeConfigPath();

    await fs.mkdir(configDir, { recursive: true });

    const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;

    let connections = [];
    let combos = [];
    try {
      connections = await getProviderConnections();
      connections = connections.filter(c => c.isActive !== false);
    } catch (e) {
      console.log("Could not fetch providers for opencode models list");
    }
    try {
      combos = await getCombos();
    } catch (e) {
      console.log("Could not fetch combos for opencode models list");
    }

    const models = buildOpenCodeModelsMap(combos, connections);

    let config = {};
    try {
      const content = await fs.readFile(configPath, "utf-8");
      config = JSON.parse(content);
    } catch {
      // No existing config
    }

    if (!config.provider) config.provider = {};

    config.provider["9router"] = {
      npm: "@ai-sdk/openai-compatible",
      name: "9Router",
      options: {
        baseURL: normalizedBaseUrl,
        apiKey,
      },
      models,
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    return NextResponse.json({
      success: true,
      message: "OpenCode settings applied successfully! Combos and models are available in the native model picker.",
      configPath,
    });
  } catch (error) {
    console.log("Error updating opencode settings:", error);
    return NextResponse.json({ error: "Failed to update opencode settings" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const configPath = getOpenCodeConfigPath();

    let config = {};
    try {
      const content = await fs.readFile(configPath, "utf-8");
      config = JSON.parse(content);
    } catch (error) {
      if (error.code === "ENOENT") {
        return NextResponse.json({
          success: true,
          message: "No config file to reset",
        });
      }
      throw error;
    }

    if (config.provider) {
      delete config.provider["9router"];
      if (Object.keys(config.provider).length === 0) {
        delete config.provider;
      }
    }

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    return NextResponse.json({
      success: true,
      message: "9Router settings removed from OpenCode config",
    });
  } catch (error) {
    console.log("Error resetting opencode settings:", error);
    return NextResponse.json({ error: "Failed to reset opencode settings" }, { status: 500 });
  }
}
