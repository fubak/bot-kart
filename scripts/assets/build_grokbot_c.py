"""Build Grok Bot C — speed rival (wedge/teardrop vocabulary, fin antennae).

Run inside Blender (MCP execute_blender_code):  exec(open(<this file>).read())
Creates:  standing hierarchy `grokbot_c` + seated variant `grokbot_c_seated`
          in collections `bot_c` / `bot_c_seated`, a `preview` collection,
          exports both GLBs, renders previews, saves the .blend.
Conventions (match bot-a.blend / ADR-002):
  1 unit = 1 m, Blender +Y = character forward (exports to glTF -Z), +Z up.
"""
import bpy, bmesh, math, os
from bpy import data as D
from mathutils import Vector, Matrix

ROOT  = r"C:\github\bot-kart"
BLEND = ROOT + r"\assets\blender\characters\grokbot-c.blend"
GLB   = ROOT + r"\assets\exported\characters\grokbot-c.glb"
GLBS  = ROOT + r"\assets\exported\characters\grokbot-c-seated.glb"
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

COL_STAND = new_coll('bot_c')
COL_SIT   = new_coll('bot_c_seated')
COL_PREV  = new_coll('preview')

# ---------------------------------------------------------------- materials
def mat(name, base, rough=0.5, metal=0.0, emit=None, es=0.0, vp=None):
    m = D.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*base, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = es
    m.diffuse_color = vp or (*base, 1)          # viewport display color
    return m

PRL  = mat('pearl',        (0.930, 0.930, 0.965), rough=0.32, metal=0.25)
VIOL = mat('violet',       (0.430, 0.200, 0.720), rough=0.40, metal=0.20)
GRA  = mat('graphite',     (0.115, 0.125, 0.155), rough=0.50, metal=0.30)
MGNT = mat('magenta_glow', (0.950, 0.220, 0.760), rough=0.50,
           emit=(0.950, 0.200, 0.780), es=3.0)
VISR = mat('visor_dark',   (0.070, 0.095, 0.125), rough=0.15, metal=0.20)

# ---------------------------------------------------------------- helpers
IDENT = Matrix.Identity(4)

def link(o, coll):
    for c in list(o.users_collection): c.objects.unlink(o)
    coll.objects.link(o)
    return o

def parent_keep(o, p, pm_inv=IDENT):
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

def sph(name, loc, r, m, coll, scale=(1,1,1), parent=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r, location=loc)
    o = bpy.context.object; o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(m); link(o, coll); smooth(o)
    if parent: _pk(o, parent)
    return o

def mesh_obj(name, verts, faces, m, coll, bevel=0.0, parent=None, flat=False):
    me = D.meshes.new(name); me.from_pydata(verts, [], faces)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free(); me.update()
    o = D.objects.new(name, me); coll.objects.link(o)
    me.materials.append(m)
    if not flat:
        for p in me.polygons: p.use_smooth = True
    if bevel:
        md = o.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = 2
    if parent: _pk(o, parent)
    return o

def fuselage(name, rings, nseg, m, coll, parent=None, bevel=0.0):
    """Swept elliptical-ring loft. rings: (z, rx, ry, y_off) bottom -> top."""
    verts, faces = [], []
    for (z, rx, ry, yo) in rings:
        for i in range(nseg):
            a = 2 * math.pi * i / nseg
            verts.append((rx * math.cos(a), yo + ry * math.sin(a), z))
    nr = len(rings)
    for r in range(nr - 1):
        for i in range(nseg):
            j = (i + 1) % nseg
            faces.append((r*nseg+i, r*nseg+j, (r+1)*nseg+j, (r+1)*nseg+i))
    faces.append(tuple(range(nseg - 1, -1, -1)))
    faces.append(tuple((nr - 1) * nseg + i for i in range(nseg)))
    return mesh_obj(name, verts, faces, m, coll, bevel, parent)

def fin(name, p0, p1, tip, th, m, coll, parent=None):
    """Thin triangular blade: base edge p0->p1, apex tip, thickness th on X."""
    p0, p1, tip = Vector(p0), Vector(p1), Vector(tip)
    o = th / 2
    v = [p0 + Vector((-o,0,0)), p0 + Vector((o,0,0)),
         p1 + Vector((-o,0,0)), p1 + Vector((o,0,0)),
         tip + Vector((-o,0,0)), tip + Vector((o,0,0))]
    f = [(0,2,4), (1,5,3), (0,1,3,2), (2,3,5,4), (4,5,1,0)]
    return mesh_obj(name, v, f, m, coll, 0.008, parent, flat=True)

# ---------------------------------------------------------------- pose data
POSE = {
 'stand': dict(dz=0.0,
    shoulder=(0.27, 0.00, 0.85), elbow=(0.31, 0.03, 0.62), wrist=(0.30, 0.08, 0.42),
    hand=(0.30, 0.11, 0.375), hand_rot=(0, 0, 0),
    hip=(0.11, 0.00, 0.47), knee=(0.13, 0.03, 0.28), ankle=(0.13, 0.06, 0.10),
    foot=(0.13, 0.12, 0.045), foot_rot=(0, 0, 0)),
 'sit': dict(dz=-0.15,
    shoulder=(0.27, 0.02, 0.70), elbow=(0.33, 0.24, 0.55), wrist=(0.24, 0.44, 0.50),
    hand=(0.21, 0.50, 0.49), hand_rot=(0.35, 0, 0),
    hip=(0.11, 0.02, 0.30), knee=(0.14, 0.30, 0.28), ankle=(0.135, 0.47, 0.10),
    foot=(0.135, 0.52, 0.115), foot_rot=(0.45, 0, 0)),
}

def build(pose_name, sfx, coll):
    P = POSE[pose_name]; dz = P['dz']
    root = D.objects.new('grokbot_c' + ('_seated' if sfx else ''), None)
    coll.objects.link(root)
    torso = D.objects.new('torso' + sfx, None); coll.objects.link(torso); torso.parent = root
    head  = D.objects.new('head'  + sfx, None); coll.objects.link(head)
    head.parent = root; head.location = (0, 0.0, 0.92 + dz)
    HM_INV = Matrix.Translation((0, 0.0, 0.92 + dz)).inverted()
    HP = (head, HM_INV)

    # ---- torso: swept teardrop fuselage ----
    fuselage('body'+sfx, [
        (0.40, 0.075, 0.062, -0.020),
        (0.50, 0.130, 0.105, -0.010),
        (0.62, 0.185, 0.140,  0.005),
        (0.78, 0.195, 0.135,  0.000),
        (0.88, 0.160, 0.112, -0.020),
        (0.95, 0.100, 0.080, -0.055),
        (0.99, 0.048, 0.042, -0.085),
    ], 14, PRL, coll, parent=torso)
    box('hip'+sfx,    (0, -0.01, 0.395+dz), (0.22, 0.18, 0.12), PRL,  coll, 0.04, parent=torso)
    box('belt'+sfx,   (0, -0.02, 0.455+dz), (0.28, 0.22, 0.055), VIOL, coll, 0.02, parent=torso)
    box('collar'+sfx, (0, -0.05, 0.935+dz), (0.15, 0.13, 0.06),  VIOL, coll, 0.02, parent=torso)
    # magenta chest chevron + violet flank blades
    box('chest_glow'+sfx, (0, 0.150, 0.72+dz), (0.15, 0.022, 0.034), MGNT, coll, 0.008,
        rot=(-0.25, 0, 0), parent=torso)
    for s, nm in ((-1, 'l'), (1, 'r')):
        box('stripe_'+nm+sfx, (s*0.150, -0.02, 0.70+dz), (0.018, 0.20, 0.22),
            VIOL, coll, 0.006, rot=(0, s*0.22, 0), parent=torso)

    # ---- head: angular wedge + slit visor + swept fins ----
    hv = [(-0.115, 0.185, 1.005+dz), ( 0.115, 0.185, 1.005+dz),
          ( 0.115, 0.160, 1.095+dz), (-0.115, 0.160, 1.095+dz),
          (-0.135,-0.150, 0.985+dz), ( 0.135,-0.150, 0.985+dz),
          ( 0.090,-0.170, 1.245+dz), (-0.090,-0.170, 1.245+dz)]
    hf = [(0,1,2,3), (5,4,7,6), (4,5,1,0), (4,0,3,7), (1,5,6,2), (3,2,6,7)]
    mesh_obj('head_shell'+sfx, hv, hf, PRL, coll, 0.025, HP)
    box('visor'+sfx,    (0, 0.188, 1.050+dz), (0.20, 0.035, 0.052), VISR, coll, 0.012,
        rot=(-0.25, 0, 0), parent=HP)
    box('eye_band'+sfx, (0, 0.206, 1.052+dz), (0.16, 0.014, 0.018), MGNT, coll, 0.005,
        rot=(-0.25, 0, 0), parent=HP)
    # twin antenna fins swept off the head sides + dorsal blade
    for s, nm in ((-1, 'l'), (1, 'r')):
        fin('fin_'+nm+sfx,
            (s*0.10, 0.04, 1.10+dz), (s*0.095, -0.10, 1.19+dz),
            (s*0.075, -0.33, 1.33+dz), 0.02, VIOL, coll, HP)
    fin('fin_top'+sfx,
        (0, 0.06, 1.13+dz), (0, -0.12, 1.26+dz),
        (0, -0.30, 1.42+dz), 0.024, VIOL, coll, HP)

    # ---- arms: slim, blade pauldrons ----
    for s, nm in ((-1, 'l'), (1, 'r')):
        arm = D.objects.new('arm_'+nm+sfx, None); coll.objects.link(arm); arm.parent = root
        Sh = Vector((s*P['shoulder'][0], P['shoulder'][1], P['shoulder'][2]))
        El = Vector((s*P['elbow'][0],    P['elbow'][1],    P['elbow'][2]))
        Wr = Vector((s*P['wrist'][0],    P['wrist'][1],    P['wrist'][2]))
        Hd = Vector((s*P['hand'][0],     P['hand'][1],     P['hand'][2]))
        box('shoulder_'+nm+sfx, Sh+Vector((s*0.03, 0, 0.03)), (0.14, 0.22, 0.055),
            VIOL, coll, 0.015, rot=(0, -s*0.5, 0), parent=arm)
        seg('upperarm_'+nm+sfx, Sh, El, 0.050, 0.042, PRL, coll, 10, arm)
        sph('elbow_'+nm+sfx, El, 0.050, GRA, coll, parent=arm)
        seg('forearm_'+nm+sfx, El, Wr, 0.045, 0.038, PRL, coll, 10, arm)
        box('blade_'+nm+sfx, El.lerp(Wr, 0.55)+Vector((s*0.045, 0.01, 0)),
            (0.018, 0.13, 0.10), VIOL, coll, 0.006,
            rot=(0, -s*0.25, 0), parent=arm)
        box('hand_'+nm+sfx, Hd, (0.075, 0.15, 0.065), GRA, coll, 0.025,
            rot=P['hand_rot'], parent=arm)

    # ---- legs: slim, pointed knees, blade feet ----
    for s, nm in ((-1, 'l'), (1, 'r')):
        leg = D.objects.new('leg_'+nm+sfx, None); coll.objects.link(leg); leg.parent = root
        Hp = Vector((s*P['hip'][0],   P['hip'][1],   P['hip'][2]))
        Kn = Vector((s*P['knee'][0],  P['knee'][1],  P['knee'][2]))
        An = Vector((s*P['ankle'][0], P['ankle'][1], P['ankle'][2]))
        Ft = Vector((s*P['foot'][0],  P['foot'][1],  P['foot'][2]))
        sph('hipj_'+nm+sfx, Hp, 0.065, GRA, coll, parent=leg)
        seg('thigh_'+nm+sfx, Hp, Kn, 0.068, 0.055, PRL, coll, 12, leg)
        box('knee_'+nm+sfx, Kn+Vector((0, 0.05, 0)), (0.10, 0.11, 0.08),
            VIOL, coll, 0.025, rot=(-0.35, 0, 0), parent=leg)
        seg('shin_'+nm+sfx, Kn, An, 0.050, 0.038, PRL, coll, 10, leg)
        box('foot_'+nm+sfx, Ft, (0.105, 0.30, 0.065), GRA, coll, 0.025,
            rot=P['foot_rot'], parent=leg)
        # sole follows foot tilt
        off = Vector((0, 0.02, -0.040))
        off.rotate(Matrix.Rotation(P['foot_rot'][0], 4, 'X'))
        box('sole_'+nm+sfx, Ft+off, (0.11, 0.28, 0.022), VIOL, coll, 0.008,
            rot=P['foot_rot'], parent=leg)
    return root

build('stand', '', COL_STAND)
build('sit', '_seat', COL_SIT)

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
lc.children['bot_c_seated'].exclude = True
render(PNGS + r'\grokbot-c_preview.png')
lc.children['bot_c_seated'].exclude = False
lc.children['bot_c'].exclude = True
render(PNGS + r'\grokbot-c-seated_preview.png', target=(0, 0.15, 0.6))
lc.children['bot_c'].exclude = False

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

select_hierarchy(D.objects['grokbot_c'])
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True, export_animations=False)
print('EXPORTED', GLB, os.path.getsize(GLB), 'bytes')

stand_objs = hierarchy(D.objects['grokbot_c'])[1:]
seat_objs  = hierarchy(D.objects['grokbot_c_seated'])[1:]
for o in stand_objs:
    o.name = o.name + '_park'
    if o.type == 'MESH': o.data.name = o.name
for o in seat_objs:
    assert o.name.endswith('_seat'), o.name
    o.name = o.name[:-5]
    if o.type == 'MESH': o.data.name = o.name
select_hierarchy(D.objects['grokbot_c_seated'])
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
print('BOT C DONE')
