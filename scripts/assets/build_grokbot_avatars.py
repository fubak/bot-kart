"""Build Grok Bot avatars — characters remodeled after the xAI Grok Bot icon:
huge white dome head + two tall black oval eyes (inward-tilted tops), white
pod body with dark joints and a small X emblem on the back of the dome.

Three seated variants share the dome/eye identity; bodies differentiate:
  A = hero/player (antenna + glow tip, cyan accent)
  B = heavy rival (shoulder pods, chest vents, orange accent)
  C = speed rival (swept head fin, slim, violet accent)

Run inside Blender (MCP execute_blender_code):  exec(open(<this file>).read())
Exports:  grokbot-a.glb, grokbot-b-seated.glb, grokbot-c-seated.glb
Saves:    assets/blender/characters/grokbot-avatars.blend
Conventions (match build_grokbot_b.py / ADR-002):
  1 unit = 1 m, Blender +Y = character forward (exports to glTF -Z), +Z up.
  Seated origin at seat base. Rig nodes: head/arm_l/arm_r/leg_l/leg_r empties,
  eye_l/eye_r meshes under head (blink squash = local Y = Blender Z up).
"""
import bpy, math, os
from bpy import data as D
from mathutils import Vector, Matrix

ROOT  = r"C:\github\bot-kart"
BLEND = ROOT + r"\assets\blender\characters\grokbot-avatars.blend"
EXPORTS = {
    'a': ROOT + r"\assets\exported\characters\grokbot-a.glb",
    'b': ROOT + r"\assets\exported\characters\grokbot-b-seated.glb",
    'c': ROOT + r"\assets\exported\characters\grokbot-c-seated.glb",
}
PNGS = ROOT + r"\docs\gauntlet\evidence\avatars"

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

COL_A = new_coll('avatar_a')
COL_B = new_coll('avatar_b')
COL_C = new_coll('avatar_c')
COL_PREV = new_coll('preview')

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
    m.diffuse_color = (*base, 1)
    return m

SHELL = mat('shell',     (0.93, 0.94, 0.96), rough=0.32)            # white gloss
JOINT = mat('joint',     (0.10, 0.11, 0.14), rough=0.50)            # dark joints/trim
EYE   = mat('eye_lens',  (0.015, 0.017, 0.025), rough=0.15)         # 'lens' → untinted
# Variant accents (saturated — hue-shift with team tint in-game)
ACC_A = mat('accent_a',  (0.25, 0.75, 1.00), rough=0.40)
ACC_B = mat('accent_b',  (1.00, 0.55, 0.15), rough=0.40)
ACC_C = mat('accent_c',  (0.70, 0.40, 1.00), rough=0.40)
TIP   = mat('tip_glow',  (0.30, 0.85, 1.00), rough=0.40,
            emit=(0.30, 0.85, 1.00), es=4.0)                        # antenna beacon

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

def sph(name, loc, r, m, coll, scale=(1,1,1), parent=None, sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc)
    o = bpy.context.object; o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(m); link(o, coll); smooth(o)
    if parent: _pk(o, parent)
    return o

def eye_oval(name, loc, tilt_z, m, coll, parent):
    """Tall black oval on the dome face. Tilt (about +Y forward axis) baked
    into the geometry so the node rotation stays identity — the game's blink
    squashes node.scale.y (glTF up = Blender Z) cleanly vertical."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0, location=loc)
    o = bpy.context.object; o.name = name
    o.scale = (0.075, 0.035, 0.135)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # rotate about the forward (Y) axis at the eye's own location
    o.rotation_euler = (0, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o.rotation_euler = (0, tilt_z, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o.data.materials.append(m); link(o, coll); smooth(o)
    if parent: _pk(o, parent)
    return o

def x_emblem(name, center, size, thick, m, coll, parent, tilt_x=0.0):
    """Two crossed thin bars — the xAI 'X' — as one mesh, parented."""
    parts = []
    for ang in (math.radians(45), math.radians(-45)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=center)
        o = bpy.context.object; o.name = name + '_p'
        o.dimensions = (size * 1.6, thick, size * 0.38)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        o.rotation_euler = (tilt_x, ang, 0)
        o.data.materials.append(m); link(o, coll)
        parts.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.object; o.name = name
    if parent: _pk(o, parent)
    return o

# ---------------------------------------------------------------- skeleton
# Seated: seat base at z=0. Head pivot low — the dome is the identity.
HEAD_PIVOT = (0, -0.01, 0.55)
DOME_C = (0, -0.03, 0.88)          # dome center
DOME_R = 0.30                      # big avatar dome
# Joints (right side mirrored from left; +Y forward)
SH   = (0.24, 0.02, 0.50)          # shoulder pivot (arm_l/r empty)
EL   = (0.28, 0.20, 0.40)          # elbow
WR   = (0.22, 0.36, 0.40)          # wrist
HD   = (0.17, 0.44, 0.42)          # hand — on the wheel
HP   = (0.13, 0.01, 0.24)          # hip pivot (leg_l/r empty)
KN   = (0.15, 0.28, 0.22)          # knee
FT   = (0.16, 0.46, 0.09)          # foot — on the pedal

def build(tag, coll, accent, heavy=False, fin=False, antenna=False):
    root = D.objects.new('grokbot_' + tag, None); coll.objects.link(root)
    torso = D.objects.new('torso', None); coll.objects.link(torso); torso.parent = root
    head = D.objects.new('head', None); coll.objects.link(head)
    head.parent = root; head.location = HEAD_PIVOT
    HM_INV = Matrix.Translation(HEAD_PIVOT).inverted()
    HP_ = (head, HM_INV)

    arm_r = 0.075 if not heavy else 0.095   # limb thickness
    sho_r = 0.10  if not heavy else 0.13

    # ---- torso pod ----
    sph('pelvis',   (0, 0.01, 0.20), 0.19, JOINT, coll, scale=(1.15, 0.95, 0.75), parent=torso)
    sph('pod',      (0, -0.01, 0.40), 0.24, SHELL, coll, scale=(1.05, 0.85, 1.0), parent=torso)
    # neck collar ring under the dome
    bpy.ops.mesh.primitive_torus_add(major_radius=0.13, minor_radius=0.035,
        major_segments=16, minor_segments=8, location=(0, -0.01, 0.60))
    collar = bpy.context.object; collar.name = 'collar'
    collar.data.materials.append(JOINT); link(collar, coll); smooth(collar)
    _pk(collar, torso)
    # chest accent bar + center glow dot
    box('chest_bar', (0, 0.195, 0.45), (0.20, 0.035, 0.045), accent, coll, 0.015, parent=torso)
    sph('chest_dot', (0, 0.215, 0.52), 0.035, accent, coll, parent=torso)
    # back panel
    box('back_panel', (0, -0.225, 0.42), (0.26, 0.05, 0.22), JOINT, coll, 0.03, parent=torso)
    if heavy:
        # three dark vent slats under the chest bar
        for i in range(3):
            box(f'vent_{i}', (0, 0.20, 0.36 - i * 0.05), (0.22, 0.03, 0.025),
                JOINT, coll, 0.008, parent=torso)

    # ---- head: THE dome ----
    sph('dome', DOME_C, DOME_R, SHELL, coll,
        scale=(1.0, 0.96, 1.02), parent=HP_, sub=3)
    # chin skirt — dark ring where the dome meets the collar
    bpy.ops.mesh.primitive_torus_add(major_radius=0.24, minor_radius=0.03,
        major_segments=20, minor_segments=8, location=(0, -0.03, 0.665))
    chin = bpy.context.object; chin.name = 'chin_ring'
    chin.data.materials.append(JOINT); link(chin, coll); smooth(chin)
    _pk(chin, HP_)
    # signature eyes — tall black ovals, tops tilted toward center
    for s, nm in ((-1, 'l'), (1, 'r')):
        eye_oval(f'eye_{nm}', (s * 0.105, 0.245, 0.90), -s * 0.18, EYE, coll, HP_)
    # side ear pods — small dark discs on the dome
    for s, nm in ((-1, 'l'), (1, 'r')):
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.055, depth=0.035,
            location=(s * 0.295, -0.03, 0.90), rotation=(0, math.radians(90), 0))
        e = bpy.context.object; e.name = f'ear_{nm}'
        e.data.materials.append(JOINT); link(e, coll); smooth(e)
        _pk(e, HP_)
        # tiny accent status dot on each ear
        sph(f'ear_dot_{nm}', (s * 0.315, -0.03, 0.90), 0.02, accent, coll, parent=HP_)
    # X emblem on the dome back — visible from the chase cam
    x_emblem('x_mark', (0, -0.315, 0.93), 0.14, 0.025, JOINT, coll, HP_, tilt_x=0.35)

    if antenna:
        seg('antenna', (0, -0.12, 1.14), (0, -0.16, 1.33), 0.022, 0.014,
            JOINT, coll, 10, HP_)
        sph('antenna_tip', (0, -0.165, 1.35), 0.038, TIP, coll, parent=HP_)
    if fin:
        # swept wedge on the dome crown, accent leading edge
        fin_v = [(-0.015, -0.04, 1.12), (0.015, -0.04, 1.12),      # base front
                 (-0.015, -0.30, 1.06), (0.015, -0.30, 1.06),      # base back
                 (-0.015, -0.22, 1.24), (0.015, -0.22, 1.24)]      # top back
        me = D.meshes.new('fin_top'); me.from_pydata(fin_v, [], [
            (0, 2, 4), (1, 5, 3), (0, 1, 3, 2), (2, 3, 5, 4), (0, 4, 5, 1)])
        me.update()
        fo = D.objects.new('fin_top', me); coll.objects.link(fo)
        me.materials.append(SHELL)
        for p in me.polygons: p.use_smooth = False
        _pk(fo, HP_)
        seg('fin_edge', (-0.0, -0.05, 1.125), (-0.0, -0.235, 1.245), 0.022, 0.022,
            accent, coll, 8, HP_)

    # ---- arms (capsule limbs, mitten hands on the wheel) ----
    for s, nm in ((-1, 'l'), (1, 'r')):
        arm = D.objects.new('arm_' + nm, None); coll.objects.link(arm); arm.parent = root
        arm.location = (s * SH[0], SH[1], SH[2])
        AM_INV = Matrix.Translation(arm.location).inverted()
        AP_ = (arm, AM_INV)
        Sh = Vector((s * SH[0], SH[1], SH[2]))
        El = Vector((s * EL[0], EL[1], EL[2]))
        Wr = Vector((s * WR[0], WR[1], WR[2]))
        Hd = Vector((s * HD[0], HD[1], HD[2]))
        sph(f'shoulder_{nm}', Sh + Vector((s * 0.015, 0, 0.01)), sho_r, SHELL, coll, parent=AP_)
        seg(f'upperarm_{nm}', Sh, El, arm_r, arm_r * 0.9, SHELL, coll, 12, AP_)
        sph(f'elbow_{nm}', El, arm_r * 1.15, JOINT, coll, parent=AP_)
        seg(f'forearm_{nm}', El, Wr, arm_r * 0.9, arm_r * 0.8, SHELL, coll, 12, AP_)
        # accent wrist cuff ring
        bpy.ops.mesh.primitive_torus_add(major_radius=arm_r * 0.8, minor_radius=0.016,
            major_segments=12, minor_segments=6, location=Wr)
        cuff = bpy.context.object; cuff.name = f'cuff_{nm}'
        d = Hd - Wr
        cuff.rotation_mode = 'QUATERNION'
        cuff.rotation_quaternion = d.to_track_quat('Z', 'Y')
        cuff.data.materials.append(accent); link(cuff, coll); smooth(cuff)
        _pk(cuff, AP_)
        sph(f'hand_{nm}', Hd, 0.095, SHELL, coll, scale=(0.9, 1.15, 0.85), parent=AP_)
        if heavy:
            # squared shoulder pod over the joint
            box(f'shoulderpad_{nm}', Sh + Vector((s * 0.05, -0.01, 0.05)),
                (0.16, 0.24, 0.14), SHELL, coll, 0.05, parent=AP_)
            box(f'padstripe_{nm}', Sh + Vector((s * 0.05, 0.10, 0.05)),
                (0.17, 0.03, 0.05), accent, coll, 0.01, parent=AP_)

    # ---- legs (seated: thighs forward, shins to pedals) ----
    for s, nm in ((-1, 'l'), (1, 'r')):
        leg = D.objects.new('leg_' + nm, None); coll.objects.link(leg); leg.parent = root
        leg.location = (s * HP[0], HP[1], HP[2])
        LG_INV = Matrix.Translation(leg.location).inverted()
        LP_ = (leg, LG_INV)
        Hp = Vector((s * HP[0], HP[1], HP[2]))
        Kn = Vector((s * KN[0], KN[1], KN[2]))
        Ft = Vector((s * FT[0], FT[1], FT[2]))
        sph(f'hipj_{nm}', Hp, 0.09, JOINT, coll, parent=LP_)
        seg(f'thigh_{nm}', Hp, Kn, 0.085 if not heavy else 0.10, 0.075 if not heavy else 0.09,
            SHELL, coll, 12, LP_)
        sph(f'knee_{nm}', Kn, 0.085 if not heavy else 0.10, SHELL, coll, parent=LP_)
        sph(f'knee_dot_{nm}', Kn + Vector((0, 0.075, 0.01)), 0.028, accent, coll, parent=LP_)
        seg(f'shin_{nm}', Kn, Ft + Vector((0, -0.03, 0.05)), 0.07, 0.06, SHELL, coll, 12, LP_)
        # rounded boot + dark sole
        sph(f'foot_{nm}', Ft, 0.10, SHELL, coll, scale=(0.85, 1.3, 0.65),
            parent=LP_)
        sph(f'sole_{nm}', Ft + Vector((0, 0.01, -0.045)), 0.09, JOINT, coll,
            scale=(0.8, 1.25, 0.4), parent=LP_)
    return root

root_a = build('a', COL_A, ACC_A, antenna=True)
root_b = build('b_seated', COL_B, ACC_B, heavy=True)
root_c = build('c_seated', COL_C, ACC_C, fin=True)

# park the three variants side-by-side for a preview line-up
root_b.location = (1.1, 0, 0)
root_c.location = (2.2, 0, 0)

# mesh datablock names follow object names
for o in D.objects:
    if o.type == 'MESH' and o.data.name != o.name:
        o.data.name = o.name

# ---------------------------------------------------------------- preview rig
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -0.001))
gnd = bpy.context.object; gnd.name = 'preview_ground'; link(gnd, COL_PREV)
pm = D.materials.new('preview_mat'); pm.use_nodes = True
pb = pm.node_tree.nodes['Principled BSDF']
pb.inputs['Base Color'].default_value = (0.16, 0.17, 0.20, 1)
pb.inputs['Roughness'].default_value = 0.9
gnd.data.materials.append(pm)

cam_d = D.cameras.new('Camera'); cam = D.objects.new('Camera', cam_d)
COL_PREV.objects.link(cam); sc.camera = cam
sun_d = D.lights.new('Sun', 'SUN'); sun_d.energy = 4.0
sun = D.objects.new('Sun', sun_d); COL_PREV.objects.link(sun)
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(30))

w = D.worlds.get('World') or D.worlds.new('World')
sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.35, 0.37, 0.42, 1)
w.node_tree.nodes['Background'].inputs[1].default_value = 0.7

def aim(cam, target, loc, lens=58):
    cam.location = loc
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens

def render(path, target, loc):
    try: sc.render.engine = 'BLENDER_EEVEE_NEXT'
    except Exception: sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x = 1200; sc.render.resolution_y = 700
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = path
    aim(cam, target, loc)
    bpy.ops.render.render(write_still=True)
    print('RENDERED', path)

os.makedirs(PNGS, exist_ok=True)
# front 3/4 line-up + close-up of the face
render(PNGS + r'\avatars_lineup.png', (1.1, 0.1, 0.55), (1.1, 3.2, 1.3), )
render(PNGS + r'\avatar_a_face.png', (0, 0.0, 0.85), (0.65, 1.6, 1.15))
# back view — check the X emblem reads
render(PNGS + r'\avatars_back.png', (1.1, -0.1, 0.7), (1.1, -2.6, 1.5))

# ---------------------------------------------------------------- exports
def select_hierarchy(root):
    bpy.ops.object.select_all(action='DESELECT')
    def sel(o):
        o.select_set(True)
        for k in o.children_recursive: sel(k)
    sel(root)

os.makedirs(os.path.dirname(EXPORTS['a']), exist_ok=True)

# Three variants share one scene → Blender dedupes object names (.001, .002).
# Before each export: park the OTHER hierarchies' objects under unique names,
# strip the .NNN suffixes on the exporting one — GLB nodes land canonical.
import re
def base_name(n):
    # strip Blender .NNN dedup suffix AND any prior __tag parking suffix
    return re.sub(r'(\.\d+)?(__.*)?$', '', n)

def hierarchy(root):
    out = []
    def w(o):
        out.append(o)
        for c in o.children_recursive: w(c)
    w(root); return out

roots = {'a': root_a, 'b': root_b, 'c': root_c}
hier = {t: hierarchy(r) for t, r in roots.items()}
for tag, root in roots.items():
    root.location = (0, 0, 0)          # export at origin
    for ot, objs in hier.items():
        if ot == tag: continue
        for o in objs:
            o.name = base_name(o.name) + '__' + ot
            if o.type == 'MESH': o.data.name = o.name
    for o in hier[tag]:
        o.name = base_name(o.name)
        if o.type == 'MESH': o.data.name = o.name
    select_hierarchy(root)
    bpy.ops.export_scene.gltf(filepath=EXPORTS[tag], export_format='GLB',
                              use_selection=True, export_apply=True,
                              export_yup=True, export_animations=False)
    print('EXPORTED', EXPORTS[tag], os.path.getsize(EXPORTS[tag]), 'bytes')

# restore the line-up parking for a tidy source file
root_a.location = (0, 0, 0)
root_b.location = (1.1, 0, 0)
root_c.location = (2.2, 0, 0)

bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print('SAVED', bpy.data.filepath)
print('AVATARS DONE')
