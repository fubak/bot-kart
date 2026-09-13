import bpy, os
from bpy import data as D

BLEND = r"C:\github\bot-kart\assets\blender\characters\bot-a.blend"
GLB   = r"C:\github\bot-kart\assets\exported\characters\bot-a.glb"
bpy.ops.wm.open_mainfile(filepath=BLEND)

# semantic names for the 3 dome stripe segments (front/top/back by Y position)
ren = {'head_stripe':'head_stripe_front', 'head_stripe.001':'head_stripe_top', 'head_stripe.002':'head_stripe_back'}
for old,new in ren.items():
    o = D.objects.get(old)
    if o: o.name = new

# any remaining dotted names?
dotted = [o.name for o in D.objects if '.0' in o.name]
print("dotted names left:", dotted)

# rename mesh datablocks to match their objects
for o in D.objects:
    if o.type=='MESH' and o.data.name != o.name:
        o.data.name = o.name

# re-export GLB (bot hierarchy only)
bpy.ops.object.select_all(action='DESELECT')
def sel(o):
    o.select_set(True)
    for k in o.children: sel(k)
sel(D.objects['grokbot_a'])
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True, export_animations=False)
print("EXPORTED", GLB, os.path.getsize(GLB), "bytes")
bpy.ops.wm.save_mainfile()
print("SAVED", bpy.data.filepath)
