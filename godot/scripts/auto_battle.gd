class_name AutoBattle
extends RefCounted


static func choose(battle: BattleModel, tactic: String) -> Dictionary:
	var actor := battle.current_hero()
	if actor.is_empty() or battle.battle_finished:
		return {}
	for skill_index in actor.skills.size():
		var skill: Dictionary = actor.skills[skill_index]
		if not battle.can_use_skill(skill) or battle.valid_targets(skill).is_empty():
			continue
		var pick := _pick_target(battle, actor, skill, tactic)
		if pick.is_empty():
			continue
		# Prefer high-impact skills while keeping a cheap opening repeat.
		var damage := _estimate(actor, skill, pick.unit, battle)
		var score := float(damage) * maxf(1.0, float(skill.get("hits", 1))) + float(skill.get("poise", 0)) * 1.6
		if battle.is_ally_target(skill):
			var missing := float(pick.unit.max_hp - pick.unit.hp) / maxf(1.0, float(pick.unit.max_hp))
			score = float(skill.get("heal", 0)) * 140.0 + missing * 120.0 + float(skill.get("yiqi", 0)) * 0.4
			if missing < 0.06 and skill.get("heal", 0) <= 0:
				score *= 0.12
		if tactic == "breaker":
			score += float(skill.get("poise", 0)) * 2.0
		elif tactic == "guardian" and battle.is_ally_target(skill):
			score *= 1.45
		elif tactic == "hunter" and not battle.is_ally_target(skill):
			var hp_ratio := float(pick.unit.hp) / maxf(1.0, float(pick.unit.max_hp))
			score *= 1.0 + maxf(0.0, 0.5 - hp_ratio) * 1.4
		if bool(skill.get("ultimate", false)) and battle.round_number < 2:
			score *= 0.8
		pick["skill_index"] = skill_index
		pick["skill"] = skill
		pick["score"] = score
		if score > 0.0:
			return pick
	var basic := battle.skill_by_index(actor, 0)
	if battle.can_use_skill(basic):
		var targets := battle.valid_targets(basic)
		if not targets.is_empty():
			return {"skill_index": 0, "target": 0, "unit": targets[0], "skill": basic, "score": 1.0}
	return {}


static func _pick_target(battle: BattleModel, actor: Dictionary, skill: Dictionary, tactic: String) -> Dictionary:
	var targets := battle.valid_targets(skill)
	if targets.is_empty():
		return {}
	var best_index := 0
	var best_score := -INF
	for index in targets.size():
		var unit: Dictionary = targets[index]
		var score := 0.0
		if battle.is_ally_target(skill):
			score = float(unit.max_hp - unit.hp) / maxf(1.0, float(unit.max_hp)) * 100.0 - float(unit.yiqi) * 0.08
		else:
			var hp_ratio := float(unit.hp) / maxf(1.0, float(unit.max_hp))
			score = (1.0 - hp_ratio) * 100.0 + _estimate(actor, skill, unit, battle) * 0.2
			if int(unit.get("broken", 0)) > 0:
				score += 20.0
			if tactic == "breaker":
				score += float(unit.get("poise", 0)) / maxf(1.0, float(unit.get("poise_max", 100))) * 50.0
			elif tactic == "guardian" and int(unit.row) == 2:
				score += 24.0
			elif tactic == "hunter":
				score += (1.0 - hp_ratio) * 70.0
		if score > best_score:
			best_score = score
			best_index = index
	var target_index := battle.target_auto_index(skill, best_index)
	return {"target": target_index, "unit": targets[target_index]}


static func _estimate(actor: Dictionary, skill: Dictionary, target: Dictionary, battle: BattleModel) -> int:
	var power := float(skill.get("power", 0))
	if power <= 0.0 or target.is_empty():
		return 0
	var damage := power * float(actor.atk) * 1.82 - float(target.def) * 0.55
	var path_id := str(actor.get("path", ""))
	var target_path := str(target.get("path", ""))
	if battle.state.paths().get(path_id, {}).get("beats", "") == target_path:
		damage *= 1.2
	if battle.state.paths().get(target_path, {}).get("beats", "") == path_id:
		damage *= 0.9
	if int(target.get("broken", 0)) > 0:
		damage *= 1.2
	if int(target.get("statuses", {}).get("armorBreak", 0)) > 0:
		damage *= 1.15
	if float(skill.get("power", 0)) >= 1.4 and float(target.hp) / maxf(1.0, float(target.max_hp)) < 0.4:
		damage *= float(skill.get("executeBonus", 1.0))
	return maxi(1, int(round(damage)))
