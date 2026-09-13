"""Build Kart C — speed rival kart for Grok Bot C (low wedge, fins/blades).

Run headless:  "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b -P scripts/assets/build_kart_c.py
or inside Blender (MCP execute_blender_code):  exec(open(<this file>).read())

Creates:  hierarchy `kart_c` in collection `kart_c`, a `preview` collection,
          exports `assets/exported/karts/kart-c.glb`, renders a preview PNG,
          saves `assets/blender/karts/kart-c.blend`.
Conventions (match kart-a.glb / ADR-002):
  1 unit = 1 m, Blender +Y = kart forward (exports to glTF -Z), +Z up.
  Origin at ground center. ~2.6 m long x ~1.6 m wide.
  Wheels are separate nodes `wheel_fl/fr/rl/rr`, pivot at axle center,
  local X = axle (runtime spins them on local X).
  Driver seat area kept clear at Blender (0, -0.3, 0.62) — game places the
  seated bot at glTF (0, 0.62, 0.28).
Silhouette: low sleek wedge nose, open wheels, dorsal + side fins, rear
  wing, narrow cockpit. Palette: pearl white + violet (matches grokbot-c).
"""
import bpy, bmesh, math, os
from bpy import data as D
from mathutils import Vector, Matrix

ROOT  = r"C:\github\bot-kart"
BLEND = ROOT + r"\assets\blender\karts\kart-c.blend"
GLB   = ROOT + r"\assets\exported\karts\kart-c.glb"
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

COL_KART = new_coll('kart_c')
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

# palette matched to grokbot-c.glb + tire rubber shared with kart-a
PRL  = mat('pearl',        (0.930, 0.930, 0.965), rough=0.32, metal=0.25)
VIOL = mat('violet',       (0.430, 0.200, 0.720), rough=0.40, metal=0.20)
GRA  = mat('graphite',     (0.115, 0.125, 0.155), rough=0.50, metal=0.30)
MGNT = mat('magenta_glow', (0.950, 0.220, 0.760), rough=0.50,
           emit=(0.950, 0.200, 0.780), es=3.0)
VISR = mat('visor_dark',   (0.070, 0.095, 0.125), rough=0.15, metal=0.20)
TIRE = mat('tire',         (0.045, 0.048, 0.055), rough=0.95, metal=0.00)

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

def cyl_x(name, loc, r, depth, m, coll, verts=18):
    """Cylinder whose axle is local X (rotation applied)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
        location=loc, rotation=(0, math.pi / 2, 0))
    o = bpy.context.object; o.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.data.materials.append(m); link(o, coll); smooth(o)
    return o

def wheel(name, x, y, z, r, w, coll, parent):
    """Low-profile wheel: tire + hub + cap joined to ONE node, origin at
    axle center, local X = axle axis (runtime spins on local X)."""
    t = cyl_x(name, (x, y, z), r, w, TIRE, coll, 18)
    parts = [t,
        cyl_x(name + '_hub', (x, y, z), r * 0.60, w * 1.05, VIOL, coll, 14),
        cyl_x(name + '_cap', (x, y, z), r * 0.20, w * 1.14, PRL, coll, 10)]
    o = join_into(parts, name, coll)
    o.parent = parent
    return o

def sect(y, w, zb, zm, zt, h):
    """8-point hull cross-section at length-position y."""
    return (y, [(0, zb), (w * 0.72, zb + 0.015), (w, zm), (w * 0.78, zt),
                (0, zt + h), (-w * 0.78, zt), (-w, zm), (-w * 0.72, zb + 0.015)])

def hull(name, sections, m, coll, parent=None):
    """Loft through 8-pt sections (front -> rear), capped ends."""
    verts, faces = [], []
    nseg = 8
    for (y, pts) in sections:
        for (x, z) in pts:
            verts.append((x, y, z))
    nr = len(sections)
    for r in range(nr - 1):
        for i in range(nseg):
            j = (i + 1) % nseg
            faces.append((r*nseg+i, r*nseg+j, (r+1)*nseg+j, (r+1)*nseg+i))
    faces.append(tuple(range(nseg - 1, -1, -1)))
    faces.append(tuple((nr - 1) * nseg + i for i in range(nseg)))
    return mesh_obj(name, verts, faces, m, coll, 0.0, parent)

def fin(name, p0, p1, tip, th, m, coll, parent=None, axis='X'):
    """Thin triangular blade: base edge p0->p1, apex tip, thickness th."""
    p0, p1, tip = Vector(p0), Vector(p1), Vector(tip)
    o = th / 2
    off = Vector((o, 0, 0)) if axis == 'X' else Vector((0, 0, o))
    v = [p0 - off, p0 + off, p1 - off, p1 + off, tip - off, tip + off]
    f = [(0, 2, 4), (1, 5, 3), (0, 1, 3, 2), (2, 3, 5, 4), (4, 5, 1, 0)]
    return mesh_obj(name, v, f, m, coll, 0.008, parent, flat=True)

# ---------------------------------------------------------------- build kart
root = D.objects.new('kart_c', None); COL_KART.objects.link(root)

# ---- wheels (low profile: r=0.22, w=0.17) ----
WX, WF, WR, WZ, WRAD, WW = 0.68, 0.90, -0.90, 0.22, 0.22, 0.17
wheel('wheel_fl', -WX, WF, WZ, WRAD, WW, COL_KART, root)
wheel('wheel_fr',  WX, WF, WZ, WRAD, WW, COL_KART, root)
wheel('wheel_rl', -WX, WR, WZ, WRAD, WW, COL_KART, root)
wheel('wheel_rr',  WX, WR, WZ, WRAD, WW, COL_KART, root)

# ---- monocoque: nose wedge loft (tip y=+1.30 -> cockpit y=-0.02) ----
hull('nose', [
    sect( 1.30, 0.03, 0.100, 0.120, 0.140, 0.015),
    sect( 1.05, 0.20, 0.100, 0.170, 0.240, 0.030),
    sect( 0.72, 0.38, 0.110, 0.210, 0.320, 0.040),
    sect( 0.38, 0.46, 0.120, 0.250, 0.380, 0.050),
    sect(-0.02, 0.47, 0.130, 0.280, 0.420, 0.050),
], PRL, COL_KART, root)

# ---- tail loft (behind seat y=-0.60 -> tip y=-1.30) ----
hull('tail', [
    sect(-0.60, 0.46, 0.140, 0.300, 0.500, 0.050),
    sect(-0.92, 0.42, 0.130, 0.270, 0.440, 0.050),
    sect(-1.18, 0.32, 0.120, 0.220, 0.340, 0.040),
    sect(-1.30, 0.10, 0.110, 0.150, 0.200, 0.020),
], PRL, COL_KART, root)

box('floor', (0, -0.05, 0.09), (0.95, 2.20, 0.05), GRA, COL_KART, 0.015, parent=root)

# ---- cockpit tub (seat area clear at ~ (0, -0.3, 0.62)) ----
box('tub_floor', (0, -0.31, 0.44), (0.60, 0.58, 0.10), GRA, COL_KART, 0.02, parent=root)
for s, nm in ((-1, 'l'), (1, 'r')):
    box('tub_wall_'+nm, (s*0.33, -0.31, 0.55), (0.10, 0.58, 0.24), PRL, COL_KART, 0.03, parent=root)
    box('tub_rim_'+nm,  (s*0.33, -0.31, 0.68), (0.11, 0.58, 0.03), VIOL, COL_KART, 0.01, parent=root)
box('tub_rear',  (0, -0.60, 0.60), (0.70, 0.06, 0.30), PRL, COL_KART, 0.02, parent=root)
box('dash',      (0, -0.02, 0.56), (0.72, 0.10, 0.18), PRL, COL_KART, 0.04, parent=root)
box('deflector', (0, -0.05, 0.72), (0.55, 0.025, 0.12), VISR, COL_KART, 0.01,
    rot=(-0.35, 0, 0), parent=root)
box('seat_base', (0, -0.30, 0.52), (0.48, 0.40, 0.08), GRA, COL_KART, 0.02, parent=root)
box('seat_back', (0, -0.55, 0.72), (0.48, 0.08, 0.42), VIOL, COL_KART, 0.03,
    rot=(-0.12, 0, 0), parent=root)
box('headrest',  (0, -0.62, 0.95), (0.30, 0.10, 0.18), PRL, COL_KART, 0.04, parent=root)
seg('steer_col', (0, -0.05, 0.55), (0, -0.16, 0.80), 0.030, 0.026, GRA, COL_KART, 10, root)
bpy.ops.mesh.primitive_torus_add(major_radius=0.14, minor_radius=0.024,
    major_segments=20, minor_segments=8, location=(0, -0.16, 0.80),
    rotation=(math.radians(30.0), 0, 0))
sw = bpy.context.object; sw.name = 'steering_wheel'
sw.data.materials.append(GRA); link(sw, COL_KART); smooth(sw)
hub = seg('sw_hub', (0, -0.17, 0.78), (0, -0.15, 0.82), 0.04, 0.04, VIOL, COL_KART, 10)
sw = join_into([sw, hub], 'steering_wheel', COL_KART); sw.parent = root

# ---- aero: front wing, side pods, glow strips ----
box('wing_front', (0, 1.10, 0.10), (1.54, 0.26, 0.025), VIOL, COL_KART, 0.008, parent=root)
for s, nm in ((-1, 'l'), (1, 'r')):
    box('wing_fplate_'+nm, (s*0.76, 1.10, 0.14), (0.025, 0.26, 0.10), VIOL, COL_KART, 0.008, parent=root)
segbox('wing_fstrut', (0, 1.02, 0.10), (0, 1.14, 0.16), 0.06, 0.05, GRA, COL_KART, 0.01, root)
box('nose_glow', (0, 1.285, 0.13), (0.05, 0.04, 0.025), MGNT, COL_KART, 0.008, parent=root)
for s, nm in ((-1, 'l'), (1, 'r')):
    box('pod_'+nm,    (s*0.42, -0.10, 0.30), (0.16, 1.10, 0.16), PRL, COL_KART, 0.04, parent=root)
    box('pod_blade_'+nm, (s*0.52, -0.10, 0.34), (0.03, 1.00, 0.10), VIOL, COL_KART, 0.01, parent=root)
    box('pod_glow_'+nm,  (s*0.545,-0.10, 0.36), (0.015, 0.85, 0.025), MGNT, COL_KART, 0.005, parent=root)
    box('flank_glow_'+nm,(s*0.415, 0.40, 0.28), (0.02, 0.70, 0.025), MGNT, COL_KART, 0.005, parent=root)

# ---- rear wing on stalks ----
box('wing_rear', (0, -1.20, 0.92), (1.34, 0.24, 0.03), PRL, COL_KART, 0.008,
    rot=(0.15, 0, 0), parent=root)
for s, nm in ((-1, 'l'), (1, 'r')):
    box('wing_rplate_'+nm, (s*0.66, -1.20, 0.90), (0.03, 0.26, 0.14), VIOL, COL_KART, 0.008,
        rot=(0.15, 0, 0), parent=root)
    segbox('wing_rstrut_'+nm, (s*0.18, -1.16, 0.42), (s*0.18, -1.22, 0.90),
           0.05, 0.04, GRA, COL_KART, 0.01, root)

# ---- fins: dorsal shark fin + side winglets (signature speed silhouette) ----
fin('fin_dorsal', (0, -0.66, 0.75), (0, -1.20, 0.45), (0, -1.15, 1.02),
    0.030, VIOL, COL_KART, root, axis='X')
for s, nm in ((-1, 'l'), (1, 'r')):
    fin('fin_'+nm, (s*0.40, -0.70, 0.52), (s*0.55, -1.05, 0.42),
        (s*0.62, -0.95, 0.72), 0.025, VIOL, COL_KART, root, axis='Z')
# tail light strip
box('tail_glow', (0, -1.315, 0.22), (0.30, 0.02, 0.04), MGNT, COL_KART, 0.008, parent=root)

# mesh datablock names follow object names
for o in D.objects:
    if o.type == 'MESH' and o.data.name != o.name:
        o.data.name = o.name

# ---------------------------------------------------------------- stats
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
mn = [1e9] * 3; mx = [-1e9] * 3; nv = 0; nt = 0
def walk(o):
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
print('KART C verts:', nv, 'tris:', nt)
print('KART C bbox (Blender) min:', [round(v,3) for v in mn],
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

def aim(cam, target, loc=(3.1, 3.4, 1.8), lens=56):
    cam.location = loc
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens

def render(path, target=(0, 0, 0.45)):
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
render(PNGS + r'\kart-c_preview.png')

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
print('KART C DONE')
