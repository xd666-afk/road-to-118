"""Build the three industrial facilities in Blender and export their staged game meshes."""
from math import cos, pi, sin, tau
from pathlib import Path
from struct import Struct
import gzip
import json
import sys

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
BAYS = [(-23, 2), (0, -4), (23, 5)]
VERTEX = Struct("<3h3b7B")
RENDER = "--render" in sys.argv
projects = {}
primitive_meshes = {}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0


def material(name, rgb, metal=0, roughness=.65, emission=0):
    mat = bpy.data.materials.new(name)
    linear = tuple(c ** 2.2 for c in rgb)
    mat.diffuse_color = (*linear, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    for node, value in {
        "Base Color": mat.diffuse_color, "Metallic": metal, "Roughness": roughness,
        "Emission Color": mat.diffuse_color, "Emission Strength": emission,
    }.items():
        shader.inputs[node].default_value = value
    return mat


concrete = material("Weathered precast concrete", (.48, .52, .54))
tile = material("Raised service deck", (.36, .43, .46), .18)
asphalt = material("Graphite apron", (.23, .28, .30))
grate = material("Galvanized grating", (.30, .36, .40), .55)
frame = material("Powder coated frame", (.19, .28, .32), .55)
stainless = material("Brushed stainless steel", (.66, .73, .76), .73, .33)
alloy = material("Painted steel panel", (.53, .63, .65), .4)
dark = material("Graphite gasket", (.105, .16, .19), .15)
hazard = material("Safety ochre", (.83, .60, .21), .10)
ceramic = material("Porcelain insulator", (.74, .77, .71), .08, .24)
copper = material("Oxidized copper", (.64, .35, .19), .65, .28)
blue = material("Separation tower enamel", (.36, .53, .61), .40)
glass = material("Polarized optical glass", (.16, .43, .51), .42, .17)
cyan = material("Optical indicator", (.31, .81, .83), .10, .25, 1.0)
amber = material("Power indicator", (.96, .66, .29), .10, .25, .65)
white = material("Service markings", (.77, .80, .76))


def primitive(kind, mat, detail=24):
    key = (kind, mat.name, detail)
    if key not in primitive_meshes:
        if kind == "box":
            bpy.ops.mesh.primitive_cube_add(size=1)
        else:
            bpy.ops.mesh.primitive_cylinder_add(vertices=detail, radius=1, depth=1)
        obj = bpy.context.object
        mesh = obj.data
        mesh.name = f"{mat.name} · {kind}"
        mesh.materials.append(mat)
        if kind == "cylinder":
            for face in mesh.polygons:
                face.use_smooth = len(face.vertices) == 4
        primitive_meshes[key] = mesh
        bpy.data.objects.remove(obj, do_unlink=True)
    return primitive_meshes[key]


def place(group, name, coords, mesh, scale):
    obj = bpy.data.objects.new(name, mesh)
    group.objects.link(obj)
    obj.location = coords
    obj.scale = scale
    return obj


def box(group, name, coords, size, mat):
    return place(group, name, coords, primitive("box", mat), size)


def cylinder(group, name, start, end, radius, mat, detail=24):
    a, b = Vector(start), Vector(end)
    delta = b - a
    obj = place(group, name, (a + b) / 2, primitive("cylinder", mat, detail), (radius, radius, delta.length))
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    return obj


def pipe(group, name, points, radius, mat):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    curve.use_fill_caps = True
    curve.materials.append(mat)
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for vertex, point in zip(spline.points, points):
        vertex.co = (*point, 1)
    obj = bpy.data.objects.new(name, curve)
    group.objects.link(obj)
    return obj


def ring(group, name, x, y, z, radius, tube, mat):
    points = [(x + radius * cos(tau * i / 36), y + radius * sin(tau * i / 36), z) for i in range(37)]
    pipe(group, name, points, tube, mat)


def label(group, text, x, y, z, size, mat=white, vertical=False):
    font = bpy.data.curves.new(text, "FONT")
    font.body = text
    font.align_x = "CENTER"
    font.size = size
    font.materials.append(mat)
    obj = bpy.data.objects.new(text, font)
    group.objects.link(obj)
    obj.location = (x, y, z)
    if vertical:
        obj.rotation_euler.x = pi / 2


def rail(group, a, b, level, height=1.18):
    x0, y0 = a
    x1, y1 = b
    for t in (0, .25, .5, .75, 1):
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        cylinder(group, "Rail stanchion", (x, y, level), (x, y, level + height), .085, hazard, 8)
    for h in (.56, height):
        cylinder(group, "Safety guardrail", (x0, y0, level + h), (x1, y1, level + h), .073, hazard, 8)


def ladder(group, x, y, bottom, top):
    for offset in (-.49, .49):
        cylinder(group, "Ladder side", (x + offset, y, bottom), (x + offset, y, top), .072, hazard, 8)
    for i in range(1, int((top - bottom) / .48) + 1):
        z = bottom + i * .48
        cylinder(group, "Ladder rung", (x - .49, y, z), (x + .49, y, z), .058, stainless, 8)


def enclosure(group, x, y, z, sx, sy, sz, mat=alloy):
    box(group, "Equipment enclosure", (x, y, z + sz / 2), (sx, sy, sz), mat)
    box(group, "Access panel", (x, y - sy / 2 - .04, z + sz * .51), (sx * .82, .14, sz * .73), frame)
    box(group, "Service hatch", (x - sx * .16, y - sy / 2 - .13, z + sz * .47), (sx * .42, .14, sz * .55), grate)
    box(group, "Instrument display", (x + sx * .24, y - sy / 2 - .14, z + sz * .63), (sx * .18, .17, sz * .16), glass)
    box(group, "Instrument status", (x + sx * .24, y - sy / 2 - .25, z + sz * .65), (sx * .10, .07, .09), cyan)
    for i in range(4):
        box(group, "Cooling grille louvre", (x - sx * .15, y - sy / 2 - .25, z + sz * (.33 + i * .064)), (sx * .36, .11, .07), dark)
    for side in (-1, 1):
        for dy in (-sy * .37, sy * .37):
            box(group, "Structural foot", (x + side * sx * .36, y + dy, z - .07), (sx * .22, sy * .23, .23), frame)


def base_deck(group, sector):
    box(group, "Workshop foundations", (0, 0, -.65), (79, 55, 1), concrete)
    box(group, "Service yard slab", (0, 0, -.12), (77, 53, .3), asphalt)
    for x in range(-36, 37, 6):
        box(group, "Paving expansion joint", (x, 0, .043), (.035, 52, .018), dark)
    for y in range(-24, 25, 6):
        box(group, "Paving expansion joint", (0, y, .044), (76, .035, .019), dark)
    for index, (x, y) in enumerate(BAYS):
        box(group, "Service island plinth", (x, y, .36), (19, 18, .66), concrete)
        box(group, "Recessed machinery pad", (x, y, .72), (16.6, 14.9, .18), tile)
        for dx in range(-8, 9, 2):
            stripe = box(group, "Warning stripe", (x + dx, y - 8.5, .71), (.94, .27, .024), hazard)
            stripe.rotation_euler.z = -.38
        label(group, f"{sector} / 0{index + 1}", x, y - 10.4, .062, .78)
        for side in (-1, 1):
            rail(group, (x + side * 9.15, y + 1.4), (x + side * 9.15, y + 8.6), .72)
        for row in range(6):
            box(group, "Anchor channel", (x - 6.25 + row * 2.5, y - 5.9, .84), (1.25, .16, .07), grate)
    for side in (-1, 1):
        box(group, "Inspection lane paint", (0, -18.2 + side * 1.35, .057), (72, .15, .027), white)
        rail(group, (side * 36.4, -23), (side * 36.4, 23), .36)
    for x in range(-32, 33, 8):
        for i in range(3):
            box(group, "Drainage grate", (x, -23.5 + i * .24, .08), (4.8, .14, .08), grate)
    for x in (-33, -17, 0, 17, 33):
        box(group, "Pipe rack stanchion", (x, 20.5, 3), (.63, .63, 6), frame)
        box(group, "Pipe rack crossmember", (x, 20.5, 5.8), (.7, 5.2, .58), alloy)
        box(group, "Catwalk truss", (x, 20.5, 7.3), (.35, 4.5, .3), frame)
    for y, z, mat in [(19.4, 6.25, stainless), (20.7, 6.25, blue), (21.8, 6.3, alloy)]:
        cylinder(group, "Shared service header", (-35, y, z), (35, y, z), .26, mat)
        for x in (-32, -17, 0, 17, 32):
            cylinder(group, "Bolted manifold collar", (x - .18, y, z), (x + .18, y, z), .44, frame, 16)
    box(group, "Maintenance walkway", (0, 22.9, 7.15), (72, 1.7, .28), grate)
    rail(group, (-35, 23.6), (35, 23.6), 7.3)


def optical_equipment(group, index, x, y):
    if index == 0:
        for dx in (-3.9, 3.9):
            box(group, "Monochromator saddle", (x + dx, y, 1.75), (1.35, 5.35, 1.9), frame)
        cylinder(group, "Vacuum spectrograph body", (x - 6.4, y, 4.2), (x + 6.4, y, 4.2), 2.5, stainless, 40)
        for dx in (-6.3, -4.25, .35, 4.6, 6.3):
            cylinder(group, "Vacuum flange", (x + dx - .18, y, 4.2), (x + dx + .18, y, 4.2), 2.68, alloy, 32)
        cylinder(group, "Iris housing", (x + 6.5, y, 4.2), (x + 7.5, y, 4.2), 1.9, frame, 32)
        cylinder(group, "Instrument sapphire window", (x + 7.5, y, 4.2), (x + 7.56, y, 4.2), 1.43, glass, 32)
        cylinder(group, "Side observation port", (x - 1.5, y - 2.1, 4.2), (x - 1.5, y - 3.15, 4.2), 1.05, frame)
        cylinder(group, "Viewport window", (x - 1.5, y - 3.15, 4.2), (x - 1.5, y - 3.25, 4.2), .69, glass)
        enclosure(group, x + 4.8, y - 5.3, .93, 3.1, 2.4, 2.8)
        pipe(group, "Vacuum line", [(x + 4.8, y - 4.2, 3), (x + 4.8, y - 3.35, 3.8),
                                   (x + 4.8, y - 1.8, 4.25)], .20, copper)
    elif index == 1:
        box(group, "Isolation optical bench", (x, y, 1.65), (15.4, 5.5, 1.4), frame)
        for dx in (-5.5, 0, 5.5):
            box(group, "Optics gantry legs", (x + dx, y + 1.8, 4.2), (.67, .67, 5.9), alloy)
            box(group, "Optical carriage", (x + dx, y, 3.45), (3.3, 3.55, 2.6), stainless)
            cylinder(group, "Optical aperture", (x + dx, y - 1.7, 3.7), (x + dx, y - 1.94, 3.7), .98, glass)
            box(group, "Carriage indexing light", (x + dx, y - 1.94, 2.67), (1.68, .10, .12), cyan)
        box(group, "Gantry cross rail", (x, y + 1.8, 7.2), (16.5, .68, .78), alloy)
        for dy in (-1.44, 1.44):
            cylinder(group, "Optical rail", (x - 7.7, y + dy, 2.52), (x + 7.7, y + dy, 2.52), .16, copper)
        enclosure(group, x - 4.9, y - 5.25, .92, 3.6, 2, 2.56)
    else:
        radius, base = 6.55, 5.4
        cylinder(group, "Observation building", (x, y, .88), (x, y, base), radius, alloy, 48)
        for height in (1.15, 4.6, base):
            ring(group, "Dome support collar", x, y, height, radius, .19, frame)
        rings, sides = 8, 48
        vertices = [(x + radius * cos(pi * j / (2 * rings)) * cos(tau * i / sides),
                     y + radius * cos(pi * j / (2 * rings)) * sin(tau * i / sides),
                     base + radius * sin(pi * j / (2 * rings)))
                    for j in range(rings) for i in range(sides)]
        vertices.append((x, y, base + radius))
        faces = [(j * sides + i, j * sides + (i + 1) % sides, (j + 1) * sides + (i + 1) % sides, (j + 1) * sides + i)
                 for j in range(rings - 1) for i in range(sides)]
        faces.extend(((rings - 1) * sides + i, (rings - 1) * sides + (i + 1) % sides, len(vertices) - 1) for i in range(sides))
        mesh = bpy.data.meshes.new("Observation dome panels")
        mesh.from_pydata(vertices, [], faces)
        mesh.materials.append(stainless)
        mesh.materials.append(glass)
        for face in mesh.polygons:
            face.material_index = int(face.index % sides in (32, 33, 34, 35))
            face.use_smooth = True
        place(group, "Shuttered observation dome", (0, 0, 0), mesh, (1, 1, 1))
        for i in range(0, sides, 6):
            pipe(group, "Rolled dome seam", [vertices[j * sides + i] for j in range(rings)] + [vertices[-1]], .08, frame)
        enclosure(group, x, y - 6.4, .92, 3.6, 2.7, 3.65)


def tank(group, x, y, bottom, top, radius, mat):
    cylinder(group, "Pressure vessel wall", (x, y, bottom), (x, y, top), radius, mat, 36)
    for z in (bottom + .13, top - .13):
        ring(group, "Bolted pressure seam", x, y, z, radius, .12, stainless)
    cylinder(group, "Vent neck", (x, y, top), (x, y, top + .8), radius * .30, stainless)
    cylinder(group, "Vent neck flange", (x, y, top + .7), (x, y, top + .88), radius * .43, frame, 16)


def separation_equipment(group, index, x, y):
    if index == 1:
        for offset, top in [(-4.1, 17.5), (4.0, 14.5)]:
            tx = x + offset
            tank(group, tx, y, 1.2, top, 2.77, blue)
            for z in (4.6, 8.7, 12.25):
                cylinder(group, "Service deck collar", (tx, y, z), (tx, y, z + .22), 3.75, grate, 32)
                ring(group, "Gallery handrail", tx, y, z + 1.12, 3.65, .076, hazard)
                for n in range(8):
                    a = tau * n / 8
                    xx, yy = tx + 3.65 * cos(a), y + 3.65 * sin(a)
                    cylinder(group, "Gallery railing support", (xx, yy, z + .2), (xx, yy, z + 1.14), .065, hazard, 8)
            ladder(group, tx, y - 3.62, .95, 12.9)
        box(group, "Walkover bridge", (x, y, 8.75), (4.7, 1.6, .27), grate)
        rail(group, (x - 2.05, y - .76), (x + 2.05, y - .76), 8.87)
        pipe(group, "High return line", [(x - 4.1, y, 18.25), (x - 4.1, y, 19.2), (x - 2.8, y, 20.1),
                                          (x + 3.0, y, 20.1), (x + 4, y, 19.1), (x + 4, y, 15.3)], .29, stainless)
        enclosure(group, x, y - 5.7, .92, 3.2, 2.25, 2.8)
    else:
        for offset in (-4.25, 4.25):
            tx = x + offset
            radius = 2.64 if index == 0 else 3.1
            top = 6.1 if index == 0 else 9
            tank(group, tx, y + 1.7, 1.05, top, radius, blue if index == 0 else stainless)
            ladder(group, tx, y + 1.7 - radius - .11, .94, top)
            pipe(group, "Transfer header", [(tx, y + 1.7, top + .85), (tx, y + 1.7, top + 1.5),
                                           (tx, y + 3.2, top + 1.95), (tx, y + 8.9, top + 1.95)], .26, copper)
        enclosure(group, x, y - 4.5, .92, 6.2, 3.55, 3.5, blue)
        for i in (-1, 1):
            pipe(group, "Pump discharge", [(x + i * 2.45, y - 3.25, 3.15), (x + i * 2.45, y - 1.0, 3.15),
                                           (x + i * 4.25, y - 1.0, 3.15)], .22, stainless)


def insulator(group, x, y, z, count):
    cylinder(group, "Porcelain core", (x, y, z), (x, y, z + count * .38), .37, ceramic)
    for i in range(count):
        height = z + i * .38 + .12
        cylinder(group, "Porcelain weather shed", (x, y, height), (x, y, height + .18), .71, ceramic, 20)


def pulse_equipment(group, index, x, y):
    if index == 0:
        enclosure(group, x, y, 1.0, 10.6, 6.8, 4.6, alloy)
        for side in (-1, 1):
            for i in range(7):
                box(group, "Transformer radiator fin", (x + side * 5.72, y - 2.55 + i * .86, 3.0), (1.1, .19, 3.45), grate)
        for dx in (-3.7, 0, 3.7):
            insulator(group, x + dx, y, 5.65, 6)
        box(group, "High voltage terminal bar", (x, y, 8.07), (9, .23, .17), copper)
    elif index == 1:
        for dx in (-4.25, 4.25):
            code = x + dx
            cylinder(group, "Inductor base", (code, y, .88), (code, y, 2.2), 3.35, frame)
            cylinder(group, "High current inductor core", (code, y, 1.92), (code, y, 8.55), 2.32, dark, 36)
            pipe(group, "Continuous copper winding", [(code + 2.68 * cos(tau * j / 32),
                y + 2.68 * sin(tau * j / 32), 2.4 + j * .019) for j in range(320)], .16, copper)
            insulator(group, code, y, 8.55, 5)
        enclosure(group, x, y - 5.05, .94, 4.4, 2.9, 2.8)
    else:
        for dx in (-6, 6):
            for dy in (-4.5, 4.5):
                xx, yy = x + dx, y + dy
                box(group, "Bus gantry footing", (xx, yy, 1.08), (2, 2, .55), concrete)
                box(group, "Lattice upright", (xx, yy, 8.25), (.80, .80, 14.5), frame)
                insulator(group, xx, yy, 15.6, 6)
            for z in (3.4, 7.2, 11.6, 15.6):
                box(group, "Lattice beam", (x + dx, y, z), (.54, 9.7, .55), alloy)
                cylinder(group, "Lattice brace", (x + dx, y - 4.5, z - 1.9), (x + dx, y + 4.5, z + .9), .15, stainless, 8)
        for dy in (-4.5, 0, 4.5):
            box(group, "Busbar supports", (x, y + dy, 15.65), (13.3, .62, .62), alloy)
            cylinder(group, "Copper transfer bus", (x - 6.8, y + dy, 18.05), (x + 6.8, y + dy, 18.05), .23, copper)
        enclosure(group, x, y - 1.1, .95, 5.9, 3.9, 4.65)
        box(group, "Pulse indicators", (x, y - 3.16, 5.9), (5.4, .23, .15), amber)


def collection(scene, name):
    group = bpy.data.collections.new(name)
    scene.collection.children.link(group)
    return group


def set_camera(scene):
    cam_data = bpy.data.cameras.new("Campus camera")
    cam = bpy.data.objects.new("Campus camera", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (48, -67, 53)
    cam.rotation_euler = (Vector((0, 0, 4)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 47
    scene.camera = cam
    sun = bpy.data.lights.new("Afternoon sun", "SUN")
    sun.energy = 2.7
    sun.angle = .10
    sun_obj = bpy.data.objects.new(sun.name, sun)
    scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = Vector((-.24, .31, -.92)).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("Blue-gray sky")
    world.use_nodes = True
    world.node_tree.nodes.get("Background").inputs["Color"].default_value = (.30, .40, .51, 1)
    world.node_tree.nodes.get("Background").inputs["Strength"].default_value = .46
    scene.world = world
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 5
    scene.render.resolution_x = 960
    scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100


def export_mesh(scene, groups, key):
    bpy.context.window.scene = scene
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    data, ranges = bytearray(), []
    for group in groups:
        start = len(data) // VERTEX.size
        for obj in group.objects:
            evaluated = obj.evaluated_get(graph)
            mesh = evaluated.to_mesh()
            if mesh is None:
                continue
            try:
                mesh.calc_loop_triangles()
                transform = evaluated.matrix_world
                normal_space = transform.to_3x3().inverted_safe().transposed()
                xyz = [tuple(round(c * 256) for c in transform @ v.co) for v in mesh.vertices]
                normals = [tuple(round(c * 127) for c in (normal_space @ v.vector).normalized()) for v in mesh.corner_normals]
                colors = []
                for mat in mesh.materials:
                    shader = mat.node_tree.nodes["Principled BSDF"].inputs
                    colors.append((*[round(255 * c ** (1 / 2.2)) for c in mat.diffuse_color[:3]],
                                   round(shader["Metallic"].default_value * 255),
                                   round(shader["Roughness"].default_value * 255),
                                   round(min(4, shader["Emission Strength"].default_value) * 63.75), 0))
                for tri in mesh.loop_triangles:
                    color = colors[tri.material_index]
                    for index, corner in zip(tri.vertices, tri.loops):
                        data.extend(VERTEX.pack(*xyz[index], *normals[corner], *color))
            finally:
                evaluated.to_mesh_clear()
        ranges.append([start, len(data) // VERTEX.size - start])
    (ROOT / "src/data" / f"campus-{key}.mesh").write_bytes(gzip.compress(data, compresslevel=6, mtime=0))
    return {"groups": ranges, "anchors": []}


for key, name, mark, model in [
    ("spectroscopy", "01 · Optical research campus", "OPT", optical_equipment),
    ("separation", "02 · Sample separation campus", "SEP", separation_equipment),
    ("pulse", "03 · Pulse power campus", "PWR", pulse_equipment),
]:
    scene = bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    common = collection(scene, "00 · Permanent infrastructure")
    base_deck(common, mark)
    stages = [collection(scene, f"0{index + 1} · Construction stage {index + 1}") for index in range(3)]
    for index, (x, y) in enumerate(BAYS):
        model(stages[index], index, x, y)
    set_camera(scene)
    projects[key] = (scene, common, stages)

metadata = {key: export_mesh(scene, [common, *stages], key) for key, (scene, common, stages) in projects.items()}
(ROOT / "src/data/campusGeometry.json").write_text(json.dumps(metadata, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
source = ROOT / "assets-source"
source.mkdir(exist_ok=True)
original_scene = bpy.data.scenes.get("Scene")
if original_scene:
    bpy.data.scenes.remove(original_scene)
bpy.context.window.scene = projects["spectroscopy"][0]
for screen in bpy.data.screens:
    for area in screen.areas:
        for space in area.spaces:
            if space.type != "VIEW_3D":
                continue
            space.region_3d.view_location = (0, 0, 4)
            space.region_3d.view_distance = 94
            space.region_3d.view_rotation = bpy.context.scene.camera.rotation_euler.to_quaternion()
            space.shading.color_type = "MATERIAL"
            space.overlay.show_floor = False
bpy.ops.wm.save_as_mainfile(filepath=str(source / "research-campus.blend"), compress=True)

if RENDER:
    for key, (scene, _, stages) in projects.items():
        bpy.context.window.scene = scene
        scene.cycles.samples = 7
        scene.render.image_settings.file_format = "WEBP"
        scene.render.image_settings.quality = 78
        for built in range(4):
            for index, stage in enumerate(stages):
                stage.hide_render = index >= built
            scene.render.filepath = str(ROOT / "public/assets" / f"campus-{key}-{built}.webp")
            bpy.ops.render.render(write_still=True)
