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
var damage_dealt := 0
var enemies_defeated := 0
var modifiers: Dictionary = {}
var enemy_modifiers: Dictionary = {}
var selected_target_index := 0
var bond_ids: Array[String] = []
var bond_trigger_rounds: Dictionary = {}
var chain_heroes: Array[String] = []
var chain_ready := false
var chain_attacks := 0
var chain_formation_ids: Array[String] = []
var arena_encounter: Dictionary = {}
var boss_phase_triggered := {}
var reward_lines: Array[String] = []
var level_ups := 0
var ultimate_uses: Dictionary = {}
var damage_by_hero: Dictionary = {}


func _init(game_state: GameState, chapter: Dictionary, battle_modifiers: Dictionary = {}, battle_enemy_modifiers: Dictionary = {}) -> void:
	state = game_state
	chapter_data = chapter
	modifiers = state.team_modifiers()
	var special_rule: Dictionary = chapter_data.get("special_rule", {})
	var special_effects: Dictionary = special_rule.get("effects", {})
	enemy_modifiers = battle_enemy_modifiers.duplicate(true)
	for key in special_effects.get("enemyModifiers", {}):
		enemy_modifiers[key] = float(enemy_modifiers.get(key, 0.0)) + float(special_effects.enemyModifiers[key])
	for key in special_effects.get("teamModifiers", {}):
		modifiers[key] = float(modifiers.get(key, 0.0)) + float(special_effects.teamModifiers[key])
	for key in battle_modifiers:
		modifiers[key] = float(modifiers.get(key, 0.0)) + float(battle_modifiers[key])
	for bond in state.active_bonds():
		bond_ids.append(str(bond.get("id", "")))
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
	for row in state.team.size():
		var hero_id := state.team[row]
		if hero_id.is_empty() or not state.recruited.has(hero_id):
			continue
		var config := state.hero(hero_id)
		if config.is_empty():
			continue
		var stats := state.derive_hero_stats(hero_id)
		var skills: Array = []
		for skill in config.get("skills", []):
			skills.append(skill.duplicate(true))
		var max_hp := int(stats.max_hp)
		max_hp = int(round(max_hp * (1.0 + float(modifiers.get("hpPct", 0)))))
		var starting_hp := max_hp
		if float(modifiers.get("waveHealPct", 0)) > 0:
			starting_hp = int(round(float(max_hp) * float(modifiers.waveHealPct)))
		var yiqi_multiplier := 1.0 + (int(state.facilities.get("tower", 1)) - 1) * 0.1
		heroes.append({
			"side": "hero",
			"hero_id": hero_id,
			"name": config.get("name", "好汉"),
			"nickname": config.get("nickname", ""),
			"path": config.get("path", "gang"),
			"row": row,
			"level": int(stats.level),
			"hp": starting_hp,
			"max_hp": max_hp,
			"atk": int(round(float(stats.atk) * (1.0 + float(modifiers.get("atkPct", 0))))),
			"def": int(round(float(stats.def) * (1.0 + float(modifiers.get("defPct", 0))))),
			"spd": int(round(float(stats.spd) * (1.0 + float(modifiers.get("spdPct", 0))))),
			"yiqi": mini(100, 40 + int(modifiers.get("startYiqi", 0))),
			"yiqi_multiplier": yiqi_multiplier,
			"statuses": {},
			"cooldowns": {},
			"poise": 0,
			"poise_max": 100,
			"broken": 0,
			"skills": skills,
			"portrait": config.get("cutout", ""),
		})
		var built := heroes[-1]
		if int(modifiers.get("openingGuard", 0)) > 0:
			built.statuses["guard"] = int(modifiers.openingGuard)
		if int(modifiers.get("openingInspiration", 0)) > 0:
			built.statuses["inspiration"] = int(modifiers.openingInspiration)
	for status_info in _opening_statuses("heroOpeningStatuses"):
		for hero in heroes:
			hero.statuses[status_info.status] = maxi(int(hero.statuses.get(status_info.status, 0)), int(status_info.duration))


func _build_enemies() -> void:
	var battle_section: Dictionary = chapter_data.get("battle", {})
	var definitions: Array = battle_section.get("enemies", [])
	var used_rows: Array[int] = []
	for definition in definitions:
		var enemy_id := str(definition.get("id", "runner"))
		var config: Dictionary = state.enemies().get(enemy_id, {})
		var base: Dictionary = config.get("base", {})
		var row := int(definition.get("row", 1))
		while used_rows.has(row) and row < 2:
			row += 1
		used_rows.append(row)
		var scale := 1.0 + maxi(0, int(definition.get("level", 1)) - 1) * 0.11
		var max_hp := int(round(float(base.get("hp", 200)) * scale * (1.0 + float(enemy_modifiers.get("hpPct", 0)))))
		var skills: Array = []
		for skill in config.get("skills", []):
			skills.append(skill.duplicate(true))
		if skills.is_empty():
			skills.append({"id": "enemy_strike", "name": "挥击", "target": "enemy", "power": 0.9})
		enemies.append({
			"side": "enemy",
			"enemy_id": enemy_id,
			"boss": bool(definition.get("boss", false)),
			"name": config.get("name", "官军"),
			"path": config.get("path", "gang"),
			"row": row,
			"level": int(definition.get("level", 1)),
			"hp": max_hp,
			"max_hp": max_hp,
			"atk": int(round(float(base.get("atk", 35)) * scale * (1.0 + float(enemy_modifiers.get("atkPct", 0))))),
			"def": int(round(float(base.get("def", 18)) * scale * (1.0 + float(enemy_modifiers.get("defPct", 0))))),
			"spd": int(round(float(base.get("spd", 28)) * scale)),
			"yiqi": 0,
			"statuses": {},
			"cooldowns": {},
			"poise": 0,
			"poise_max": maxi(50, int(float(config.get("poise", 80)) * (1.0 + (int(definition.get("level", 1)) - 1) * 0.08))),
			"broken": 0,
			"skills": skills,
			"portrait": config.get("sprite", ""),
		})
		var built := enemies[-1]
		built.boss = definition.get("boss", false) == true or (
			battle_section.get("boss", false) == true
			and enemies[-1] == enemies[0]
		)
		if int(modifiers.get("enemyStartPoisePct", 0)) > 0:
			built.poise = int(round(float(built.poise_max) * float(modifiers.enemyStartPoisePct)))
		if int(modifiers.get("openingGuard", 0)) > 0 and row == 0:
			built.statuses["guard"] = int(modifiers.openingGuard)
	for status_info in _opening_statuses("enemyOpeningStatuses"):
		for built in enemies:
			if int(status_info.get("row", -1)) == int(built.row) or int(status_info.get("row", -1)) < 0:
				built.statuses[status_info.status] = maxi(int(built.statuses.get(status_info.status, 0)), int(status_info.duration))
	if not bond_ids.is_empty():
		var names: Array[String] = []
		for bond in state.active_bonds():
			names.append(str(bond.get("name", "")))
		log_lines.push_front("兄弟契成阵：" + "、".join(names))
	var rule_copy: Dictionary = chapter_data.get("special_rule", {})
	if not rule_copy.is_empty():
		log_lines.push_front("阵势·%s：%s" % [rule_copy.get("name", ""), rule_copy.get("desc", "")])


func _opening_statuses(key: String) -> Array:
	var combined: Array = []
	combined.append_array(chapter_data.get("special_rule", {}).get("effects", {}).get(key, []))
	combined.append_array(arena_encounter.get("effects", {}).get(key, []))
	return combined


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


func skill_by_index(actor: Dictionary, index: int) -> Dictionary:
	var list: Array = actor.get("skills", [])
	return list[clampi(index, 0, maxi(list.size() - 1, 0))] if not list.is_empty() else {}


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


func hero_skill(target_index: int, skill_index := -1) -> Dictionary:
	if battle_finished:
		return {"ok": false, "reason": "finished"}
	var actor := current_hero()
	var skill := selected_skill() if skill_index < 0 else skill_by_index(actor, skill_index)
	if actor.is_empty() or skill.is_empty():
		return {"ok": false, "reason": "no_actor"}
	if not _can_use_skill(actor, skill):
		return {"ok": false, "reason": "yiqi"}
	if int(actor.cooldowns.get(skill.get("id", ""), 0)) > 0:
		return {"ok": false, "reason": "cooldown"}
	_apply_skill(actor, skill, target_index)
	return {"ok": true}


func _can_use_skill(actor: Dictionary, skill: Dictionary) -> bool:
	return int(skill.get("yiqiCost", 0)) <= int(actor.yiqi) and int(actor.get("cooldowns", {}).get(skill.get("id", ""), 0)) <= 0


func can_use_selected_skill() -> bool:
	var actor := current_hero()
	return not actor.is_empty() and _can_use_skill(actor, selected_skill())


func can_use_skill(skill: Dictionary) -> bool:
	var actor := current_hero()
	return not actor.is_empty() and not skill.is_empty() and _can_use_skill(actor, skill)


func is_ally_target(skill: Dictionary) -> bool:
	return str(skill.get("target", "")) in ["ally", "allAllies", "self"]


func is_targeting_all() -> bool:
	return str(selected_skill().get("target", "")) in ["allEnemies", "allAllies", "self"]


func valid_targets(skill: Dictionary) -> Array[Dictionary]:
	var target_type := str(skill.get("target", "enemy"))
	if target_type in ["allEnemies", "allAllies"]:
		return living_enemies() if target_type == "allEnemies" else living_heroes()
	if target_type == "self":
		return [current_hero()]
	if target_type == "ally":
		return living_heroes()
	return living_enemies()


func target_auto_index(skill: Dictionary, target_index: int = 0) -> int:
	var target_type := str(skill.get("target", "enemy"))
	var targets := valid_targets(skill)
	if targets.is_empty():
		return 0
	if target_type == "ally":
		var sorted := targets.duplicate()
		sorted.sort_custom(func(a, b): return float(a.hp) / float(a.max_hp) < float(b.hp) / float(b.max_hp))
		return targets.find(sorted[0])
	if target_type in ["lowestEnemy", "backEnemy", "frontEnemy"]:
		var sorted := targets.duplicate()
		if target_type == "lowestEnemy":
			sorted.sort_custom(func(a, b): return float(a.hp) / float(a.max_hp) < float(b.hp) / float(b.max_hp))
		elif target_type == "backEnemy":
			sorted.sort_custom(func(a, b): return int(a.row) > int(b.row) or (int(a.row) == int(b.row) and int(a.spd) > int(b.spd)))
		else:
			sorted.sort_custom(func(a, b): return int(a.row) < int(b.row))
		return targets.find(sorted[0])
	return clampi(target_index, 0, targets.size() - 1)


func _apply_skill(actor: Dictionary, skill: Dictionary, target_index: int) -> void:
	var target_type := str(skill.get("target", "enemy"))
	var hits := maxi(1, int(skill.get("hits", 1)))
	var power := float(skill.get("power", 0.8))
	var targets: Array[Dictionary] = []
	if target_type in ["allEnemies", "allAllies", "self", "ally"]:
		var all_targets := valid_targets(skill)
		targets.assign(all_targets.filter(func(unit): return int(unit.hp) > 0))
	else:
		var list := valid_targets(skill)
		if list.is_empty():
			return
		targets.assign([list[clampi(target_auto_index(skill, target_index), 0, list.size() - 1)]])
	var cost := int(skill.get("yiqiCost", 0))
	if cost >= 100:
		var actor_id := str(actor.get("hero_id", ""))
		ultimate_uses[actor_id] = int(ultimate_uses.get(actor_id, 0)) + 1
	actor.yiqi = maxi(0, int(actor.yiqi) - cost)
	if int(skill.get("cooldown", 0)) > 0:
		actor.cooldowns[skill.get("id", "")] = int(skill.cooldown)
	for target in targets:
		for hit in hits:
			if target.hp <= 0:
				break
			var variance := rng.randf_range(0.92, 1.08)
			var raw := float(actor.atk) * power * 1.82 * variance
			if target_type == "allEnemies":
				raw *= 1.0 + float(modifiers.get("allEnemiesPowerPct", 0))
			var mitigation := float(target.def) * 0.55
			var path_multiplier := _path_multiplier(actor.path, target.path)
			if int(target.get("broken", 0)) > 0:
				raw *= 1.22 + float(modifiers.get("brokenDamageBonus", 0))
			if int(target.statuses.get("armorBreak", 0)) > 0:
				raw *= 1.15
			var damage := maxi(1, int(round((raw - mitigation) * path_multiplier)))
			if hit == hits - 1 and skill.get("finalCrit", false):
				damage = int(round(damage * 1.65))
			target["hp"] = maxi(0, int(target["hp"]) - damage)
			damage_dealt += damage
			var actor_id := str(actor.get("hero_id", ""))
			if not actor_id.is_empty():
				damage_by_hero[actor_id] = int(damage_by_hero.get(actor_id, 0)) + damage
			log_lines.push_front("%s施展「%s」对%s造成 %d 伤害。" % [actor.name, skill.get("name", "招式"), target.name, damage])
			if target.side == "enemy" and target.hp > 0:
				var poise_damage := int(round(float(skill.get("poise", 8)) * (1.0 + float(modifiers.get("poisePct", 0)))))
				target.poise = mini(int(target.poise_max), int(target.poise) + poise_damage)
				if int(target.poise) >= int(target.poise_max):
					target.poise = 0
					target.broken = 2
					log_lines.push_front("%s护势崩解，露出破绽。" % target.name)
			if target.hp <= 0:
				enemies_defeated += 1
				reward_lines.append("%s败退" % target.name)
				var defeat_statuses: Dictionary = arena_encounter.get("effects", {}).get("onEnemyDefeat", {}).duplicate(true)
				for status in chapter_data.get("special_rule", {}).get("effects", {}).get("onEnemyDefeat", {}):
					defeat_statuses[status] = chapter_data.special_rule.effects.onEnemyDefeat[status]
				for enemy in living_enemies():
					for status in defeat_statuses:
						enemy.statuses[status] = maxi(int(enemy.statuses.get(status, 0)), int(defeat_statuses[status]))
				if bond_ids.has("swift_walker") and _claim_bond_trigger("swift_walker"):
					for hero in living_heroes():
						hero.yiqi = mini(100, int(hero.yiqi) + 10)
					log_lines.push_front("行者神行：全队获得 10 义气。")
				log_lines.push_front("%s败退。" % target.name)
	if float(skill.get("heal", 0)) > 0:
		for target in targets:
			if target.hp > 0:
				var amount := maxi(1, int(round(float(actor.atk) * float(skill.heal) * 1.55 * (1.0 + float(modifiers.get("healPct", 0))))))
				var recovered := mini(target.max_hp - target.hp, amount)
				target.hp += recovered
				log_lines.push_front("%s恢复 %d 生命。" % [target.name, recovered])
	_apply_skill_effects(actor, skill, targets)
	actor.yiqi = mini(100, int(actor.yiqi) + int(round(int(skill.get("yiqi", 12)) * float(actor.get("yiqi_multiplier", 1.0)) * (1.0 + float(modifiers.get("yiqiPct", 0))))))
	_update_chain(actor, skill)
	if all_enemies_defeated():
		battle_finished = true
		victory = true
		player_won_last_battle = true
		log_lines.push_front("战阵已破，胜利。")
	else:
		_next_turn()


func chain_paths() -> Array[String]:
	var result: Array[String] = []
	for hero_id in chain_heroes:
		for hero in living_heroes():
			if str(hero.get("hero_id", "")) == hero_id and not result.has(str(hero.path)):
				result.append(str(hero.path))
	return result


func chain_formation() -> Dictionary:
	var paths := chain_paths()
	var catalog: Dictionary = state.data.get("chain_formations", {})
	for formation in catalog.values():
		var members: Array = formation.get("paths", [])
		if members.size() != paths.size():
			continue
		var matches := true
		for path in members:
			if not paths.has(str(path)):
				matches = false
				break
		if matches:
			return formation
	return {"id": "three_star", "name": "三星同辉", "powerPct": 0.0, "poiseBonus": 0}


func chain_attack() -> Dictionary:
	if battle_finished or not chain_ready:
		return {"ok": false, "reason": "chain"}
	var participants: Array[Dictionary] = []
	for hero_id in chain_heroes:
		for hero in living_heroes():
			if str(hero.get("hero_id", "")) == hero_id:
				participants.append(hero)
	if participants.is_empty():
		participants = living_heroes()
	var formation := chain_formation()
	var formation_power := float(formation.get("powerPct", 0)) * (1.0 + float(modifiers.get("chainPowerPct", 0)))
	var total_force := 0.0
	for actor in participants:
		total_force += float(actor.atk) * 0.58 + 14.0
	total_force *= 1.0 + formation_power
	var names: Array[String] = []
	for actor in participants:
		names.append(str(actor.name))
	log_lines.push_front("%s踏星换位，结成「%s」。" % ["、".join(names), formation.get("name", "三星同辉")])
	var target_list := living_enemies()
	for target in target_list:
		var damage := maxi(1, int(round(total_force * 1.58 - float(target.def) * 0.42)))
		target.hp = maxi(0, int(target.hp) - damage)
		damage_dealt += damage
		target.poise += maxi(1, int(formation.get("poiseBonus", 0)))
		log_lines.push_front("合击对%s造成 %d 伤害。" % [target.name, damage])
	for hero in living_heroes():
		var team_guard := int(formation.get("teamGuard", 0))
		if team_guard > 0:
			hero.statuses["guard"] = maxi(int(hero.statuses.get("guard", 0)), team_guard)
		var heal_pct := float(formation.get("teamHealPct", 0))
		if heal_pct > 0:
			hero.hp = mini(int(hero.max_hp), int(hero.hp) + int(round(float(hero.max_hp) * heal_pct)))
		if int(formation.get("teamInspiration", 0)) > 0:
			hero.statuses["inspiration"] = maxi(int(hero.statuses.get("inspiration", 0)), int(formation.teamInspiration))
		hero.yiqi = mini(100, int(hero.yiqi) + int(formation.get("teamYiqiBonus", 0)))
	var status_info: Dictionary = formation.get("enemyStatus", {})
	if not status_info.is_empty():
		for target in living_enemies():
			target.statuses[status_info.status] = maxi(int(target.statuses.get(status_info.status, 0)), int(status_info.duration))
	var formation_id := str(formation.get("id", "three_star"))
	if not chain_formation_ids.has(formation_id):
		chain_formation_ids.append(formation_id)
	chain_ready = false
	chain_heroes.clear()
	chain_attacks += 1
	if all_enemies_defeated():
		battle_finished = true
		victory = true
		player_won_last_battle = true
		log_lines.push_front("星命合击破阵，胜利。")
	else:
		_next_turn()
	return {"ok": true}


func _update_chain(actor: Dictionary, skill: Dictionary) -> void:
	if chain_ready or bool(skill.get("combo_disabled", false)):
		return
	var actor_id := str(actor.get("hero_id", ""))
	chain_heroes = chain_heroes.filter(func(hero_id): return hero_id != actor_id and living_heroes().any(func(hero): return str(hero.get("hero_id", "")) == hero_id))
	chain_heroes.append(actor_id)
	if chain_heroes.size() > 3:
		chain_heroes.pop_front()
	if chain_paths().size() >= 3:
		chain_ready = true
		log_lines.push_front("三路星火已经蓄势，可结成「%s」。" % chain_formation().get("name", "三星同辉"))


func _claim_bond_trigger(bond_id: String) -> bool:
	if not bond_ids.has(bond_id) or int(bond_trigger_rounds.get(bond_id, 0)) == round_number:
		return false
	bond_trigger_rounds[bond_id] = round_number
	return true


func _apply_skill_effects(actor: Dictionary, skill: Dictionary, targets: Array[Dictionary]) -> void:
	for effect in skill.get("effects", []):
		var effect_type := str(effect.get("type", ""))
		var status := str(effect.get("status", ""))
		var duration := int(effect.get("duration", 1))
		var applied: Array[Dictionary] = []
		match effect_type:
			"status":
				applied = targets
			"selfStatus":
				applied = [actor]
			"targetStatus":
				applied = [targets[0]] if not targets.is_empty() else []
			"teamStatus":
				applied = living_heroes()
		if not status.is_empty():
			for target in applied:
				if target.hp <= 0 or (effect.get("chance", 1.0) < 1.0 and rng.randf() > float(effect.chance)):
					continue
				var statuses: Dictionary = target.statuses
				statuses[status] = maxi(int(statuses.get(status, 0)), duration)
				log_lines.push_front("%s获得%s。" % [target.name, _status_name(status)])
		match effect_type:
			"teamCleanse", "targetCleanse":
				var cleanse_targets: Array[Dictionary] = living_heroes() if effect_type == "teamCleanse" else ([targets[0]] if not targets.is_empty() else [])
				for target in cleanse_targets:
					if target.hp > 0:
						for bad in ["armorBreak", "bleeding", "stun", "sealed"]:
							target.statuses[bad] = 0
						log_lines.push_front("%s的负面状态解除。" % target.name)
			"teamYiqi":
				for unit in living_heroes():
					unit.yiqi = mini(100, int(unit.yiqi) + int(effect.get("amount", 0)))
			"targetYiqi":
				for target in targets:
					target.yiqi = mini(100, int(target.yiqi) + int(effect.get("amount", 0)))
			"lowestAllyYiqi":
				var lowest := living_heroes().duplicate()
				lowest.sort_custom(func(a, b): return int(a.yiqi) < int(b.yiqi))
				if not lowest.is_empty():
					lowest[0].yiqi = mini(100, int(lowest[0].yiqi) + int(effect.get("amount", 0)))
			"selfYiqi":
				actor.yiqi = mini(100, int(actor.yiqi) + int(effect.get("amount", 0)))
			"stealYiqi":
				for target in targets:
					var stolen := mini(int(effect.get("amount", 0)), int(target.yiqi))
					target.yiqi -= stolen
					actor.yiqi = mini(100, int(actor.yiqi) + stolen)
			"selfHeal":
				actor.hp = mini(actor.max_hp, int(actor.hp) + int(round(actor.max_hp * float(effect.get("power", 0.2)))))
			"targetRemoveGood":
				for target in targets:
					target.statuses["guard"] = 0
					target.statuses["inspiration"] = 0


func _status_name(status: String) -> String:
	return {
		"armorBreak": "破甲",
		"bleeding": "流血",
		"stun": "眩晕",
		"guard": "护御",
		"inspiration": "鼓舞",
		"sealed": "封穴",
	}.get(status, status)


func _path_multiplier(attack_path: String, defense_path: String) -> float:
	var paths: Dictionary = state.paths()
	var attack_info: Dictionary = paths.get(attack_path, {})
	if str(attack_info.get("beats", "")) == defense_path:
		return 1.25 + float(modifiers.get("counterBonus", 0))
	var defense_info: Dictionary = paths.get(defense_path, {})
	if str(defense_info.get("beats", "")) == attack_path:
		return 0.82
	return 1.0


func _next_turn() -> void:
	if battle_finished:
		return
	for hero in heroes:
		for skill_id in hero.cooldowns:
			hero.cooldowns[skill_id] = maxi(0, int(hero.cooldowns[skill_id]) - 1)
	current_actor_index = (current_actor_index + 1) % maxi(heroes.size(), 1)
	if current_actor_index == 0:
		round_number += 1
		enemy_turn()
		if battle_finished:
			return
	_tick_statuses()
	if battle_finished:
		return
	var attempts := 0
	while current_actor_index < heroes.size() and heroes[current_actor_index].hp <= 0 and attempts < heroes.size():
		current_actor_index = (current_actor_index + 1) % heroes.size()
		attempts += 1


func _tick_statuses() -> void:
	for hero in living_heroes():
		if int(hero.statuses.get("bleeding", 0)) > 0:
			var bleed_damage := maxi(1, int(round(float(hero.max_hp) * 0.035)))
			hero.hp = maxi(0, int(hero.hp) - bleed_damage)
			log_lines.push_front("%s流血，损失 %d 生命。" % [hero.name, bleed_damage])
		for status in hero.statuses:
			if status != "bleeding":
				hero.statuses[status] = maxi(0, int(hero.statuses[status]) - 1)
		hero.broken = maxi(0, int(hero.broken) - 1)
	if all_heroes_defeated():
		battle_finished = true
		victory = false


func enemy_turn() -> bool:
	if battle_finished:
		return false
	for enemy in living_enemies():
		_check_boss_phase(enemy)
		enemy.broken = maxi(0, int(enemy.broken) - 1)
		if int(enemy.statuses.get("bleeding", 0)) > 0:
			var bleed_damage := maxi(1, int(round(float(enemy.max_hp) * 0.035)))
			enemy.hp = maxi(0, int(enemy.hp) - bleed_damage)
			log_lines.push_front("%s流血，损失 %d 生命。" % [enemy.name, bleed_damage])
		if enemy.hp <= 0:
			continue
		if int(enemy.statuses.get("stun", 0)) > 0:
			enemy.statuses.stun = int(enemy.statuses.stun) - 1
			log_lines.push_front("%s眩晕，无法行动。" % enemy.name)
			continue
		var targets := living_heroes()
		if targets.is_empty():
			battle_finished = true
			victory = false
			return false
		targets.sort_custom(func(a, b): return a.hp < b.hp)
		var target := targets[0]
		var skill_list: Array = enemy.skills
		var skill: Dictionary = skill_list[rng.randi_range(0, skill_list.size() - 1)]
		if str(skill.get("target", "")) == "allEnemies":
			for hero in targets:
				var all_raw := float(enemy.atk) * float(skill.get("power", 0.8))
				var hero_row: Dictionary = ROWS[clampi(int(hero.row), 0, ROWS.size() - 1)]
				var all_guard := 0.78 if int(hero.statuses.get("guard", 0)) > 0 else 1.0
				var all_damage := maxi(1, int(round(
					(all_raw - float(hero.def) * 0.55)
					/ float(hero_row.defense)
					* all_guard
					* difficulty_damage_taken
				)))
				hero.hp = maxi(0, int(hero.hp) - all_damage)
				log_lines.push_front("%s施展「%s」对%s造成 %d 伤害。" % [enemy.name, skill.get("name", "挥击"), hero.name, all_damage])
			continue
		if str(skill.get("target", "")) == "self":
			enemy.hp = mini(enemy.max_hp, int(enemy.hp) + int(round(enemy.max_hp * 0.12)))
			enemy.statuses["guard"] = maxi(int(enemy.statuses.get("guard", 0)), 1)
			log_lines.push_front("%s整军，恢复生命并获得护御。" % enemy.name)
			continue
		var raw := float(enemy.atk) * float(skill.get("power", 0.8))
		var row_info: Dictionary = ROWS[clampi(target.row, 0, ROWS.size() - 1)]
		var guard_multiplier := 0.78 if int(target.statuses.get("guard", 0)) > 0 else 1.0
		var damage := maxi(1, int(round((raw - float(target.def) * 0.55) / float(row_info.defense) * guard_multiplier * difficulty_damage_taken)))
		target.hp = maxi(0, target.hp - damage)
		target.statuses.guard = maxi(0, int(target.statuses.get("guard", 0)) - 1)
		log_lines.push_front("%s施展「%s」对%s造成 %d 伤害。" % [enemy.name, skill.get("name", "挥击"), target.name, damage])
		if target.hp <= 0:
			log_lines.push_front("%s力竭倒下。" % target.name)
	if all_heroes_defeated():
		battle_finished = true
		victory = false
		log_lines.push_front("我方全阵败退。")
	for hero in living_heroes():
		if bond_ids.has("wind_snow") and _claim_bond_trigger("wind_snow"):
			hero.yiqi = mini(100, int(hero.yiqi) + 8)
	return not battle_finished


func _check_boss_phase(enemy: Dictionary) -> void:
	var enemy_id := str(enemy.get("enemy_id", ""))
	if not bool(enemy.get("boss", false)) or boss_phase_triggered.get(enemy_id, false):
		return
	if float(enemy.hp) / float(enemy.max_hp) > 0.5:
		return
	boss_phase_triggered[enemy_id] = true
	enemy.statuses["inspiration"] = maxi(int(enemy.statuses.get("inspiration", 0)), 2)
	enemy.statuses["guard"] = maxi(int(enemy.statuses.get("guard", 0)), 1)
	log_lines.push_front("%s进入背水死战。" % enemy.name)


func total_team_power() -> int:
	var total := 0
	for hero in heroes:
		total += int(hero.hp) + int(hero.atk) * 4 + int(hero.def) * 3 + int(hero.spd) * 2
	return total
