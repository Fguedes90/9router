import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";
import { filterAllowedSettings } from "@/lib/settingsAllowlist";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const settings = await getSettings();
    const { password, ...safeSettings } = settings;
    
    const enableRequestLogs = process.env.ENABLE_REQUEST_LOGS === "true";
    
    return NextResponse.json({ 
      ...safeSettings, 
      enableRequestLogs,
      hasPassword: !!password
    });
  } catch (error) {
    console.log("Error getting settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();

    // Password may only be set via newPassword flow (hashed here). Never trust body.password.
    let hashedNewPassword = undefined;
    if (body.newPassword) {
      const settings = await getSettings();
      const currentHash = settings.password;

      // Verify current password if it exists
      if (currentHash) {
        if (!body.currentPassword) {
          return NextResponse.json({ error: "Current password required" }, { status: 400 });
        }
        const isValid = await bcrypt.compare(body.currentPassword, currentHash);
        if (!isValid) {
          return NextResponse.json({ error: "Invalid current password" }, { status: 401 });
        }
      } else {
        // First time setting password, no current password needed
        // In production, do not accept default "123456" as current (force changing default first)
        if (process.env.NODE_ENV === "production" && body.currentPassword === "123456") {
          return NextResponse.json(
            { error: "Change the default password before setting a new one" },
            { status: 400 }
          );
        }
        if (body.currentPassword && body.currentPassword !== "123456") {
          return NextResponse.json({ error: "Invalid current password" }, { status: 401 });
        }
      }

      const salt = await bcrypt.genSalt(10);
      hashedNewPassword = await bcrypt.hash(body.newPassword, salt);
      delete body.newPassword;
      delete body.currentPassword;
    }

    const updates = filterAllowedSettings(body);
    // Only set password when we hashed it from newPassword above; ignore body.password to prevent bypass
    if (hashedNewPassword !== undefined) updates.password = hashedNewPassword;
    const settings = await updateSettings(updates);
    const { password, ...safeSettings } = settings;
    return NextResponse.json(safeSettings);
  } catch (error) {
    console.log("Error updating settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
