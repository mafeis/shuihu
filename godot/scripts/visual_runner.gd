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
	var real_save_path: String = main.state.save_path
	var real_backup_path: String = main.state.backup_path
	main.state.save_path = "user://visual_test_%d.json" % OS.get_process_id()
	main.state.backup_path = "user://visual_test_%d.backup.json" % OS.get_process_id()
	main.state.delete_save()
	await _capture("title")
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
	main.show_map()
	await _capture("map")
	main.new_game()
	await _capture("new_campaign_map")
	main.enter_chapter()
	await get_tree().process_frame
	main.next_story()
	await get_tree().process_frame
	await _capture("story_character")
	var final_line := 0
	while main.screen == "story" and final_line < 30:
		final_line += 1
		main.next_story()
	if main.screen == "choice":
		main.choose_option(0)
		main.battle.enemies[0].hp = 1000000
		main.battle.enemies[0].max_hp = 1000000
		main.battle.heroes[0].max_hp = maxi(100, int(main.battle.heroes[0].max_hp))
		main.battle.heroes[0].hp = 1
		main.perform_attack()
		await get_tree().create_timer(0.16).timeout
		await _capture("battle_defeat_feedback")
	main.show_camp()
	main.show_chronicles()
	await _capture("chronicles")
	main._dismiss_menu()
	main.screen_root.mouse_filter = Control.MOUSE_FILTER_PASS
	main.chronicle_hero_id = "linchong"
	main.state.current_chapter = 2
	main.state.roster.linchong.level = 3
	main.state.quest_claimed.assign(["linchong_old_tassel", "linchong_imperial_seal", "linchong_temple_after"])
	main.show_chronicles()
	await _capture("chronicles_legend")
	main._dismiss_menu()
	main._dismiss_menu()
	main.start_hero_legend("linchong")
	await get_tree().process_frame
	await _capture("legend_battle")
	main.legend_running = false
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
	main.battle.enemies[0].hp = 10000000
	main.battle.enemies[0].max_hp = 10000000
	main.battle.heroes[0].yiqi = 100
	main.perform_attack()
	await get_tree().create_timer(0.16).timeout
	await _capture("battle_feedback")
	await get_tree().create_timer(0.35).timeout
	await _capture("battle_feedback_second")
	main.show_camp()
	await _capture("camp")
	main.state.statistics.battles_won = maxi(2, int(main.state.statistics.battles_won))
	main.state.copper = maxi(1000, int(main.state.copper))
	main.state.camp_built.append("farmland")
	main.state.camp_built.append("tower")
	main.show_camp_building("farmland")
	await _capture("camp_detail")
	main._dismiss_menu()
	main.screen_root.mouse_filter = Control.MOUSE_FILTER_PASS
	main.show_roster()
	await _capture("roster")
	main.state.recruit(["luzhishen"])
	main.state.team.assign(["linchong", "luzhishen", ""])
	main.show_equipment("linchong")
	await _capture("equipment")
	main._dismiss_menu()
	main.screen_root.mouse_filter = Control.MOUSE_FILTER_PASS
	if not main.state.camp_built.has("arena"):
		main.state.camp_built.append("arena")
	main.show_arena()
	await _capture("arena")
	main.begin_arena_battle(main.arena_offer[0])
	await _capture("arena_battle")
	main.arena_running = false
	main.show_ending()
	await _capture("ending")
	main.state.delete_save()
	main.state.save_path = real_save_path
	main.state.backup_path = real_backup_path
	print("Godot visual capture complete: ", capture_dir)
	get_tree().quit(0)


func _capture(name: String) -> void:
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	var result := image.save_png(capture_dir.path_join(name + ".png"))
	if result != OK:
		printerr("Unable to save screenshot ", name, ": ", error_string(result))
