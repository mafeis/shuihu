class_name UISlidePanel
extends PanelContainer

var _shown_position := Vector2.ZERO
var _motion_enabled := true


func prepare(shown_position: Vector2, motion_enabled := true) -> UISlidePanel:
	_shown_position = shown_position
	_motion_enabled = motion_enabled
	position = shown_position
	return self


func reveal() -> void:
	position = _shown_position
	if not _motion_enabled:
		return
	position.y -= 22
	modulate.a = 0.0
	var tween := create_tween().set_parallel(true).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(self, "position", _shown_position, 0.18)
	tween.tween_property(self, "modulate:a", 1.0, 0.16)
