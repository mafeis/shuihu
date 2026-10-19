extends Node

var main: Control
var capture_dir := "/tmp/shuihu-godot-visual"


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	DirAccess.make_dir_recursive_absolute(capture_dir)
	var scene := load("res://scenes/main.tscn") as PackedScene
	main = scene.instantiate()
	get_tree().root.add_child(main)
	await _capture("title")
	main.state.delete_save()
	main.show_settings()
	await _capture("settings")
	var player_name := main.settings_layer.find_child("PlayerName", true, false) as LineEdit
	if player_name == null:
		printerr("Visual screenshot setup failed: text input missing")
		get_tree().quit(1)
		return
	player_name.text = "替天行道"
	await _capture("settings_cjk")
	main.close_settings()
	main.new_game()
	await _capture("map")
	main.enter_chapter()
	await _capture("story")
	while main.screen == "story":
		main.next_story()
		await get_tree().process_frame
	await _capture("choice")
	main.choose_option(0)
	main.battle.enemies[0].hp = 0
	main.battle_target = main.battle.living_enemies().size() - 1
	main.battle.select_skill(0)
	main.show_battle()
	await _capture("battle")
	main.show_camp()
	await _capture("camp")
	main.show_roster()
	await _capture("roster")
	main.state.delete_save()
	print("Godot visual capture complete: ", capture_dir)
	get_tree().quit(0)


func _capture(name: String) -> void:
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	var result := image.save_png(capture_dir.path_join(name + ".png"))
	if result != OK:
		printerr("Unable to save screenshot ", name, ": ", error_string(result))
