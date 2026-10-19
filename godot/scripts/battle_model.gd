class_name BattleModel
extends RefCounted

const ROWS := [
	{"name": "前阵", "defense": 1.1, "aggro": 1.45, "melee": 1.08},
	{"name": "中军", "defense": 1.0, "aggro": 1.0, "melee": 1.0},
	{"name": "后阵", "defense": 0.9, "aggro": 0.7, "melee": 0.94},
]

var state: GameState
var chapter_data: Dictionary
var heroes: Array[Dictionary] = []
var enemies: Array[Dictionary] = []
var current_actor_index := 0
var round_number := 1
var battle_finished := false
var victory := false
var log_lines: Array[String] = []
var selected_skill_index := 0
var rng := RandomNumberGenerator.new()
var difficulty_damage_taken := 1.0
var difficulty_rewards := 1.0
var player_won_last_battle := false


func _init(game_state: GameState, chapter: Dictionary) -> void:
	state = game_state
	chapter_data = chapter
	rng.randomize()
	if state.difficulty_id == "story":
		difficulty_damage_taken = 0.8
	elif state.difficulty_id == "hard":
		difficulty_damage_taken = 1.2
		difficulty_rewards = 1.15
	_build_heroes()
	_build_enemies()
	log_lines.push_front("第 %d 回·%s" % [round_number, chapter.get("title", "战阵")])
	log_lines.push_front("阵势已成。请选择招式与目标。")


func _build_heroes() -> void:
	var occupied_rows: Array[int] = []
	for hero_id in state.active_team():
		var config := state.hero(hero_id)
		if config.is_empty():
			continue
		var row := int(config.get("preferred_row", 1))
		while occupied_rows.has(row) and row < 2:
			row += 1
		occupied_rows.append(row)
		var base: Dictionary = config.get("base", {})
		var skills: Array = []
		for skill in config.get("skills", []):
			skills.append(skill.duplicate(true))
		var max_hp := int(base.get("hp", 400))
		heroes.append({
			"side": "hero",
			"hero_id": hero_id,
			"name": config.get("name", "好汉"),
			"nickname": config.get("nickname", ""),
			"path": config.get("path", "gang"),
			"row": row,
			"level": 1,
			"hp": max_hp,
			"max_hp": max_hp,
			"atk": int(base.get("atk", 50)),
			"def": int(base.get("def", 35)),
			"spd": int(base.get("spd", 30)),
			"yiqi": 40,
			"guard": 0,
			"skills": skills,
			"portrait": config.get("cutout", ""),
		})


func _build_enemies() -> void:
	var definitions: Array = chapter_data.get("battle", {}).get("enemies", [])
	var used_rows: Array[int] = []
	for definition in definitions:
		var enemy_id := str(definition.get("id", "runner"))
		var config: Dictionary = state.enemies().get(enemy_id, {})
		var base: Dictionary = config.get("base", {})
		var row := int(definition.get("row", 1))
		while used_rows.has(row) and row < 2:
			row += 1
		used_rows.append(row)
		var max_hp := int(round(float(base.get("hp", 200)) * (1.0 + int(definition.get("level", 1)) * 0.09)))
		var skills: Array = []
		for skill in config.get("skills", []):
			skills.append(skill.duplicate(true))
		if skills.is_empty():
			skills.append({"id": "enemy_strike", "name": "挥击", "target": "enemy", "power": 0.9})
		enemies.append({
			"side": "enemy",
			"enemy_id": enemy_id,
			"name": config.get("name", "官军"),
			"path": config.get("path", "gang"),
			"row": row,
			"level": int(definition.get("level", 1)),
			"hp": max_hp,
			"max_hp": max_hp,
			"atk": int(base.get("atk", 35)),
			"def": int(base.get("def", 18)),
			"spd": int(base.get("spd", 28)),
			"yiqi": 0,
			"guard": 0,
			"skills": skills,
			"portrait": config.get("sprite", ""),
		})


func current_hero() -> Dictionary:
	if heroes.is_empty():
		return {}
	current_actor_index = wrapi(current_actor_index, 0, heroes.size())
	while heroes[current_actor_index].hp <= 0:
		current_actor_index = (current_actor_index + 1) % heroes.size()
		if all_heroes_defeated():
			return {}
	return heroes[current_actor_index]


func selected_skill() -> Dictionary:
	var actor := current_hero()
	if actor.is_empty():
		return {}
	var list: Array = actor.skills
	selected_skill_index = clampi(selected_skill_index, 0, maxi(list.size() - 1, 0))
	return list[selected_skill_index] if not list.is_empty() else {}


func select_skill(index: int) -> void:
	var actor := current_hero()
	if actor.is_empty():
		return
	selected_skill_index = clampi(index, 0, actor.skills.size() - 1)


func living_enemies() -> Array[Dictionary]:
	return enemies.filter(func(unit): return unit.hp > 0)


func living_heroes() -> Array[Dictionary]:
	return heroes.filter(func(unit): return unit.hp > 0)


func all_heroes_defeated() -> bool:
	return living_heroes().is_empty()


func all_enemies_defeated() -> bool:
	return living_enemies().is_empty()


func hero_skill(target_index: int) -> Dictionary:
	if battle_finished:
		return {"ok": false, "reason": "finished"}
	var actor := current_hero()
	var skill := selected_skill()
	if actor.is_empty() or skill.is_empty():
		return {"ok": false, "reason": "no_actor"}
	if not _can_use_skill(actor, skill):
		return {"ok": false, "reason": "yiqi"}
	if skill.get("ultimate", false):
		actor.yiqi = 0
	else:
		actor.yiqi = mini(100, actor.yiqi + int(skill.get("yiqi", 12)))
	_apply_skill(actor, skill, target_index)
	return {"ok": true}


func _can_use_skill(actor: Dictionary, skill: Dictionary) -> bool:
	return int(skill.get("yiqiCost", 0)) <= int(actor.yiqi)


func can_use_selected_skill() -> bool:
	var actor := current_hero()
	return not actor.is_empty() and _can_use_skill(actor, selected_skill())


func _apply_skill(actor: Dictionary, skill: Dictionary, target_index: int) -> void:
	var target_type := str(skill.get("target", "enemy"))
	var hits := maxi(1, int(skill.get("hits", 1)))
	var power := float(skill.get("power", 0.8))
	var targets: Array[Dictionary] = []
	if target_type == "allEnemies":
		targets = living_enemies()
	else:
		var list := living_enemies()
		if list.is_empty():
			return
		targets = [list[clampi(target_index, 0, list.size() - 1)]]
	for target in targets:
		for hit in hits:
			if target.hp <= 0:
				break
			var variance := rng.randf_range(0.92, 1.08)
			var raw := float(actor.atk) * power * variance
			var mitigation := float(target.def) * 0.55
			var damage := maxi(1, int(round((raw - mitigation) * _path_multiplier(actor.path, target.path))))
			if targets.size() == 1 and hit == hits - 1 and skill.get("finalCrit", false):
				damage = int(round(damage * 1.65))
			target.hp = maxi(0, target.hp - damage)
			log_lines.push_front("%s施展「%s」对%s造成 %d 伤害。" % [actor.name, skill.get("name", "招式"), target.name, damage])
			if target.hp <= 0:
				log_lines.push_front("%s败退。" % target.name)
	if target_type == "allAllies":
		for unit in living_heroes():
			unit.guard = maxi(unit.guard, 1)
		log_lines.push_front("全队获得护御。")
	if all_enemies_defeated():
		battle_finished = true
		victory = true
		player_won_last_battle = true
		log_lines.push_front("战阵已破，胜利。")
	else:
		_next_turn()


func _path_multiplier(attack_path: String, defense_path: String) -> float:
	var paths: Dictionary = state.paths()
	var attack_info: Dictionary = paths.get(attack_path, {})
	if str(attack_info.get("beats", "")) == defense_path:
		return 1.25
	var defense_info: Dictionary = paths.get(defense_path, {})
	if str(defense_info.get("beats", "")) == attack_path:
		return 0.82
	return 1.0


func _next_turn() -> void:
	if battle_finished:
		return
	current_actor_index = (current_actor_index + 1) % maxi(heroes.size(), 1)
	var attempts := 0
	while current_actor_index < heroes.size() and heroes[current_actor_index].hp <= 0 and attempts < heroes.size():
		current_actor_index = (current_actor_index + 1) % heroes.size()
		attempts += 1
	if current_actor_index == 0:
		round_number += 1
		if not enemy_turn():
			return


func enemy_turn() -> bool:
	if battle_finished:
		return false
	for enemy in living_enemies():
		var targets := living_heroes()
		if targets.is_empty():
			battle_finished = true
			victory = false
			return false
		targets.sort_custom(func(a, b): return a.hp < b.hp)
		var target := targets[0]
		var skill_list: Array = enemy.skills
		var skill: Dictionary = skill_list[rng.randi_range(0, skill_list.size() - 1)]
		var raw := float(enemy.atk) * float(skill.get("power", 0.8))
		var row_info: Dictionary = ROWS[clampi(target.row, 0, ROWS.size() - 1)]
		var guard_multiplier := 0.78 if target.guard > 0 else 1.0
		var damage := maxi(1, int(round((raw - float(target.def) * 0.55) / float(row_info.defense) * guard_multiplier * difficulty_damage_taken)))
		target.hp = maxi(0, target.hp - damage)
		target.guard = maxi(0, target.guard - 1)
		log_lines.push_front("%s施展「%s」对%s造成 %d 伤害。" % [enemy.name, skill.get("name", "挥击"), target.name, damage])
		if target.hp <= 0:
			log_lines.push_front("%s力竭倒下。" % target.name)
	if all_heroes_defeated():
		battle_finished = true
		victory = false
		log_lines.push_front("我方全阵败退。")
	return not battle_finished


func total_team_power() -> int:
	var total := 0
	for hero in heroes:
		total += int(hero.hp) + int(hero.atk) * 4 + int(hero.def) * 3 + int(hero.spd) * 2
	return total
