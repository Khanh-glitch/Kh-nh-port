extends Node
## Loads one study at a time so all three can be compared cheaply.
##
## This is scaffolding for the art-direction phase, not portfolio navigation.
## Left/Right cycles studies, C toggles the canonical/secondary camera.

const STUDIES := [
	{
		"name": "A — WORK WALL",
		"scene": "res://scenes/RoomStudy_A_WorkWall.tscn",
		"note": "One dense working wall. Desk, screen, corkboard and evidence read as a single production surface.",
	},
	{
		"name": "B — DIAGONAL STUDIO",
		"scene": "res://scenes/RoomStudy_B_DiagonalStudio.tscn",
		"note": "Asymmetrical diagonal. Workstation turned off-axis; foreground, midground and background stack into depth.",
	},
	{
		"name": "C — PRESENTATION PLANE",
		"scene": "res://scenes/RoomStudy_C_PresentationPlane.tscn",
		"note": "Tension between a compressed working nucleus and a large presentation wall in one room.",
	},
]

var _index := 0
var _current: Node = null
var _label: Label = null


func _ready() -> void:
	_build_hud()
	_load(0)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("study_next"):
		_load((_index + 1) % STUDIES.size())
	elif event.is_action_pressed("study_prev"):
		_load((_index - 1 + STUDIES.size()) % STUDIES.size())


func _load(index: int) -> void:
	_index = index
	if is_instance_valid(_current):
		_current.queue_free()
		remove_child(_current)
	var packed: PackedScene = load(STUDIES[_index]["scene"])
	_current = packed.instantiate()
	add_child(_current)
	move_child(_current, 0)
	_refresh_label()


func _refresh_label() -> void:
	var study: Dictionary = STUDIES[_index]
	_label.text = "ROOM STUDY %s\n%s\n\n[<-] [->] study    [C] camera" % [
		study["name"], study["note"],
	]


func _build_hud() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 10
	add_child(layer)

	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	panel.position = Vector2(28, -132)
	panel.custom_minimum_size = Vector2(640, 0)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.03, 0.03, 0.035, 0.72)
	style.content_margin_left = 18
	style.content_margin_right = 18
	style.content_margin_top = 14
	style.content_margin_bottom = 14
	panel.add_theme_stylebox_override("panel", style)
	layer.add_child(panel)

	_label = Label.new()
	_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_label.add_theme_color_override("font_color", Color(0.82, 0.80, 0.76))
	_label.add_theme_font_size_override("font_size", 15)
	panel.add_child(_label)
