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
	main.state.save_path = "user://native_ime_test_%d.json" % OS.get_process_id()
	main.state.backup_path = "user://native_ime_test_%d.backup.json" % OS.get_process_id()
	main.state.delete_save()
	main.show_settings()
	await get_tree().process_frame
	var activation_deadline := Time.get_ticks_msec() + 20_000
	while not DisplayServer.window_is_focused() and Time.get_ticks_msec() < activation_deadline:
		await get_tree().create_timer(0.1).timeout
	var request_path := _state_directory().path_join("ime_test.request.json")
	var response_path := _state_directory().path_join("ime_test.response.txt")
	var input := main.settings_layer.find_child("PlayerName", true, false) as LineEdit
	_check(input != null, "native settings input should be available")
	if input == null:
		_finish()
		return
	_check(input.has_focus(), "settings should focus the Chinese input")
	_check(not main.native_name_input.available or main.native_name_input.available, "native input bridge should initialize without breaking settings")
	_check(DisplayServer.window_is_focused(), "game window should own native keyboard focus")
	if FileAccess.file_exists(request_path):
		DirAccess.remove_absolute(request_path)
	if FileAccess.file_exists(response_path):
		DirAccess.remove_absolute(response_path)
	var request := FileAccess.open(request_path, FileAccess.WRITE)
	_check(request != null, "native IME test request should be writable")
	if request == null:
		_finish()
		return
	request.store_string(JSON.stringify({
		"sentinel": "星命输入法测试",
		"buttons": _visible_button_names(),
	}))
	request.close()
	print("Godot native IME test ready: ", request_path)
	var deadline := Time.get_ticks_msec() + 180_000
	var received_response := false
	while Time.get_ticks_msec() < deadline:
		await get_tree().create_timer(0.2).timeout
		if not FileAccess.file_exists(response_path):
			continue
		var response := FileAccess.get_file_as_string(response_path)
		if response.is_empty():
			continue
		var parsed = JSON.parse_string(response)
		_check(parsed is Dictionary, "native IME response should be valid JSON")
		if parsed is Dictionary:
			_check(bool(parsed.get("clipboardRoundTrip", false)), "native Chinese clipboard round trip should work")
			_check(str(parsed.get("focusRecovered", "")) == "我是测试", "game window should regain native Chinese focus")
			_check(str(parsed.get("text", "")) == "我是测试", "native IME composition should commit Chinese text")
			_check(str(parsed.get("input", "")) == "我是测试", "Chinese text should appear in the game input")
			received_response = true
		break
	if not received_response:
		_check(false, "native IME test helper should respond within 180 seconds")
	if FileAccess.file_exists(request_path):
		DirAccess.remove_absolute(request_path)
	if FileAccess.file_exists(response_path):
		DirAccess.remove_absolute(response_path)
	main.state.delete_save()
	_finish()


func _visible_button_names() -> Array[String]:
	var buttons: Array[String] = []
	for button in main.settings_layer.find_children("*", "Button", true, false):
		if button is Button and button.is_visible_in_tree():
			buttons.append(button.text)
	return buttons


func _state_directory() -> String:
	return OS.get_environment("HOME").path_join(".codex-godot-native-input")


func _finish() -> void:
	main.music_player.stop()
	main.music_player.stream = null
	main.theme = null
	main.queue_free()
	await get_tree().process_frame
	if failures.is_empty():
		print("Godot native IME passed: clipboard round trip, window focus and Chinese text.")
		get_tree().quit(0)
	else:
		for failure in failures:
			printerr("Godot native IME failure: ", failure)
		get_tree().quit(1)


func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
