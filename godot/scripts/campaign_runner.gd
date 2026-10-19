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
	main.state.save_path = "user://campaign_test_%d.json" % OS.get_process_id()
	main.state.backup_path = "user://campaign_test_%d.backup.json" % OS.get_process_id()
	main.state.delete_save()
	main.new_game()
	var chapters: Array = main.state.chapters()
	for index in chapters.size():
		var chapter: Dictionary = chapters[index]
		main.chapter_index = index
		main.state.current_chapter = index
		for hero_id in main.state.heroes():
			if not main.state.recruited.has(hero_id):
				main.state.recruited.append(hero_id)
			main.state.roster[hero_id] = {"level": 20, "xp": 0, "equipment": {}}
		main.state.team.assign(["linchong", "luzhishen", "wusong"])
		main.state.set_team_slot(0, "linchong")
		main.state.set_team_slot(1, "luzhishen")
		main.state.set_team_slot(2, "wusong")
		main.enter_chapter()
		var guard := 0
		while main.screen == "story" and guard < 30:
			guard += 1
			main.next_story()
			await get_tree().process_frame
		_check(main.screen == "choice", "chapter %s should reach its choice" % chapter.get("id", ""))
		if main.screen == "choice":
			main.choose_option(0)
			await get_tree().process_frame
		var battle = main.battle
		_check(battle != null, "chapter %s should start a battle" % chapter.get("id", ""))
		if battle == null:
			continue
		for _attempt in 300:
			if battle.battle_finished:
				break
			var choice := AutoBattle.choose(battle, "hunter")
			if choice.is_empty():
				break
			main.battle_target = int(choice.target)
			battle.select_skill(int(choice.skill_index))
			main.perform_attack()
			await get_tree().process_frame
		_check(battle.battle_finished, "chapter %s battle should resolve" % chapter.get("id", ""))
		_check(battle.victory, "chapter %s battle should be winnable" % chapter.get("id", ""))
		_check(main.screen == "reward", "chapter %s victory should reach rewards (%s)" % [chapter.get("id", ""), main.screen])
		_check(main.state.completed_chapters.has(str(chapter.get("id", ""))), "chapter %s should be persisted as complete" % chapter.get("id", ""))
		if index == chapters.size() - 1 and main.screen == "reward":
			main.show_ending()
		await get_tree().process_frame
	_check(main.screen == "ending", "the final chapter should open a native ending")
	_check(main.state.current_chapter == chapters.size() - 1, "the final chapter should remain available after completion")
	_stress_auto_rating()
	main.state.delete_save()
	if main.music_player:
		main.music_player.stop()
		main.music_player.stream = null
	main.theme = null
	main.queue_free()
	await get_tree().process_frame
	await get_tree().process_frame
	if failures.is_empty():
		print("Godot campaign passed: nine battles, unlocks, rewards and ending.")
		get_tree().quit(0)
	else:
		for failure in failures:
			printerr("Godot campaign failure: ", failure)
		get_tree().quit(1)


func _stress_auto_rating() -> void:
	main.chapter_index = 0
	main.state.current_chapter = 0
	var arena_state := GameState.new(main.game_data)
	arena_state.roster.linchong.level = 20
	for hero_id in ["luzhishen", "wusong"]:
		arena_state.recruited.append(hero_id)
		arena_state.roster[hero_id] = {"level": 20, "xp": 0, "equipment": {}}
	arena_state.team.assign(["linchong", "luzhishen", "wusong"])
	arena_state.set_team_slot(0, "linchong")
	arena_state.set_team_slot(1, "luzhishen")
	arena_state.set_team_slot(2, "wusong")
	var arena_battle := BattleModel.new(arena_state, arena_state.chapter())
	_check(arena_battle.heroes.size() == 3, "the prepared arena stress formation should have three heroes")
	arena_battle.enemies[0].max_hp = 60
	arena_battle.enemies[0].hp = 60
	for _attempt in 12:
		if arena_battle.battle_finished:
			break
		var pick := AutoBattle.choose(arena_battle, "balanced")
		if pick.is_empty():
			break
		arena_battle.hero_skill(int(pick.target), int(pick.skill_index))
	_check(arena_battle.battle_finished, "auto tactics should be able to finish a short battle")


func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
