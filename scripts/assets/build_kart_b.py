"""Build Kart B — heavy/industrial rival kart for Grok Bot B.

Run headless:  "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b -P scripts/assets/build_kart_b.py
or inside Blender (MCP execute_blender_code):  exec(open(<this file>).read())

Creates:  hierarchy `kart_b` in collection `kart_b`, a `preview` collection,
          exports `assets/exported/karts/kart-b.glb`, renders a preview PNG,
          saves `assets/blender/karts/kart-b.blend`.
Conventions (match kart-a.glb / ADR-002):
  1 unit = 1 m, Blender +Y = kart forward (exports to glTF -Z), +Z up.
  Origin at ground center. ~2.6 m long x ~1.6 m wide.
  Wheels are separate nodes `wheel_fl/fr/rl/rr`, pivot at axle center,
  local X = axle (runtime spins them on local X).
  Driver seat area kept clear at Blender (0, -0.3, 0.62) — game places the
  seated bot at glTF (0, 0.62, 0.28).
Silhouette: boxy/ square, wide stance, roll cage + twin exhaust stacks,
  chunky wheels. Palette: gunmetal + orange accents (matches grokbot-b).
"""
import bpy, bmesh, math, os
from bpy import data as D
from mathutils import Vector, Matrix

ROOT  = r"C:\github\bot-kart"
BLEND = ROOT + r"\assets\blender\karts\kart-b.blend"
GLB   = ROOT + r"\assets\exported\karts\kart-b.glb"
PNGS  = ROOT + r"\docs\gauntlet\evidence\wave3"

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

COL_KART = new_coll('kart_b')
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

# palette matched to grokbot-b.glb + tire rubber shared with kart-a
GUN  = mat('gunmetal',   (0.185, 0.205, 0.235), rough=0.42, metal=0.55)
NAVY = mat('navy',       (0.095, 0.115, 0.150), rough=0.50, metal=0.30)
ORNG = mat('orange',     (0.950, 0.430, 0.060), rough=0.40, metal=0.10)
AMBR = mat('amber_glow', (1.000, 0.560, 0.090), rough=0.50,
           emit=(1.000, 0.520, 0.080), es=3.0)
TIRE = mat('tire',       (0.045, 0.048, 0.055), rough=0.95, metal=0.00)

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

def mesh_obj(name, verts, faces, m, coll, bevel=0.0, parent=None, flat=False):
    me = D.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
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

def join_into(objs, name, coll):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    act = bpy.context.object; act.name = name
    link(act, coll)
    return act

def cyl_x(name, loc, r, depth, m, coll, verts=20):
    """Cylinder whose axle is local X (rotation applied)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
        location=loc, rotation=(0, math.pi / 2, 0))
    o = bpy.context.object; o.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.data.materials.append(m); link(o, coll); smooth(o)
    return o

def wheel(name, x, y, z, r, w, coll, parent):
    """Chunky wheel: tire + hub + cap joined to ONE node, origin at axle
    center, local X = axle axis (runtime spins on local X)."""
    t = cyl_x(name, (x, y, z), r, w, TIRE, coll, 20)
    parts = [t,
        cyl_x(name + '_hub', (x, y, z), r * 0.58, w * 1.04, ORNG, coll, 16),
        cyl_x(name + '_cap', (x, y, z), r * 0.22, w * 1.12, GUN, coll, 12)]
    o = join_into(parts, name, coll)
    o.parent = parent                      # origin already at axle center
    return o

# ---------------------------------------------------------------- build kart
root = D.objects.new('kart_b', None); COL_KART.objects.link(root)

# ---- wheels (chunky: r=0.26, w=0.26) ----
WX, WF, WR, WZ, WRAD, WW = 0.71, 0.88, -0.88, 0.26, 0.26, 0.26
wheel('wheel_fl', -WX, WF, WZ, WRAD, WW, COL_KART, root)
wheel('wheel_fr',  WX, WF, WZ, WRAD, WW, COL_KART, root)
wheel('wheel_rl', -WX, WR, WZ, WRAD, WW, COL_KART, root)
wheel('wheel_rr',  WX, WR, WZ, WRAD, WW, COL_KART, root)

# ---- chassis / hull: boxy slabs ----
box('floor',   (0,  0.00, 0.17), (1.06, 2.00, 0.10), NAVY, COL_KART, 0.02, parent=root)
box('hull',    (0,  0.02, 0.36), (1.26, 2.14, 0.24), GUN,  COL_KART, 0.05, parent=root)
box('nose',    (0,  1.15, 0.40), (1.34, 0.24, 0.32), GUN,  COL_KART, 0.05, parent=root)
box('grille',  (0,  1.275,0.38), (0.66, 0.03, 0.14), NAVY, COL_KART, 0.01, parent=root)
for s, nm in ((-1, 'l'), (1, 'r')):
    box('headlight_'+nm, (s*0.46, 1.278, 0.46), (0.18, 0.03, 0.10), AMBR, COL_KART, 0.01, parent=root)
# ram bar (bull bar) across the nose
box('ram_bar', (0, 1.30, 0.44), (1.18, 0.08, 0.10), ORNG, COL_KART, 0.03, parent=root)
for s, nm in ((-1, 'l'), (1, 'r')):
    box('ram_strut_'+nm, (s*0.42, 1.235, 0.44), (0.09, 0.13, 0.08), GUN, COL_KART, 0.02, parent=root)
# hood + scoop
box('hood',       (0, 0.80, 0.52), (1.16, 0.60, 0.10), GUN,  COL_KART, 0.03, parent=root)
box('hood_scoop', (0, 0.82, 0.61), (0.36, 0.38, 0.10), NAVY, COL_KART, 0.02, parent=root)
box('scoop_lip',  (0, 1.00, 0.61), (0.38, 0.05, 0.08), ORNG, COL_KART, 0.02, parent=root)
# squared fenders over each wheel + marker lights
for s, snm in ((-1, 'l'), (1, 'r')):
    for y, anm in ((0.88, 'f'), (-0.88, 'r')):
        box('fender_'+anm+snm, (s*0.69, y, 0.58), (0.32, 0.66, 0.08),
            GUN, COL_KART, 0.02, parent=root)
    box('fender_lamp_'+snm, (s*0.69, 1.19, 0.58), (0.10, 0.06, 0.03),
        AMBR, COL_KART, 0.008, parent=root)
# side pods + hazard-orange flank stripes
for s, nm in ((-1, 'l'), (1, 'r')):
    box('pod_'+nm,   (s*0.68, -0.02, 0.34), (0.24, 1.00, 0.26), NAVY, COL_KART, 0.04, parent=root)
    box('stripe_'+nm,(s*0.80, -0.02, 0.38), (0.02, 0.66, 0.09), ORNG, COL_KART, 0.008, parent=root)

# ---- cockpit (seat area kept clear at ~ (0, -0.3, 0.62)) ----
box('dash',      (0,  0.00, 0.58), (0.98, 0.30, 0.18), NAVY, COL_KART, 0.04, parent=root)
box('dash_glow', (0, -0.155,0.60), (0.50, 0.01, 0.05), AMBR, COL_KART, 0.004, parent=root)
box('seat_base', (0, -0.34, 0.52), (0.56, 0.46, 0.10), NAVY, COL_KART, 0.03, parent=root)
box('seat_back', (0, -0.60, 0.78), (0.56, 0.12, 0.52), NAVY, COL_KART, 0.03,
    rot=(-0.10, 0, 0), parent=root)
seg('steer_col', (0, 0.02, 0.62), (0, -0.14, 0.88), 0.035, 0.030, GUN, COL_KART, 10, root)
# steering wheel: torus + hub, plane perpendicular to the column
bpy.ops.mesh.primitive_torus_add(major_radius=0.15, minor_radius=0.028,
    major_segments=20, minor_segments=8, location=(0, -0.14, 0.88),
    rotation=(math.radians(31.4), 0, 0))
sw = bpy.context.object; sw.name = 'steering_wheel'
sw.data.materials.append(GUN); link(sw, COL_KART); smooth(sw)
hub = seg('sw_hub', (0, -0.15, 0.86), (0, -0.13, 0.90), 0.045, 0.045, NAVY, COL_KART, 10)
sw = join_into([sw, hub], 'steering_wheel', COL_KART); sw.parent = root

# ---- roll cage (signature heavy silhouette) ----
CW = 0.075  # cage tube thickness
for s, nm in ((-1, 'l'), (1, 'r')):
    segbox('cage_post_r'+nm, (s*0.55, -0.72, 0.50), (s*0.50, -0.72, 1.42),
           CW, CW, GUN, COL_KART, 0.015, root)
    segbox('cage_post_f'+nm, (s*0.48, -0.10, 0.62), (s*0.48, -0.10, 1.38),
           CW, CW, GUN, COL_KART, 0.015, root)
    segbox('cage_rail_'+nm,  (s*0.50, -0.72, 1.42), (s*0.48, -0.10, 1.38),
           CW, CW, GUN, COL_KART, 0.015, root)
segbox('cage_top_r', (-0.50, -0.72, 1.42), (0.50, -0.72, 1.42), CW, CW, GUN, COL_KART, 0.015, root)
segbox('cage_top_f', (-0.48, -0.10, 1.38), (0.48, -0.10, 1.38), CW, CW, GUN, COL_KART, 0.015, root)
# X-brace across the rear hoop
segbox('cage_x1', (-0.50, -0.74, 1.40), (0.50, -0.74, 0.56), 0.05, 0.05, ORNG, COL_KART, 0.01, root)
segbox('cage_x2', ( 0.50, -0.74, 1.40), (-0.50, -0.74, 0.56), 0.05, 0.05, ORNG, COL_KART, 0.01, root)

# ---- rear deck + twin exhaust stacks ----
box('rear_deck',   (0, -0.95, 0.52), (0.95, 0.55, 0.30), NAVY, COL_KART, 0.04, parent=root)
for s, nm in ((-1, 'l'), (1, 'r')):
    seg('exhaust_'+nm,     (s*0.34, -0.95, 0.45), (s*0.34, -0.98, 1.30),
        0.10, 0.11, GUN, COL_KART, 16, root)
    seg('exhaust_tip_'+nm, (s*0.34, -0.98, 1.30), (s*0.34, -0.99, 1.40),
        0.11, 0.135, NAVY, COL_KART, 16, root)
    seg('exhaust_glow_'+nm,(s*0.34, -0.988, 1.385), (s*0.34, -0.992, 1.405),
        0.075, 0.075, AMBR, COL_KART, 12, root)
# rear bumper + lights + stripe
box('rear_bumper', (0, -1.24, 0.36), (1.30, 0.14, 0.26), GUN,  COL_KART, 0.05, parent=root)
box('rear_stripe', (0, -1.315,0.30), (0.90, 0.02, 0.06), ORNG, COL_KART, 0.008, parent=root)
for s, nm in ((-1, 'l'), (1, 'r')):
    box('tail_'+nm, (s*0.45, -1.315, 0.40), (0.16, 0.02, 0.08), AMBR, COL_KART, 0.008, parent=root)
# whip antenna on the rear deck
seg('antenna', (0.50, -1.10, 0.67), (0.55, -1.15, 1.15), 0.015, 0.010, GUN, COL_KART, 8, root)
box('antenna_tip', (0.55, -1.152, 1.17), (0.04, 0.04, 0.04), AMBR, COL_KART, 0.01, parent=root)

# mesh datablock names follow object names
for o in D.objects:
    if o.type == 'MESH' and o.data.name != o.name:
        o.data.name = o.name

# ---------------------------------------------------------------- stats
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
mn = [1e9] * 3; mx = [-1e9] * 3; nv = 0; nt = 0
def walk(o):
    global nv, nt
    yield o
    for c in o.children:
        yield from walk(c)
for o in walk(root):
    if o.type != 'MESH': continue
    ev = o.evaluated_get(dg).to_mesh()
    nv += len(ev.vertices); nt += len(ev.loop_triangles)
    for v in ev.vertices:
        w = o.matrix_world @ v.co
        for k in range(3):
            mn[k] = min(mn[k], w[k]); mx[k] = max(mx[k], w[k])
    o.evaluated_get(dg).to_mesh_clear()
print('KART B verts:', nv, 'tris:', nt)
print('KART B bbox (Blender) min:', [round(v,3) for v in mn],
      'max:', [round(v,3) for v in mx],
      'size:', [round(mx[k]-mn[k],3) for k in range(3)])

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

def aim(cam, target, loc=(3.1, 3.4, 2.0), lens=56):
    cam.location = loc
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens

def render(path, target=(0, 0, 0.55)):
    try: sc.render.engine = 'BLENDER_EEVEE_NEXT'
    except Exception:
        try: sc.render.engine = 'BLENDER_EEVEE'
        except Exception: sc.render.engine = 'BLENDER_WORKBENCH'
    sc.render.resolution_x = sc.render.resolution_y = 800
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = path
    aim(cam, target)
    bpy.ops.render.render(write_still=True)
    print('RENDERED', path)

os.makedirs(PNGS, exist_ok=True)
render(PNGS + r'\kart-b_preview.png')

# ---------------------------------------------------------------- export
os.makedirs(os.path.dirname(GLB), exist_ok=True)

def select_hierarchy(root):
    bpy.ops.object.select_all(action='DESELECT')
    def sel(o):
        o.select_set(True)
        for k in o.children: sel(k)
    sel(root)

select_hierarchy(root)
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True, export_animations=False)
print('EXPORTED', GLB, os.path.getsize(GLB), 'bytes')

bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print('SAVED', bpy.data.filepath)
print('KART B DONE')
