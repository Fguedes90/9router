import { NextResponse } from "next/server";
import { homedir } from "os";
import { join } from "path";
import Database from "better-sqlite3";

/**
 * GET /api/oauth/cursor/auto-import
 * Auto-detect and extract Cursor tokens from local SQLite database
 */
export async function GET() {
  try {
    const platform = process.platform;
    const home = homedir();
    let dbPath;

    // Determine database path based on platform
    if (platform === "darwin") {
      dbPath = join(home, "Library/Application Support/Cursor/User/globalStorage/state.vscdb");
    } else if (platform === "linux") {
      dbPath = join(home, ".config/Cursor/User/globalStorage/state.vscdb");
    } else if (platform === "win32") {
      dbPath = join(process.env.APPDATA || "", "Cursor/User/globalStorage/state.vscdb");
    } else {
      return NextResponse.json(
        { error: "Unsupported platform", found: false },
        { status: 400 }
      );
    }

    // Try to open database
    let db;
    try {
      db = new Database(dbPath, { readonly: true, fileMustExist: true });
    } catch (error) {
      return NextResponse.json({
        found: false,
        error: "Cursor database not found. Make sure Cursor IDE is installed and you are logged in. If 9Router runs on another machine, use manual token paste.",
      });
    }

    try {
      // Extract tokens from database (table name: ItemTable in schema, SQLite folds to lowercase)
      const rows = db.prepare(
        "SELECT key, value FROM ItemTable WHERE key IN (?, ?)"
      ).all("cursorAuth/accessToken", "storage.serviceMachineId");

      const tokens = {};
      for (const row of rows) {
        const key = row.key == null ? "" : (Buffer.isBuffer(row.key) ? row.key.toString("utf8") : String(row.key));
        const value = row.value == null ? "" : (Buffer.isBuffer(row.value) ? row.value.toString("utf8") : String(row.value));
        if (key === "cursorAuth/accessToken") {
          tokens.accessToken = value;
        } else if (key === "storage.serviceMachineId") {
          tokens.machineId = value;
        }
      }

      db.close();

      // Validate tokens exist and are non-empty
      if (!tokens.accessToken?.trim() || !tokens.machineId?.trim()) {
        return NextResponse.json({
          found: false,
          error: "Tokens not found in database. Please login to Cursor IDE first.",
        });
      }

      return NextResponse.json({
        found: true,
        accessToken: tokens.accessToken.trim(),
        machineId: tokens.machineId.trim(),
      });
    } catch (error) {
      db?.close();
      return NextResponse.json({
        found: false,
        error: `Failed to read database: ${error.message}`,
      });
    }
  } catch (error) {
    console.error("Cursor auto-import error:", error);
    return NextResponse.json(
      { found: false, error: error.message },
      { status: 500 }
    );
  }
}
