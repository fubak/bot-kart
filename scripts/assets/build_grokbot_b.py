"""Build Grok Bot B — heavy/power rival (chunky box vocabulary, CRT pixel face).

Run inside Blender (MCP execute_blender_code):  exec(open(<this file>).read())
Creates:  standing hierarchy `grokbot_b` + seated variant `grokbot_b_seated`
          in collections `bot_b` / `bot_b_seated`, a `preview` collection,
          exports both GLBs, renders previews, saves the .blend.
Conventions (match bot-a.blend / ADR-002):
  1 unit = 1 m, Blender +Y = character forward (exports to glTF -Z), +Z up.
  Standing origin at feet; seated origin at seat base.
"""
import bpy, math, os
from bpy import data as D
from mathutils import Vector, Matrix

ROOT  = r"C:\github\bot-kart"
BLEND = ROOT + r"\assets\blender\characters\grokbot-b.blend"
GLB   = ROOT + r"\assets\exported\characters\grokbot-b.glb"
GLBS  = ROOT + r"\assets\exported\characters\grokbot-b-seated.glb"
PNGS  = ROOT + r"\docs\gauntlet\evidence\wave2"

# ---------------------------------------------------------------- fresh scene
for o in list(D.objects): D.objects.remove(o)
for c in list(D.collections): D.collections.remove(c)
for m in list(D.meshes): D.meshes.remove(m)
for m in list(D.materials): D.materials.remove(m)
for m in list(D.cameras): D.cameras.remove(m)
for m in list(D.lights): D.lights.remove(m)
sc = bpy.context.scene
sc.unit_settings.system = 'METRIC'
sc.unit_settings.scale_length = 1.0

def new_coll(name):
    c = D.collections.new(name)
    sc.collection.children.link(c)
    return c

COL_STAND = new_coll('bot_b')
COL_SIT   = new_coll('bot_b_seated')
COL_PREV  = new_coll('preview')

# ---------------------------------------------------------------- materials
def mat(name, base, rough=0.5, metal=0.0, emit=None, es=0.0):
    m = D.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*base, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = es
    return m

GUN  = mat('gunmetal',   (0.185, 0.205, 0.235), rough=0.42, metal=0.55)
NAVY = mat('navy',       (0.095, 0.115, 0.150), rough=0.50, metal=0.30)
ORNG = mat('orange',     (0.950, 0.430, 0.060), rough=0.40, metal=0.10)
AMBR = mat('amber_glow', (1.000, 0.560, 0.090), rough=0.50,
           emit=(1.000, 0.520, 0.080), es=3.0)
VISR = mat('visor_dark', (0.070, 0.095, 0.125), rough=0.15, metal=0.20)

# ---------------------------------------------------------------- helpers
IDENT = Matrix.Identity(4)

def link(o, coll):
    for c in list(o.users_collection): c.objects.unlink(o)
    coll.objects.link(o)
    return o

def parent_keep(o, p, pm_inv=IDENT):
    """Parent to p while preserving authored world coords. pm_inv must be the
    inverse of p's INTENDED world matrix (depsgraph may be stale)."""
    o.parent = p
    o.matrix_parent_inverse = pm_inv

def _pk(o, parent):
    """parent arg may be an object (identity world) or (object, pm_inv)."""
    if isinstance(parent, tuple): parent_keep(o, parent[0], parent[1])
    else: parent_keep(o, parent)

def smooth(o):
    if o.type == 'MESH':
        for p in o.data.polygons: p.use_smooth = True

def box(name, loc, dims, m, coll, bevel=0.03, rot=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.name = name
    o.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rot: o.rotation_euler = rot
    if bevel:
        md = o.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = 2
    o.data.materials.append(m); link(o, coll)
    if parent: _pk(o, parent)
    return o

def segbox(name, p0, p1, w, dpt, m, coll, bevel=0.02, parent=None):
    """Box stretched along p0->p1 (square-ish cross-section)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0; L = d.length; mid = (p0 + p1) / 2
    bpy.ops.mesh.primitive_cube_add(size=1, location=mid)
    o = bpy.context.object; o.name = name
    o.dimensions = (w, dpt, L)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('Z', 'Y')
    if bevel:
        md = o.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = 2
    o.data.materials.append(m); link(o, coll)
    if parent: _pk(o, parent)
    return o

def seg(name, p0, p1, r0, r1, m, coll, verts=12, parent=None):
    """Tapered cylinder between points (radius1 at p0, radius2 at p1)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0; L = d.length; mid = (p0 + p1) / 2
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r0, radius2=r1,
                                    depth=L, location=mid)
    o = bpy.context.object; o.name = name
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('Z', 'Y')
    o.data.materials.append(m); link(o, coll); smooth(o)
    if parent: _pk(o, parent)
    return o

def sph(name, loc, r, m, coll, scale=(1,1,1), parent=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r, location=loc)
    o = bpy.context.object; o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(m); link(o, coll); smooth(o)
    if parent: _pk(o, parent)
    return o

def mesh_obj(name, verts, faces, m, coll, bevel=0.0, parent=None, flat=False):
    me = D.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    o = D.objects.new(name, me); coll.objects.link(o)
    me.materials.append(m)
    if not flat:
        for p in me.polygons: p.use_smooth = True
    if bevel:
        md = o.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = 2
    if parent: _pk(o, parent)
    return o

def join_into(objs, name, coll):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    act = bpy.context.object; act.name = name
    link(act, coll)
    return act

def pixel_cluster(name, tiles, m, coll, parent):
    """tiles: list of (x,y,z,sx,sy,sz) boxes joined into one emissive mesh."""
    parts = []
    for i, (x, y, z, sx, sy, sz) in enumerate(tiles):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
        o = bpy.context.object; o.name = name + '_px'
        o.dimensions = (sx, sy, sz)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        o.data.materials.append(m); link(o, coll)
        parts.append(o)
    o = join_into(parts, name, coll)
    if parent: _pk(o, parent)
    return o

# ---------------------------------------------------------------- pose data
# (dz drops torso/head/arms into the seat; limbs get explicit joint coords)
POSE = {
 'stand': dict(dz=0.0,
    shoulder=(0.41, 0.00, 0.82), elbow=(0.47, 0.03, 0.56), wrist=(0.45, 0.07, 0.38),
    hand=(0.45, 0.08, 0.29), hand_rot=(0, 0, 0),
    hip=(0.17, 0.00, 0.46), knee=(0.195, 0.03, 0.27), ankle=(0.19, 0.06, 0.14),
    foot=(0.19, 0.11, 0.075), foot_rot=(0, 0, 0), sole_z=0.025),
 'sit': dict(dz=-0.17,
    shoulder=(0.41, 0.02, 0.65), elbow=(0.48, 0.24, 0.50), wrist=(0.34, 0.43, 0.46),
    hand=(0.30, 0.49, 0.46), hand_rot=(0.35, 0, 0),
    hip=(0.17, 0.02, 0.30), knee=(0.205, 0.30, 0.27), ankle=(0.195, 0.46, 0.10),
    foot=(0.195, 0.50, 0.115), foot_rot=(0.45, 0, 0), sole_z=None),
}
ARMW, FOREW, THIGHW, SHINW = 0.15, 0.17, 0.21, 0.19   # limb thicknesses

def build(pose_name, sfx, coll):
    P = POSE[pose_name]; dz = P['dz']; sit = pose_name == 'sit'
    root = D.objects.new('grokbot_b' + ('_seated' if sfx else ''), None)
    coll.objects.link(root)
    torso = D.objects.new('torso' + sfx, None); coll.objects.link(torso); torso.parent = root
    head  = D.objects.new('head'  + sfx, None); coll.objects.link(head)
    head.parent = root; head.location = (0, 0.005, 0.88 + dz)
    HM_INV = Matrix.Translation((0, 0.005, 0.88 + dz)).inverted()

    # ---- torso ----
    box('body'+sfx,        (0, -0.02, 0.62+dz), (0.62, 0.44, 0.50), GUN,  coll, 0.10, parent=torso)
    box('hip'+sfx,         (0, -0.01, 0.42+dz), (0.50, 0.38, 0.20), GUN,  coll, 0.07, parent=torso)
    box('belt'+sfx,        (0, -0.01, 0.505+dz),(0.55, 0.405,0.085),NAVY, coll, 0.025, parent=torso)
    box('collar'+sfx,      (0,  0.00, 0.885+dz),(0.36, 0.32, 0.10), NAVY, coll, 0.03, parent=torso)
    box('chest_panel'+sfx, (0,  0.205,0.66+dz), (0.40, 0.055,0.27), NAVY, coll, 0.02, parent=torso)
    # three amber vent slats on the chest panel -> one node
    pixel_cluster('vent_glow'+sfx,
        [(x, 0.238, 0.60+dz+ i*0.055, 0.26, 0.018, 0.028)
         for i in range(3) for x in [0]], AMBR, coll, torso)
    # hazard stripes on shoulder-side torso edges
    for s, nm in ((-1, 'l'), (1, 'r')):
        box('stripe_'+nm+sfx, (s*0.315, -0.02, 0.62+dz), (0.02, 0.30, 0.30),
            ORNG, coll, 0.008, parent=torso)
    # backpack + twin exhausts = industrial heft
    box('backpack'+sfx, (0, -0.26, 0.68+dz), (0.34, 0.14, 0.34), NAVY, coll, 0.04, parent=torso)
    for s, nm in ((-1, 'l'), (1, 'r')):
        seg('exhaust_'+nm+sfx, (s*0.11, -0.30, 0.82+dz), (s*0.11, -0.32, 0.95+dz),
            0.035, 0.045, GUN, coll, 12, torso)

    # ---- head (CRT pixel-face box) ----
    box('head_box'+sfx,  (0, -0.01, 1.10+dz), (0.50, 0.42, 0.36), GUN,  coll, 0.065, parent=(head, HM_INV))
    box('visor'+sfx,     (0,  0.195,1.10+dz), (0.38, 0.05, 0.21), VISR, coll, 0.025, parent=(head, HM_INV))
    # 2x2 pixel eyes
    for s, nm in ((-1, 'l'), (1, 'r')):
        cx = s*0.095; cz = 1.125 + dz
        pixel_cluster('eye_'+nm+sfx,
            [(cx+dx, 0.226, cz+dzz, 0.042, 0.018, 0.042)
             for dx in (-0.026, 0.026) for dzz in (-0.026, 0.026)],
            AMBR, coll, (head, HM_INV))
    # pixel mouth — chunky stepped grin
    pixel_cluster('mouth'+sfx,
        [(-0.09, 0.226, 1.028+dz, 0.030, 0.018, 0.030),
         (-0.03, 0.226, 1.010+dz, 0.030, 0.018, 0.030),
         ( 0.03, 0.226, 1.010+dz, 0.030, 0.018, 0.030),
         ( 0.09, 0.226, 1.028+dz, 0.030, 0.018, 0.030)],
        AMBR, coll, (head, HM_INV))
    # ears, warning stripe, stub antenna + beacon
    for s, nm in ((-1, 'l'), (1, 'r')):
        box('ear_'+nm+sfx, (s*0.27, 0.0, 1.10+dz), (0.08, 0.18, 0.18), NAVY, coll, 0.025, parent=(head, HM_INV))
        box('ear_dot_'+nm+sfx, (s*0.315, 0.02, 1.10+dz), (0.02, 0.08, 0.08), AMBR, coll, 0.008, parent=(head, HM_INV))
    box('head_stripe'+sfx, (0, -0.01, 1.275+dz), (0.52, 0.30, 0.05), ORNG, coll, 0.02, parent=(head, HM_INV))
    seg('antenna'+sfx, (0, -0.10, 1.27+dz), (0, -0.10, 1.38+dz), 0.038, 0.030, NAVY, coll, 12, (head, HM_INV))
    box('antenna_tip'+sfx, (0, -0.10, 1.425+dz), (0.09, 0.09, 0.075), AMBR, coll, 0.02, parent=(head, HM_INV))

    # ---- arms (mitten limbs, broad shoulders) ----
    for s, nm in ((-1, 'l'), (1, 'r')):
        arm = D.objects.new('arm_'+nm+sfx, None); coll.objects.link(arm); arm.parent = root
        Sh = Vector((s*P['shoulder'][0], P['shoulder'][1], P['shoulder'][2]))
        El = Vector((s*P['elbow'][0],    P['elbow'][1],    P['elbow'][2]))
        Wr = Vector((s*P['wrist'][0],    P['wrist'][1],    P['wrist'][2]))
        Hd = Vector((s*P['hand'][0],     P['hand'][1],     P['hand'][2]))
        box('shoulder_'+nm+sfx, Sh + Vector((s*0.02, 0, 0.04)), (0.22, 0.26, 0.22),
            ORNG, coll, 0.05, parent=arm)
        segbox('upperarm_'+nm+sfx, Sh+Vector((0,0,-0.02)), El, ARMW, ARMW, NAVY, coll, 0.03, arm)
        box('elbow_'+nm+sfx, El, (0.16, 0.16, 0.14), GUN, coll, 0.04, parent=arm)
        segbox('forearm_'+nm+sfx, El+Vector((0,0,-0.02)), Wr, FOREW, FOREW, NAVY, coll, 0.035, arm)
        box('cuff_'+nm+sfx, Wr+Vector((0,0,0.015)), (0.19, 0.19, 0.09), ORNG, coll, 0.03, parent=arm)
        box('hand_'+nm+sfx, Hd, (0.17, 0.19, 0.15), GUN, coll, 0.05, rot=P['hand_rot'], parent=arm)
        box('thumb_'+nm+sfx, Hd+Vector((-s*0.09, 0.06, 0.01)), (0.07, 0.09, 0.08),
            GUN, coll, 0.025, rot=P['hand_rot'], parent=arm)

    # ---- legs (short, thick, wide stance) ----
    for s, nm in ((-1, 'l'), (1, 'r')):
        leg = D.objects.new('leg_'+nm+sfx, None); coll.objects.link(leg); leg.parent = root
        Hp = Vector((s*P['hip'][0],   P['hip'][1],   P['hip'][2]))
        Kn = Vector((s*P['knee'][0],  P['knee'][1],  P['knee'][2]))
        An = Vector((s*P['ankle'][0], P['ankle'][1], P['ankle'][2]))
        Ft = Vector((s*P['foot'][0],  P['foot'][1],  P['foot'][2]))
        box('hipj_'+nm+sfx, Hp, (0.19, 0.19, 0.16), NAVY, coll, 0.05, parent=leg)
        segbox('thigh_'+nm+sfx, Hp+Vector((0,0,-0.02)), Kn, THIGHW, THIGHW, NAVY, coll, 0.045, leg)
        box('knee_'+nm+sfx, Kn+Vector((0,0.045,0)), (0.21, 0.16, 0.14), ORNG, coll, 0.04, parent=leg)
        segbox('shin_'+nm+sfx, Kn+Vector((0,0,-0.02)), An, SHINW, SHINW, NAVY, coll, 0.04, leg)
        box('foot_'+nm+sfx, Ft, (0.27, 0.38, 0.14), GUN, coll, 0.045, rot=P['foot_rot'], parent=leg)
        if sit:
            off = Vector((0, 0.02, -0.055)).copy()
            off.rotate(Matrix.Rotation(P['foot_rot'][0], 4, 'X'))
            box('sole_'+nm+sfx, Ft+off, (0.28, 0.36, 0.05), ORNG, coll, 0.02,
                rot=P['foot_rot'], parent=leg)
        else:
            box('sole_'+nm+sfx, Ft+Vector((0,0.01,-0.058)), (0.29, 0.40, 0.05),
                ORNG, coll, 0.02, parent=leg)
    return root

build('stand', '', COL_STAND)
build('sit', '_seat', COL_SIT)

# mesh datablock names follow object names (shared none — each pose owns its meshes)
for o in D.objects:
    if o.type == 'MESH' and o.data.name != o.name:
        o.data.name = o.name

# ---------------------------------------------------------------- preview rig
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -0.001))
gnd = bpy.context.object; gnd.name = 'preview_ground'; link(gnd, COL_PREV)
pm = D.materials.new('preview_mat'); pm.use_nodes = True
pb = pm.node_tree.nodes['Principled BSDF']
pb.inputs['Base Color'].default_value = (0.82, 0.82, 0.85, 1)
pb.inputs['Roughness'].default_value = 0.9
gnd.data.materials.append(pm)

cam_d = D.cameras.new('Camera'); cam = D.objects.new('Camera', cam_d)
COL_PREV.objects.link(cam); sc.camera = cam
sun_d = D.lights.new('Sun', 'SUN'); sun_d.energy = 4.0
sun = D.objects.new('Sun', sun_d); COL_PREV.objects.link(sun)
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(30))

w = D.worlds.get('World') or D.worlds.new('World')
sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.9, 0.9, 0.92, 1)
w.node_tree.nodes['Background'].inputs[1].default_value = 0.6

def aim(cam, target, loc=(2.6, 3.0, 1.8), lens=58):
    cam.location = loc
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens

def render(path, target=(0, 0.1, 0.7)):
    try: sc.render.engine = 'BLENDER_EEVEE_NEXT'
    except Exception: sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x = sc.render.resolution_y = 800
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = path
    aim(cam, target)
    bpy.ops.render.render(write_still=True)
    print('RENDERED', path)

os.makedirs(PNGS, exist_ok=True)
lc = bpy.context.view_layer.layer_collection
lc.children['bot_b_seated'].exclude = True
render(PNGS + r'\grokbot-b_preview.png')
lc.children['bot_b_seated'].exclude = False
lc.children['bot_b'].exclude = True
render(PNGS + r'\grokbot-b-seated_preview.png', target=(0, 0.15, 0.6))
lc.children['bot_b'].exclude = False

# ---------------------------------------------------------------- exports
os.makedirs(os.path.dirname(GLB), exist_ok=True)

def select_hierarchy(root):
    bpy.ops.object.select_all(action='DESELECT')
    def sel(o):
        o.select_set(True)
        for k in o.children: sel(k)
    sel(root)

def hierarchy(root):
    out = []
    def w(o):
        out.append(o)
        for c in o.children: w(c)
    w(root); return out

# standing GLB — canonical node names
select_hierarchy(D.objects['grokbot_b'])
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True, export_animations=False)
print('EXPORTED', GLB, os.path.getsize(GLB), 'bytes')

# seated GLB — rename dance so nodes keep canonical names
stand_objs = hierarchy(D.objects['grokbot_b'])[1:]
seat_objs  = hierarchy(D.objects['grokbot_b_seated'])[1:]
for o in stand_objs:
    o.name = o.name + '_park'
    if o.type == 'MESH': o.data.name = o.name
for o in seat_objs:
    assert o.name.endswith('_seat'), o.name
    o.name = o.name[:-5]
    if o.type == 'MESH': o.data.name = o.name
select_hierarchy(D.objects['grokbot_b_seated'])
bpy.ops.export_scene.gltf(filepath=GLBS, export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True, export_animations=False)
print('EXPORTED', GLBS, os.path.getsize(GLBS), 'bytes')
for o in seat_objs:
    o.name = o.name + '_seat'
    if o.type == 'MESH': o.data.name = o.name
for o in stand_objs:
    o.name = o.name[:-5]
    if o.type == 'MESH': o.data.name = o.name

bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print('SAVED', bpy.data.filepath)
print('BOT B DONE')
