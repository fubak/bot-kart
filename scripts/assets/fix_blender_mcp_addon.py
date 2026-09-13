"""One-time Blender MCP addon fix (preflight repair).

The stock Blender "mcp" extension (bl_ext.lab_blender_org.mcp) auto-starts a
socket server on port 9876 that speaks a different protocol than the
blender-mcp uvx server this project uses (protocol v5). When the extension
holds the port, every MCP call fails with "Incomplete JSON response".

This script disables the conflicting extension, enables blender_mcp, saves
user preferences so the state persists across restarts, and exits.
Run: blender.exe --background --python scripts/assets/fix_blender_mcp_addon.py
"""

import bpy

print("[fix] enabled addons before:", sorted(bpy.context.preferences.addons.keys()))

# Disable the stock extension that collides on port 9876.
for module in ("bl_ext.lab_blender_org.mcp", "mcp"):
    if module in bpy.context.preferences.addons:
        bpy.ops.preferences.addon_disable(module=module)
        print(f"[fix] disabled {module}")

# Enable the blender-mcp addon (auto-starts its v5 server on register).
if "blender_mcp" not in bpy.context.preferences.addons:
    bpy.ops.preferences.addon_enable(module="blender_mcp")
    print("[fix] enabled blender_mcp")

bpy.ops.wm.save_userpref()
print("[fix] enabled addons after:", sorted(bpy.context.preferences.addons.keys()))
print("[fix] done — userpref saved")
