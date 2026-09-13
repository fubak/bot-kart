import bpy, math, os
from bpy import data as D
from mathutils import Vector

BLEND = r"C:\github\bot-kart\assets\blender\characters\bot-a.blend"
GLB   = r"C:\github\bot-kart\assets\exported\characters\bot-a.glb"
PNG   = r"C:\github\bot-kart\docs\gauntlet\evidence\wave1\bot-a_preview.png"

bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene

# ---------- GLB EXPORT (bot hierarchy only) ----------
bpy.ops.object.select_all(action='DESELECT')
def sel(o):
    o.select_set(True)
    for k in o.children: sel(k)
sel(D.objects['grokbot_a'])
os.makedirs(os.path.dirname(GLB), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=GLB,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_animations=False,
)
print("EXPORTED", GLB, os.path.getsize(GLB), "bytes")

# ---------- RENDER PREVIEW ----------
prev = D.collections.get('preview')
if 'preview_ground' not in D.objects:
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0,0,-0.001))
    gnd = bpy.context.object; gnd.name='preview_ground'
    for c in list(gnd.users_collection): c.objects.unlink(gnd)
    prev.objects.link(gnd)
    m = D.materials.new('preview_mat'); m.use_nodes=True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(0.82,0.82,0.85,1)
    b.inputs['Roughness'].default_value=0.9
    gnd.data.materials.append(m)

w = D.worlds.get('World') or D.worlds.new('World')
sc.world = w; w.use_nodes=True
w.node_tree.nodes['Background'].inputs[0].default_value=(0.9,0.9,0.92,1)
w.node_tree.nodes['Background'].inputs[1].default_value=0.6

cam = D.objects['Camera']
cam.location = (2.75, 3.15, 1.95)
d = Vector((0,0.1,0.74)) - Vector(cam.location)
cam.rotation_euler = d.to_track_quat('-Z','Y').to_euler()
cam.data.lens = 58
sc.camera = cam
sun = D.objects['Sun']; sun.data.energy=4.0
sun.rotation_euler=(math.radians(50),math.radians(10),math.radians(30))

sc.render.engine='BLENDER_EEVEE'
sc.render.resolution_x=800; sc.render.resolution_y=800
sc.render.resolution_percentage=100
sc.render.image_settings.file_format='PNG'
sc.render.filepath=PNG
bpy.ops.render.render(write_still=True)
print("RENDERED", PNG)

bpy.ops.wm.save_mainfile()
print("SAVED", bpy.data.filepath)
