@tool
extends RefCounted
## The shared material language for all three studies.
##
## NOT FROZEN. These are working values for a visual audition. The point of
## centralising them is that one edit here re-surfaces every study at once, so
## the three variants stay comparable.
##
## Principles applied here:
##   - restrained saturation: the kit's default candy colours (salmon chair,
##     mint plant, bright pine) are pulled toward a muted, slightly warm
##     neutral family;
##   - roughness relationships carry the material read, not colour;
##   - two believable families — warm working wood, cool dark equipment —
##     plus small accents that are allowed to stay saturated because they are
##     tiny and earn attention (the circuit board's copper, a couple of
##     book spines);
##   - nothing is glossy. The room is matte, dusty and worked-in.

# --- base families --------------------------------------------------------

const WOOD_WARM := Color(0.386, 0.283, 0.203)      # desk / shelf carcass
const WOOD_PALE := Color(0.451, 0.354, 0.263)      # lighter ply edges
const EQUIP_DARK := Color(0.086, 0.088, 0.094)     # speakers, monitor shell
const EQUIP_MID := Color(0.184, 0.192, 0.204)      # painted metal
const EQUIP_LIGHT := Color(0.372, 0.386, 0.398)    # brushed trim
const FABRIC := Color(0.267, 0.243, 0.227)         # chair cushion
const PAPER := Color(0.741, 0.706, 0.639)          # pinned sheets, page block
const CORK := Color(0.451, 0.333, 0.212)
const FOLIAGE := Color(0.239, 0.298, 0.212)        # desaturated, dusty green
const POT := Color(0.353, 0.298, 0.259)
const SCREEN_OFF := Color(0.043, 0.047, 0.055)     # dark glass, not black

# Small accents that keep saturation on purpose.
const ACCENT_COPPER := Color(0.541, 0.357, 0.169)
const ACCENT_PCB := Color(0.114, 0.181, 0.149)
const ACCENT_BOOK_RED := Color(0.412, 0.204, 0.176)


## Per-asset material families.
##
## Each entry maps a *source* material name (as authored in the GLB) to an
## override spec: albedo, roughness, metallic and optional emission.
## `_default` catches any surface not named explicitly.
const MATERIAL_FAMILIES := {
	"work-console": {
		"wood": {"albedo": WOOD_WARM, "rough": 0.82, "metal": 0.0},
		"_defaultMat": {"albedo": WOOD_PALE, "rough": 0.86, "metal": 0.0},
		"metal": {"albedo": EQUIP_LIGHT, "rough": 0.55, "metal": 0.35},
		"_default": {"albedo": WOOD_WARM, "rough": 0.82, "metal": 0.0},
	},
	"chair": {
		"wood": {"albedo": WOOD_WARM, "rough": 0.84, "metal": 0.0},
		"carpet": {"albedo": FABRIC, "rough": 0.95, "metal": 0.0},
		"_default": {"albedo": FABRIC, "rough": 0.92, "metal": 0.0},
	},
	"display": {
		# 70-tri shell + a 2-tri screen quad. The quad is the content surface.
		"metalDark": {"albedo": EQUIP_DARK, "rough": 0.62, "metal": 0.15},
		"metal": {"albedo": SCREEN_OFF, "rough": 0.18, "metal": 0.0},
		"_default": {"albedo": EQUIP_DARK, "rough": 0.62, "metal": 0.15},
	},
	"bookcase-low": {
		"wood": {"albedo": WOOD_WARM, "rough": 0.85, "metal": 0.0},
		"_default": {"albedo": WOOD_WARM, "rough": 0.85, "metal": 0.0},
	},
	"plant-small": {
		"wood": {"albedo": POT, "rough": 0.9, "metal": 0.0},
		"plant": {"albedo": FOLIAGE, "rough": 0.88, "metal": 0.0},
		"_default": {"albedo": FOLIAGE, "rough": 0.88, "metal": 0.0},
	},
	"spotlight": {
		# Fixture geometry only. Illumination comes from a real SpotLight3D.
		"Material.004": {"albedo": Color(0.055, 0.057, 0.061), "rough": 0.52, "metal": 0.25},
		"LightGrey": {"albedo": EQUIP_MID, "rough": 0.58, "metal": 0.3},
		"Material.003": {"albedo": Color(0.86, 0.82, 0.71), "rough": 0.3, "metal": 0.0,
			"emission": Color(1.0, 0.878, 0.702), "emission_energy": 1.6},
		"_default": {"albedo": EQUIP_MID, "rough": 0.55, "metal": 0.25},
	},
	"speaker-small": {
		"wood": {"albedo": Color(0.212, 0.169, 0.133), "rough": 0.8, "metal": 0.0},
		"metalMedium": {"albedo": EQUIP_DARK, "rough": 0.72, "metal": 0.2},
		"_default": {"albedo": EQUIP_DARK, "rough": 0.75, "metal": 0.15},
	},
	"headphones": {
		"Material": {"albedo": Color(0.125, 0.129, 0.137), "rough": 0.68, "metal": 0.1},
		"_default": {"albedo": Color(0.125, 0.129, 0.137), "rough": 0.68, "metal": 0.1},
	},
	"circuit-board": {
		"Green": {"albedo": ACCENT_PCB, "rough": 0.62, "metal": 0.0},
		"black": {"albedo": Color(0.055, 0.055, 0.059), "rough": 0.7, "metal": 0.1},
		"conduct": {"albedo": ACCENT_COPPER, "rough": 0.42, "metal": 0.75},
		"Material.003": {"albedo": EQUIP_LIGHT, "rough": 0.5, "metal": 0.4},
		"_default": {"albedo": ACCENT_PCB, "rough": 0.62, "metal": 0.05},
	},
	"books": {
		"carpetDarker": {"albedo": ACCENT_BOOK_RED, "rough": 0.9, "metal": 0.0},
		"carpetWhite": {"albedo": PAPER, "rough": 0.93, "metal": 0.0},
		"plant": {"albedo": Color(0.271, 0.318, 0.325), "rough": 0.9, "metal": 0.0},
		"metal": {"albedo": Color(0.478, 0.451, 0.404), "rough": 0.75, "metal": 0.1},
		"_default": {"albedo": PAPER, "rough": 0.9, "metal": 0.0},
	},
	"corkboard": {
		"Material": {"albedo": CORK, "rough": 0.95, "metal": 0.0},
		"_default": {"albedo": CORK, "rough": 0.95, "metal": 0.0},
	},
}


static func family_for(kit_id: String) -> Dictionary:
	return MATERIAL_FAMILIES.get(kit_id, {})


## Build one override material. `source` is the GLB's own material, used only
## to inherit vertex-colour and texture settings we do not want to discard.
static func build_material(family: Dictionary, surface_name: String,
		source: Material, roughness_offset: float) -> StandardMaterial3D:
	var spec: Dictionary = family.get(surface_name, family.get("_default", {}))
	if spec.is_empty():
		return null

	var mat := StandardMaterial3D.new()
	mat.albedo_color = spec["albedo"]
	mat.roughness = clampf(float(spec["rough"]) + roughness_offset, 0.0, 1.0)
	mat.metallic = spec.get("metal", 0.0)
	mat.metallic_specular = 0.42

	if spec.has("emission"):
		mat.emission_enabled = true
		mat.emission = spec["emission"]
		mat.emission_energy_multiplier = spec.get("emission_energy", 1.0)

	# Preserve a source base-colour texture if the asset actually had one
	# (only headphones.glb does).
	if source is BaseMaterial3D:
		var src := source as BaseMaterial3D
		var tex := src.albedo_texture
		if tex != null:
			mat.albedo_texture = tex
			mat.albedo_color = Color(1, 1, 1)
			mat.roughness = clampf(float(spec["rough"]) + roughness_offset, 0.0, 1.0)

	return mat
