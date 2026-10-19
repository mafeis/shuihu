extends Node

var main: Control
var failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	var scene := load("res://scenes/main.tscn") as PackedScene
	main = scene.instantiate()
	get_tree().root.add_child(main)
	await get_tree().process_frame
	main.state.save_path = "user://input_test_%d.json" % OS.get_process_id()
	main.state.backup_path = "user://input_test_%d.backup.json" % OS.get_process_id()
	main.state.delete_save()
	main.show_settings()
	await get_tree().process_frame
	var input := main.settings_layer.find_child("PlayerName", true, false) as LineEdit
	_check(input != null, "settings should provide a native text input")
	var audio_rows := main.find_children("*", "HSlider", true, false).filter(func(slider): return slider.visible)
	_check(audio_rows.size() >= 2, "volume controls should remain visible with native input focus")
	_check(ResourceLoader.exists("res://assets/environments/yellow_river_ferry.png"), "campaign artwork should be packaged with the game")
	_check(ResourceLoader.exists("res://assets/audio/title_theme.mp3"), "campaign music should be packaged with the game")
	if input == null:
		_finish()
		return
	_check(input.has_focus(), "opening settings should focus the text input")
	input.text = ""
	input.caret_column = 0
	input.grab_focus()
	await _type_text("星命测试")
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().process_frame
	_check(input.text == "星命测试", "native text events should preserve Chinese characters")
	_check(main.state.player_name.strip_edges() == "星命测试", "settings should keep Unicode player names")
	await _key(KEY_ENTER)
	_check(main.settings_layer.visible, "Enter while typing should not close settings")
	_check(input.text == "星命测试", "Enter while typing should preserve text")
	_check(main.screen_root.mouse_filter == Control.MOUSE_FILTER_STOP, "settings overlay should block background clicks")
	_check(main.state.player_name == "星命测试", "Chinese names should be accepted and stored")
	var paste_button: Button = null
	var copy_button: Button = null
	for button in main.settings_layer.find_children("*", "Button", true, false):
		if button is Button and button.text == "粘贴中文":
			paste_button = button
		elif button is Button and button.text == "复制中文":
			copy_button = button
	_check(paste_button != null, "settings should provide explicit Chinese clipboard paste")
	_check(copy_button != null, "settings should provide explicit Chinese clipboard copy")
	if copy_button and DisplayServer.has_feature(DisplayServer.FEATURE_CLIPBOARD):
		copy_button.pressed.emit()
		await get_tree().process_frame
		_check(DisplayServer.clipboard_get() == "星命测试", "copy should preserve Chinese text through the system clipboard")
	if paste_button and DisplayServer.has_feature(DisplayServer.FEATURE_CLIPBOARD):
		DisplayServer.clipboard_set("江湖客")
		paste_button.pressed.emit()
		await get_tree().process_frame
		_check(input.text == "江湖客", "paste should insert Chinese text without relying on keyboard focus")
		_check(main.state.player_name == "江湖客", "pasted Chinese names should update game state")
	else:
		input.text = "江湖客"
		input.text_changed.emit(input.text)
		await get_tree().process_frame
	main.close_settings()
	await get_tree().process_frame
	_check(not main.settings_layer.visible, "settings should close after leaving text input")
	_check(main.screen_root.mouse_filter == Control.MOUSE_FILTER_PASS, "closing settings should restore game input")
	main.state.load_save()
	_check(main.state.player_name.strip_edges() == "江湖客", "player name should persist in native save")
	main.state.delete_save()
	main.queue_free()
	await get_tree().process_frame
	await get_tree().process_frame
	_finish()


func _type_text(text: String) -> void:
	for character in text:
		var event := InputEventKey.new()
		event.pressed = true
		event.unicode = character.unicode_at(0)
		Input.parse_input_event(event)
		await get_tree().process_frame
		var release := event.duplicate()
		release.pressed = false
		Input.parse_input_event(release)
		await get_tree().process_frame


func _key(keycode: Key) -> void:
	var event := InputEventKey.new()
	event.keycode = keycode
	event.physical_keycode = keycode
	event.pressed = true
	Input.parse_input_event(event)
	await get_tree().process_frame
	var release := event.duplicate()
	release.pressed = false
	Input.parse_input_event(release)
	await get_tree().process_frame


func _finish() -> void:
	if failures.is_empty():
		print("Godot input passed: native Chinese text input, Enter handling and save persistence.")
		get_tree().quit(0)
	else:
		for failure in failures:
			printerr("Godot input failure: ", failure)
		get_tree().quit(1)


func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
