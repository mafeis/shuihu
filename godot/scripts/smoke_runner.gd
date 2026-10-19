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
	main.state.save_path = "user://smoke_test_%d.json" % OS.get_process_id()
	main.state.backup_path = "user://smoke_test_%d.backup.json" % OS.get_process_id()
	main.state.delete_save()
	_check(main.screen == "title", "title screen should boot")
	main.new_game()
	await get_tree().process_frame
	_check(main.screen == "map", "new game should open the campaign map")
	main.enter_chapter()
	await get_tree().process_frame
	_check(main.screen == "story", "chapter entry should open story")
	for index in 8:
		if main.screen != "story":
			break
		main.next_story()
		await get_tree().process_frame
	_check(main.screen == "choice", "story should reach its tactic choice")
	main.choose_option(0)
	await get_tree().process_frame
	_check(main.screen == "battle", "choice should start a native battle")
	_check(main.battle != null and main.battle.heroes.size() == 1, "battle should load the starting formation")
	_check(main.battle != null and main.battle.enemies.size() == 2, "battle should load chapter enemies")
	for turn in 40:
		if main.battle == null or main.battle.battle_finished:
			break
		main.battle.select_skill(0)
		main.perform_attack()
		await get_tree().process_frame
	_check(main.battle != null and main.battle.battle_finished, "the first campaign battle should settle")
	_check(main.state.roster_entry("linchong").get("xp", 0) > 0 or main.state.roster_entry("linchong").get("level", 1) > 1, "campaign rewards should grant experience")
	_check(main.state.inventory.has("bamboo_token"), "chapter loot should enter the equipment inventory")
	main.show_camp()
	await get_tree().process_frame
	_check(main.screen == "camp", "native camp screen should open")
	main.show_camp_building("farmland")
	await get_tree().process_frame
	_check(main.menu_layer.visible, "camp buildings should open a native action panel")
	main.state.copper = 1000
	main.state.statistics.battles_won = maxi(2, int(main.state.statistics.battles_won))
	_check(main.state.build_camp_building("farmland"), "camp resources should be buildable")
	_check(main.state.collect_camp_resource("farmland") >= 2, "built resource sites should collect their product")
	_check(main.state.camp_stock.has("wheat"), "camp product should use the site resource rather than its building id")
	main.build_from_detail("tower")
	_check(main.state.camp_built.has("tower"), "tower actions should build through the native detail flow")
	main.show_roster()
	await get_tree().process_frame
	_check(main.screen == "roster", "native roster should open")
	main.state.recruit(main.game_data.get("chronicle_recruits", {}).get("shijin", []))
	_check(main.state.recruited.has("qinming"), "interlude recruits should be available for the roster")
	main.state.recruit(["luzhishen"])
	main.select_formation_slot(1)
	main.assign_hero_to_team("luzhishen")
	await get_tree().process_frame
	_check(main.state.team.has("luzhishen"), "recruited heroes should join the native formation")
	main.state.set_team_slot(0, "luzhishen")
	_check(main.state.team[0] == "luzhishen" and main.state.team[1] == "linchong", "formation slots should swap instead of duplicating a hero")
	_check(main.state.active_bonds().any(func(bond): return bond.id == "wind_snow"), "three-slot formations should activate pair bonds")
	main.show_equipment("luzhishen")
	await get_tree().process_frame
	_check(main.menu_layer.visible, "equipment overlay should open from the native roster")
	main.state.add_item("patrol_armor")
	var health_before: int = main.state.derive_hero_stats("luzhishen").max_hp
	if main.state.equip_item("luzhishen", "patrol_armor"):
		_check(int(main.state.derive_hero_stats("luzhishen").max_hp) != health_before, "equipped gear should change derived battle stats")
	if not main.state.camp_built.has("arena"):
		main.state.camp_built.append("arena")
	main.show_arena()
	await get_tree().process_frame
	_check(main.screen == "arena", "the arena should expose native encounter and boon choices")
	main.begin_arena_battle(main.arena_offer[0])
	await get_tree().process_frame
	_check(main.arena_running and main.battle.enemies.size() == 3, "arena battles should use the native battle field")
	main.arena_running = false
	main.state.current_chapter = 3
	main.recruitment_hero_id = "yangzhi"
	main.start_recruitment("yangzhi")
	await get_tree().process_frame
	_check(main.recruitment_running and main.screen == "story", "recruitment posts should open their own native story")
	for _line in 10:
		if main.screen == "choice":
			break
		main.advance_recruitment_story()
		await get_tree().process_frame
	_check(main.screen == "choice", "recruitment stories should reach their branch choice")
	main.choose_recruitment_option(0)
	await get_tree().process_frame
	main.advance_recruitment_story()
	for _line in 5:
		if main.screen == "battle":
			break
		main.advance_recruitment_story()
		await get_tree().process_frame
	_check(main.screen == "battle" and main.battle != null, "recruitment choices should lead to a native battle")
	main.state.mastery("linchong").trials.assign(["first_star", "oath_echo", "slayer_name"])
	main.state.doctrines.clear()
	_check(main.state.set_doctrine("linchong", "garrison"), "the native mastery data should select an unlocked doctrine")
	main.state.check_achievements()
	main.show_mastery("linchong")
	await get_tree().process_frame
	_check(main.menu_layer.visible, "native mastery study should open from the camp")
	main.show_achievements()
	await get_tree().process_frame
	_check(main.menu_layer.visible, "the native achievement ledger should open")
	main.show_settings()
	await get_tree().process_frame
	_check(main.settings_layer.visible, "settings overlay should open")
	main.close_settings()
	await get_tree().process_frame
	_check(not main.settings_layer.visible, "settings overlay should close")
	main.state.delete_save()
	await _close_game()
	if failures.is_empty():
		print("Godot smoke passed: native title, story, choice, battle, camp, roster and settings.")
		get_tree().quit(0)
	else:
		for failure in failures:
			printerr("Godot smoke failure: ", failure)
		get_tree().quit(1)


func _close_game() -> void:
	if main.music_player:
		main.music_player.stop()
		main.music_player.stream = null
	main.theme = null
	main.queue_free()
	await get_tree().process_frame
	await get_tree().process_frame


func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
