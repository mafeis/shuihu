class_name NativeTextInput
extends RefCounted

var text := ""
var available := false
var _owner: Object
var _commit: Callable
var _preedit: Callable
var _dismiss: Callable


func attach(owner: Object, commit: Callable, preedit: Callable, dismiss: Callable) -> bool:
	_owner = owner
	_commit = commit
	_preedit = preedit
	_dismiss = dismiss
	if not owner.has_method("_open_native_text_input"):
		return false
	return false


func attach_to_parent(_parent: Variant) -> void:
	pass


func set_text(value: String) -> void:
	text = value


func get_text() -> String:
	return text


func apply_native_event(payload: String) -> void:
	var parts := payload.split(String.chr(31), true, 2)
	var action := parts[0] if not parts.is_empty() else ""
	var value := parts[1] if parts.size() > 1 else ""
	var marked := parts[2] if parts.size() > 2 else ""
	match action:
		"inserted", "unmarked", "focus", "deactivated":
			text = value
			if _commit.is_valid():
				_commit.call(text)
		"marked":
			if _preedit.is_valid():
				_preedit.call(value, marked)
		"did_not_accept":
			text = value
			if _commit.is_valid():
				_commit.call(text)
			if _dismiss.is_valid():
				_dismiss.call()


func detach() -> void:
	pass
