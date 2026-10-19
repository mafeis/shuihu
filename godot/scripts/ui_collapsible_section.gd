class_name UICollapsibleSection
extends VBoxContainer

signal expanded_changed(expanded: bool)

var title_button: Button
var content: VBoxContainer
var expanded := true
var _animated := false


func setup(title: String, initially_open := true) -> UICollapsibleSection:
	add_theme_constant_override("separation", 4)
	title_button = Button.new()
	title_button.text = "▼  " + title
	title_button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	title_button.toggle_mode = true
	title_button.button_pressed = initially_open
	title_button.custom_minimum_size.y = 34
	title_button.pressed.connect(toggle)
	add_child(title_button)
	content = VBoxContainer.new()
	content.add_theme_constant_override("separation", 6)
	add_child(content)
	expanded = initially_open
	content.visible = expanded
	return self


func toggle() -> void:
	expanded = not expanded
	title_button.button_pressed = expanded
	title_button.text = ("▼  " if expanded else "▶  ") + title_button.text.substr(3)
	if _animated:
		var tween := create_tween().set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		if expanded:
			content.visible = true
			content.modulate.a = 0.0
			tween.tween_property(content, "modulate:a", 1.0, 0.16)
		else:
			tween.tween_property(content, "modulate:a", 0.0, 0.1)
			tween.tween_callback(func(): content.visible = false)
	else:
		content.visible = expanded
	expanded_changed.emit(expanded)


func set_animated(value: bool) -> void:
	_animated = value
