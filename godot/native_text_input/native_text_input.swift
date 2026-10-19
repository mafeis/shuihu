import AppKit
import Carbon
import Darwin
import Foundation

typealias GodotCallback = @convention(c) (UnsafeMutableRawPointer?, Int32, UnsafePointer<CChar>?) -> Void
private let nativeTextPointer = UnsafeMutableRawPointer.allocate(byteCount: 24, alignment: 8)
private let deferredCallResult = UnsafeMutablePointer<Int32>.allocate(capacity: 1)

@_silgen_name("variant_get_ptr_internal_getter")
private func variantInternalGetter(_ type: Int32) -> UnsafeRawPointer?

@_silgen_name("variant_get_ptr_destructor")
private func variantDestructorFunction(_ type: Int32) -> UnsafeRawPointer?

@_silgen_name("variant_get_ptr_builtin_method")
private func variantBuiltinMethod(_ type: Int32, _ name: UnsafeRawPointer?, _ hash: Int64) -> UnsafeRawPointer?

private let api = GodotAPI()
private var nativeInputOwner: UnsafeMutableRawPointer?

private func recordNativeClipboard(_ input: String) {
	let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
	guard !trimmed.isEmpty, trimmed.range(of: "[A-Za-z]", options: .regularExpression) == nil else { return }
	let stateDirectory = FileManager.default.homeDirectoryForCurrentUser
		.appendingPathComponent(".codex-godot-native-input", isDirectory: true)
	try? FileManager.default.createDirectory(at: stateDirectory, withIntermediateDirectories: true)
	try? trimmed.write(
		to: stateDirectory.appendingPathComponent("clipboard.txt"),
		atomically: true,
		encoding: .utf8
	)
}

private final class GodotAPI {
	typealias GetProcAddress = @convention(c) (UnsafePointer<CChar>) -> UnsafeRawPointer?
	typealias StringNameCreate = @convention(c) (UnsafeMutableRawPointer?, UnsafePointer<CChar>, UInt8) -> Void
	typealias StringNameDestroy = @convention(c) (UnsafeMutableRawPointer?) -> Void
	typealias StringNameGet = @convention(c) (UnsafeRawPointer?) -> UnsafeRawPointer?
	typealias PointerGetter = @convention(c) (UnsafeRawPointer?) -> UnsafeRawPointer?
	typealias VariantConstructor = @convention(c) (UnsafeRawPointer?, UnsafeMutableRawPointer?, UnsafeRawPointer?) -> Void
	typealias VariantDestructor = @convention(c) (UnsafeRawPointer?) -> Void
	typealias VariantDestroy = @convention(c) (UnsafeMutableRawPointer?) -> Void
	typealias VariantInitNil = @convention(c) (UnsafeMutableRawPointer?) -> Void
	typealias StringConstructor = @convention(c) (UnsafeMutableRawPointer?, UnsafePointer<CChar>, Int64) -> Void
	typealias StringDestroy = @convention(c) (UnsafeMutableRawPointer?) -> Void
	typealias StringNameConstructor = @convention(c) (UnsafeMutableRawPointer?, UnsafePointer<CChar>) -> Void
	typealias DeferredCall = @convention(c) (UnsafeMutableRawPointer?, Int64, Int64, UnsafeMutablePointer<Int32>) -> Int32
	typealias ClassdbGetMethodBind = @convention(c) (UnsafeRawPointer?, UnsafeRawPointer?, Int64) -> UnsafeRawPointer?
	typealias ObjectMethodBindCall = @convention(c) (UnsafeRawPointer?, UnsafeMutableRawPointer?, UnsafePointer<UnsafeRawPointer?>?, Int64, UnsafeMutableRawPointer?, UnsafeMutableRawPointer?) -> Void
	typealias ObjectGetInstanceFromId = @convention(c) (Int64) -> UnsafeMutableRawPointer?
	typealias ClassdbConstruct = @convention(c) (UnsafeRawPointer?) -> UnsafeMutableRawPointer?

	var getProcAddress: GetProcAddress?
	var stringNameCreate: StringNameCreate?
	var stringNameDestroy: StringNameDestroy?
	var stringNameGet: StringNameGet?
	var variantConstructor: VariantConstructor?
	var variantDestructor: VariantDestructor?
	var variantDestroy: VariantDestroy?
	var variantInitNil: VariantInitNil?
	var stringConstructor: StringConstructor?
	var stringDestroy: StringDestroy?
	var stringNameConstructor: StringNameConstructor?
	var deferredCall: DeferredCall?
	var classdbGetMethodBind: ClassdbGetMethodBind?
	var objectMethodBindCall: ObjectMethodBindCall?
	var objectGetInstanceFromId: ObjectGetInstanceFromId?
	var classdbConstruct: ClassdbConstruct?

	func load(_ address: GetProcAddress?) {
		getProcAddress = address
		stringNameCreate = symbol("string_name_new_with_latin1_chars")
		stringNameDestroy = symbol("string_name_destroy")
		stringNameGet = symbol("string_name_get_ptr")
		if let fetch = symbol("get_variant_from_type_constructor") as (@convention(c) (Int32) -> UnsafeRawPointer?)? {
			variantConstructor = fetch(25).map { unsafeBitCast($0, to: VariantConstructor.self) }
		}
		variantDestructor = symbol("variant_get_ptr_destructor") as VariantDestructor?
		variantDestroy = symbol("variant_destroy")
		variantInitNil = symbol("variant_new_nil")
		stringConstructor = symbol("string_new_with_utf8_chars")
		stringDestroy = symbol("string_destroy")
		stringNameConstructor = symbol("string_name_new_with_utf8_chars")
		deferredCall = symbol("object_method_bind_call_deferred")
		classdbGetMethodBind = symbol("classdb_get_method_bind")
		objectMethodBindCall = symbol("object_method_bind_call")
		objectGetInstanceFromId = symbol("object_get_instance_from_id")
		classdbConstruct = symbol("classdb_construct_object2")
		NSLog("NATIVE_TEXT_INPUT_API \(stringNameCreate != nil) \(objectMethodBindCall != nil)")
	}

	func symbol<T>(_ name: String) -> T? {
		guard let address = getProcAddress?(name) else { return nil }
		return unsafeBitCast(address, to: T.self)
	}

	func withStringName<T>(_ value: String, _ body: (UnsafeRawPointer?) -> T) -> T {
		guard let create = stringNameCreate, let destroy = stringNameDestroy else { return body(nil) }
		let storage = UnsafeMutableRawPointer.allocate(byteCount: 8, alignment: 8)
		storage.initializeMemory(as: UInt8.self, repeating: 0, count: 8)
		return value.withCString { pointer in
			create(storage, pointer, 1)
			defer { destroy(storage) }
			return body(storage)
		}
	}

	func methodBind(_ owner: String, _ method: String) -> UnsafeRawPointer? {
		guard let get = classdbGetMethodBind else { return nil }
		return withStringName(owner) { ownerName in
			withStringName(method) { methodName in get(ownerName, methodName, 0) }
		}
	}

	func makeString(_ value: String, _ storage: UnsafeMutableRawPointer) {
		guard variantConstructor != nil else { return }
		let name = withStringName("String") { pointer in
			pointer.map { stringNameGet?($0) }
		} ?? nil
		guard let name, let builtInConstructor = makeBuiltinConstructor(25), variantDestructor != nil, let createString = stringConstructor else { return }
		var nameVariable = name
		builtInConstructor(storage, &nameVariable, nil)
		value.withCString { createString(storage, $0, -1) }
	}

	func makeBuiltinConstructor(_ type: Int32) -> VariantConstructor? {
		guard let fetch = symbol("get_variant_from_type_constructor") as (@convention(c) (Int32) -> UnsafeRawPointer?)?, let address = fetch(type) else { return nil }
		return unsafeBitCast(address, to: VariantConstructor.self)
	}

	func makeArgument(_ value: Int64) -> UnsafeMutableRawPointer? {
		guard let constructor = makeBuiltinConstructor(2), let initializeValue = variantInitNil else { return nil }
		let storage = UnsafeMutableRawPointer.allocate(byteCount: 24, alignment: 8)
		storage.initializeMemory(as: UInt8.self, repeating: 0, count: 24)
		initializeValue(storage)
		let argument = UnsafeMutableRawPointer.allocate(byteCount: 24, alignment: 8)
		argument.initializeMemory(as: UInt8.self, repeating: 0, count: 24)
		constructor(storage, argument, nil)
		argument.deallocate()
		return storage
	}

	func makePointer(_ value: UnsafeRawPointer, _ storage: UnsafeMutableRawPointer) {
		guard let constructor = makeBuiltinConstructor(31) else {
			NSLog("NATIVE_TEXT_INPUT_POINTER_FAILED")
			return
		}
		storage.storeBytes(of: value, as: UnsafeRawPointer?.self)
		constructor(storage, nativeTextPointer, nil)
	}

	func callGodot(_ method: String, owner: UnsafeMutableRawPointer, argument: Int64) -> Bool {
		guard let bind = methodBind("Object", method),
			let call = objectMethodBindCall,
			let destroy = variantDestroy,
			let value = makeArgument(argument) else {
			NSLog("NATIVE_TEXT_INPUT_CALLBACK_UNAVAILABLE \(method)")
			return false
		}
		let args = UnsafeMutableRawPointer.allocate(byteCount: MemoryLayout<UnsafeMutableRawPointer?>.size, alignment: 8)
		args.storeBytes(of: value, as: UnsafeMutableRawPointer?.self)
		let result = UnsafeMutableRawPointer.allocate(byteCount: 24, alignment: 8)
		result.initializeMemory(as: UInt8.self, repeating: 0, count: 24)
		let error = UnsafeMutableRawPointer.allocate(byteCount: 24, alignment: 8)
		error.initializeMemory(as: UInt8.self, repeating: 0, count: 24)
		var argumentPointer: UnsafeRawPointer? = UnsafeRawPointer(value)
		withUnsafePointer(to: &argumentPointer) { pointer in
			call(bind, owner, pointer, 1, result, error)
		}
		destroy(value)
		destroy(result)
		value.deallocate()
		args.deallocate()
		result.deallocate()
		error.deallocate()
		return true
	}

	func callTextReceiver(_ owner: UnsafeMutableRawPointer, argument: UnsafeRawPointer) -> Bool {
		guard let bind = methodBind("Object", "_native_text_input_action"),
			let call = objectMethodBindCall,
			let destroy = variantDestroy else { return false }
		let value = UnsafeMutableRawPointer.allocate(byteCount: 24, alignment: 8)
		value.initializeMemory(as: UInt8.self, repeating: 0, count: 24)
		NSLog("NATIVE_TEXT_INPUT_BEFORE_POINTER")
		makePointer(argument, value)
		NSLog("NATIVE_TEXT_INPUT_AFTER_POINTER")
		let args = UnsafeMutableRawPointer.allocate(byteCount: 8, alignment: 8)
		args.storeBytes(of: value, as: UnsafeMutableRawPointer?.self)
		let result = UnsafeMutableRawPointer.allocate(byteCount: 24, alignment: 8)
		result.initializeMemory(as: UInt8.self, repeating: 0, count: 24)
		let error = UnsafeMutableRawPointer.allocate(byteCount: 24, alignment: 8)
		error.initializeMemory(as: UInt8.self, repeating: 0, count: 24)
		NSLog("NATIVE_TEXT_INPUT_BEFORE_CALL")
		var argumentPointer: UnsafeRawPointer? = UnsafeRawPointer(value)
		withUnsafePointer(to: &argumentPointer) { pointer in
			call(bind, owner, pointer, 1, result, error)
		}
		NSLog("NATIVE_TEXT_INPUT_AFTER_CALL")
		destroy(value)
		destroy(result)
		value.deallocate()
		args.deallocate()
		result.deallocate()
		error.deallocate()
		return true
	}

	func callNativeAction(_ action: String) -> Bool {
		NSLog("NATIVE_TEXT_INPUT_ACTION_START \(action)")
		guard let owner = nativeInputOwner,
			let bind = methodBind("Object", "_native_text_input_action"),
			let call = deferredCall,
			variantInitNil != nil,
			let createString = stringConstructor,
			let destroyString = stringDestroy,
			let createName = stringNameConstructor,
			let destroyName = stringNameDestroy else {
			NSLog("NATIVE_TEXT_INPUT_NATIVE_CALL_SETUP_FAILED")
			return false
		}
		NSLog("NATIVE_TEXT_INPUT_ACTION_ALLOCATE")
		let argument = UnsafeMutableRawPointer.allocate(byteCount: 8, alignment: 8)
		let argumentName = UnsafeMutableRawPointer.allocate(byteCount: 8, alignment: 8)
		let callName = UnsafeMutableRawPointer.allocate(byteCount: 8, alignment: 8)
		argument.initializeMemory(as: UInt8.self, repeating: 0, count: 8)
		argumentName.initializeMemory(as: UInt8.self, repeating: 0, count: 8)
		callName.initializeMemory(as: UInt8.self, repeating: 0, count: 8)
		let argumentText = UnsafeMutablePointer<CChar>.allocate(capacity: action.utf8.count + 1)
		let argumentNameText = UnsafeMutablePointer<CChar>.allocate(capacity: 7)
		let callNameText = UnsafeMutablePointer<CChar>.allocate(capacity: 14)
		for (index, byte) in action.utf8.enumerated() { argumentText[index] = CChar(bitPattern: byte) }
		argumentText[action.utf8.count] = 0
		for (index, byte) in "String".utf8.enumerated() { argumentNameText[index] = CChar(bitPattern: byte) }
		argumentNameText[6] = 0
		for (index, byte) in "call_deferred".utf8.enumerated() { callNameText[index] = CChar(bitPattern: byte) }
		callNameText[13] = 0
		createString(argument, argumentText, -1)
		createName(argumentName, argumentNameText)
		createName(callName, callNameText)
		defer {
			destroyString(argument)
			destroyName(argumentName)
			destroyName(callName)
			argument.deallocate()
			argumentName.deallocate()
			callName.deallocate()
			argumentText.deallocate()
			argumentNameText.deallocate()
			callNameText.deallocate()
		}
		NSLog("NATIVE_TEXT_INPUT_DEFERRED_READY")
		NSLog("NATIVE_TEXT_INPUT_DEFERRED_DISPATCH \(owner) \(bind)")
		let result = call(
			owner,
			Int64(Int(bitPattern: bind)),
			Int64(Int(bitPattern: argument)),
			deferredCallResult
		)
		NSLog("NATIVE_TEXT_INPUT_DEFERRED_RESULT \(result)")
		return result != 0
	}

}
private let nativeType = TISInputSourceGetTypeID()
private let inputModeType = kTISTypeKeyboardInputMode

private func isSystemChinese(_ source: TISInputSource) -> Bool {
	guard let idPointer = TISGetInputSourceProperty(source, kTISPropertyInputSourceID) else { return false }
	let id = Unmanaged<CFString>.fromOpaque(idPointer).takeUnretainedValue() as String
	return id.hasPrefix("com.apple.inputmethod.SCIM")
}

private func inputSourceID(_ source: TISInputSource) -> String {
	guard let idPointer = TISGetInputSourceProperty(source, kTISPropertyInputSourceID) else { return "" }
	return Unmanaged<CFString>.fromOpaque(idPointer).takeUnretainedValue() as String
}

private final class GodotTextBridge: NSView, NSTextInputClient {
	let object: UnsafeMutableRawPointer
	var text = ""
	var marked = NSMutableAttributedString()
	var markedCursor = NSRange(location: NSNotFound, length: 0)
	var windowHandle: UnsafeMutableRawPointer?
	var beforeInputSource: TISInputSource?
	var selectedStart = 0
	var selectedEnd = 0
	var caption: String
	let callbackName: String

	init(object: UnsafeMutableRawPointer, callback: String) {
		self.object = object
		self.callbackName = callback
		self.caption = ""
		super.init(frame: NSRect(x: 0, y: 0, width: 1, height: 1))
	}

	required init?(coder: NSCoder) {
		nil
	}

	override var acceptsFirstResponder: Bool { true }
	override var isOpaque: Bool { true }

	override func draw(_ dirtyRect: NSRect) {
		NSColor(calibratedRed: 0.055, green: 0.083, blue: 0.086, alpha: 1).setFill()
		NSBezierPath(roundedRect: bounds, xRadius: 4, yRadius: 4).fill()
		NSColor(calibratedRed: 0.842, green: 0.739, blue: 0.49, alpha: 1).setStroke()
		let border = NSBezierPath(roundedRect: bounds.insetBy(dx: 0.75, dy: 0.75), xRadius: 4, yRadius: 4)
		border.lineWidth = 1.5
		border.stroke()
		let output = marked.length > 0 ? marked.string : (text.isEmpty ? caption : text)
		let attributes: [NSAttributedString.Key: Any] = [
			.font: NSFont.systemFont(ofSize: 18),
			.foregroundColor: text.isEmpty && marked.length == 0
				? NSColor(calibratedWhite: 0.63, alpha: 1)
				: NSColor(calibratedRed: 0.94, green: 0.91, blue: 0.84, alpha: 1),
		]
		let string = NSAttributedString(string: output, attributes: attributes)
		let height = string.size().height
		string.draw(in: NSRect(x: 12, y: (bounds.height - height) / 2, width: bounds.width - 24, height: height + 4))
	}

	override func mouseDown(with event: NSEvent) {
		window?.makeFirstResponder(self)
	}

	override func becomeFirstResponder() -> Bool {
		NSApplication.shared.activate(ignoringOtherApps: true)
		window?.makeKeyAndOrderFront(nil)
		switchToChinese()
		selectedEnd = text.utf16.count
		selectedStart = selectedEnd
		needsDisplay = true
		NSLog("NATIVE_TEXT_INPUT_FOCUSED \(object)")
		return true
	}

	override func resignFirstResponder() -> Bool {
		if let beforeInputSource {
			TISSelectInputSource(beforeInputSource)
			self.beforeInputSource = nil
		}
		return true
	}

	override func keyDown(with event: NSEvent) {
		if !NSApplication.shared.isActive {
			NSApplication.shared.activate(ignoringOtherApps: true)
			window?.makeKeyAndOrderFront(nil)
		}
		if event.keyCode == 53 {
			notify("did_not_accept")
			return
		}
		let command = event.modifierFlags.contains(.command)
		if command && event.charactersIgnoringModifiers?.lowercased() == "v" {
			if let pasted = NSPasteboard.general.string(forType: .string) {
				recordNativeClipboard(pasted)
				replaceSelection(with: pasted)
			}
			return
		}
		if command && event.charactersIgnoringModifiers?.lowercased() == "c" {
			NSPasteboard.general.clearContents()
			NSPasteboard.general.setString(text, forType: .string)
			return
		}
		interpretKeyEvents([event])
	}

	override func insertNewline(_ sender: Any?) {
		notify("did_not_accept")
	}

	override func cancelOperation(_ sender: Any?) {
		notify("did_not_accept")
	}

	func hasMarkedText() -> Bool {
		marked.length > 0
	}

	func markedRange() -> NSRange {
		hasMarkedText() ? NSRange(location: 0, length: marked.length) : NSRange(location: NSNotFound, length: 0)
	}

	func selectedRange() -> NSRange {
		hasMarkedText() ? markedCursor : NSRange(location: selectedStart, length: selectedEnd - selectedStart)
	}

	func setMarkedText(_ string: Any, selectedRange: NSRange, replacementRange: NSRange) {
		replaceSelection(with: "")
		marked = NSMutableAttributedString(attributedString: attributed(from: string))
		markedCursor = selectedRange
		needsDisplay = true
		notify("marked")
	}

	func unmarkText() {
		marked = NSMutableAttributedString()
		markedCursor = NSRange(location: NSNotFound, length: 0)
		needsDisplay = true
		notify("unmarked")
	}

	func validAttributesForMarkedText() -> [NSAttributedString.Key] { [.foregroundColor, .underlineStyle] }

	func attributedSubstring(forProposedRange range: NSRange, actualRange: NSRangePointer?) -> NSAttributedString? { nil }

	func characterIndex(for point: NSPoint) -> Int { 0 }

	func firstRect(forCharacterRange range: NSRange, actualRange: NSRangePointer?) -> NSRect {
		guard let window else { return .zero }
		let rect = window.convertToScreen(frame)
		return NSRect(x: rect.minX, y: rect.minY, width: 1, height: 24)
	}

	func insertText(_ string: Any, replacementRange: NSRange) {
		let inserted = attributed(from: string).string
		recordNativeClipboard(inserted)
		replaceSelection(with: inserted)
		unmarkText()
		needsDisplay = true
		notify("inserted")
	}

	private func attributed(from value: Any) -> NSAttributedString {
		if let attributed = value as? NSAttributedString { return attributed }
		return NSAttributedString(string: String(describing: value))
	}

	func notify(_ action: String) {
		let escaped = text.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\n", with: "\\n")
		NSLog("NATIVE_TEXT_INPUT_\(action) \(object) \(escaped)")
		writeReceiverPayload()
		let payload = [
			action,
			normalizedText(text),
			normalizedText(marked.string),
		].joined(separator: "\u{1f}")
		let payloadBytes = UnsafeMutablePointer<CChar>.allocate(capacity: payload.utf8.count + 1)
		payloadBytes.initialize(from: payload, count: payload.utf8.count)
		payloadBytes[payload.utf8.count] = 0
		let called = api.callTextReceiver(object, argument: UnsafeRawPointer(payloadBytes))
		payloadBytes.deallocate()
		NSLog("NATIVE_TEXT_INPUT_RECEIVER \(called)")
	}

	private func writeReceiverPayload() {
		let url = FileManager.default.homeDirectoryForCurrentUser
			.appendingPathComponent(".codex-godot-native-input", isDirectory: true)
			.appendingPathComponent("payload.txt")
		try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
		let payload = [text, marked.string].joined(separator: "\u{1f}")
		try? payload.write(to: url, atomically: true, encoding: .utf8)
	}

	private func switchToChinese() {
		guard let list = TISCreateInputSourceList(nil, true)?.takeRetainedValue() as? [TISInputSource] else { return }
		if beforeInputSource == nil, let current = TISCopyCurrentKeyboardInputSource()?.takeRetainedValue() {
			beforeInputSource = current
		}
		let mode = list.first { inputSourceID($0) == "com.tencent.inputmethod.wetype.pinyin" }
		if let mode {
			NSLog("NATIVE_TEXT_INPUT_SWITCH \(inputSourceID(mode))")
			TISSelectInputSource(mode)
			return
		}
		guard let chinese = list.first(where: isSystemChinese) else {
			NSLog("NATIVE_TEXT_INPUT_SWITCH_NONE")
			return
		}
		NSLog("NATIVE_TEXT_INPUT_SWITCH_SYSTEM")
		TISSelectInputSource(chinese)
	}

	func normalizedText(_ source: String) -> String {
		let composition = source.replacingOccurrences(
			of: "\\s+",
			with: "",
			options: .regularExpression
		)
		let containsLatin = composition.range(
			of: "[A-Za-z]",
			options: .regularExpression
		) != nil
		return containsLatin ? "" : composition
	}

	func setSelectionEnd() {
		selectedEnd = text.utf16.count
		selectedStart = selectedEnd
		marked = NSMutableAttributedString()
		markedCursor = NSRange(location: NSNotFound, length: 0)
	}

	private func replaceSelection(with inserted: String) {
		let value = Array(text.utf16)
		let end = min(max(selectedEnd, selectedStart), value.count)
		let start = min(max(selectedStart, 0), end)
		var replaced = Array(value[..<start])
		replaced.append(contentsOf: inserted.utf16)
		replaced.append(contentsOf: value[end...])
		text = String(decoding: replaced, as: UTF16.self)
		selectedStart = start + inserted.utf16.count
		selectedEnd = selectedStart
		needsDisplay = true
	}
}

@_silgen_name("native_text_input_activate")
func native_text_input_activate(_ instance: UnsafeMutableRawPointer?, _ callbackName: UnsafePointer<CChar>?, _ caption: UnsafePointer<CChar>?, _ initialText: UnsafePointer<CChar>?) {
	guard let instance else { return }
	NSLog("NATIVE_TEXT_INPUT_DIRECT_API \(api.deferredCall != nil) \(api.stringConstructor != nil) \(api.methodBind("Object", "_native_text_input_action") != nil)")
	NSLog("NATIVE_TEXT_INPUT_CALLBACK_API \(api.deferredCall != nil) \(api.stringConstructor != nil) \(api.deferredCall != nil)")
	nativeInputOwner = instance
	_ = api.callNativeAction("__probe__")
	guard let window = NSApp.keyWindow ?? NSApp.mainWindow, let content = window.contentView else {
		NSLog("NATIVE_TEXT_INPUT_NO_WINDOW")
		return
	}
	let bridge = GodotTextBridge(object: instance, callback: callbackName.map(String.init(cString:)) ?? "")
	bridge.caption = caption.map(String.init(cString:)) ?? ""
	bridge.text = initialText.map(String.init(cString:)) ?? ""
	bridge.setSelectionEnd()
	NSLog("NATIVE_TEXT_INPUT_ACTIVATE \(window) \(content.bounds)")
	NSApplication.shared.activate(ignoringOtherApps: true)
	window.makeKeyAndOrderFront(nil)
	content.addSubview(bridge)
	window.makeFirstResponder(bridge)
}

@_cdecl("native_text_input_detach")
func native_text_input_detach(_ handle: UnsafeMutableRawPointer?) {
	guard let handle else { return }
	let bridge = Unmanaged<GodotTextBridge>.fromOpaque(handle).takeUnretainedValue()
	bridge.removeFromSuperview()
}

@_cdecl("native_text_input_release")
func native_text_input_release(_ handle: UnsafeMutableRawPointer?) {
	guard let handle else { return }
	Unmanaged<GodotTextBridge>.fromOpaque(handle).release()
}

@_cdecl("native_text_input_attach_window")
func native_text_input_attach_window(_ handle: UnsafeMutableRawPointer?, _ nativeWindow: UnsafeMutableRawPointer?) {
	guard let handle, let nativeWindow else { return }
	let bridge = Unmanaged<GodotTextBridge>.fromOpaque(handle).takeUnretainedValue()
	guard let window = Unmanaged<NSObject>.fromOpaque(nativeWindow).takeUnretainedValue() as? NSWindow else {
		NSLog("NATIVE_TEXT_INPUT_WINDOW_FAILED \(nativeWindow)")
		return
	}
	NSLog("NATIVE_TEXT_INPUT_WINDOW_OK \(window)")
	window.contentView?.addSubview(bridge)
	window.makeFirstResponder(bridge)
}

@_cdecl("native_text_input_attach_parent")
func native_text_input_attach_parent(_ handle: UnsafeMutableRawPointer?, _ nativeParent: UnsafeMutableRawPointer?) {
	guard let handle, let nativeParent else { return }
	let bridge = Unmanaged<GodotTextBridge>.fromOpaque(handle).takeUnretainedValue()
	guard let parent = Unmanaged<NSObject>.fromOpaque(nativeParent).takeUnretainedValue() as? NSView else {
		NSLog("NATIVE_TEXT_INPUT_PARENT_FAILED")
		return
	}
	NSLog("NATIVE_TEXT_INPUT_PARENT_OK \(parent)")
	parent.addSubview(bridge)
	parent.window?.makeFirstResponder(bridge)
}

@_cdecl("native_text_input_focus")
func native_text_input_focus(_ handle: UnsafeMutableRawPointer?) {
	guard let handle else { return }
	let bridge = Unmanaged<GodotTextBridge>.fromOpaque(handle).takeUnretainedValue()
	NSLog("NATIVE_TEXT_INPUT_FOCUS \(bridge.object)")
	bridge.window?.makeFirstResponder(bridge)
}

@_cdecl("native_text_input_deactivate")
func native_text_input_deactivate(_ handle: UnsafeMutableRawPointer?) {
	guard let handle else { return }
	let bridge = Unmanaged<GodotTextBridge>.fromOpaque(handle).takeUnretainedValue()
	bridge.notify("deactivated")
}

@_cdecl("native_text_input_clear")
func native_text_input_clear(_ handle: UnsafeMutableRawPointer?) {}

@_cdecl("native_text_input_process")
func native_text_input_process(_ handle: UnsafeMutableRawPointer?) -> Int32 { 0 }

@_cdecl("native_text_input_get_utf8")
func native_text_input_get_utf8(_ handle: UnsafeMutableRawPointer?, _ length: UnsafeMutablePointer<Int32>?) -> UnsafeMutablePointer<UInt8>? {
	nil
}

@_cdecl("native_text_input_free_utf8")
func native_text_input_free_utf8(_ text: UnsafeMutablePointer<UInt8>?) {
	free(text)
}

@_cdecl("native_text_input_set_text")
func native_text_input_set_text(_ handle: UnsafeMutableRawPointer?, _ value: UnsafePointer<CChar>?) {
	guard let handle, let value else { return }
	let bridge = Unmanaged<GodotTextBridge>.fromOpaque(handle).takeUnretainedValue()
	bridge.text = String(cString: value)
	bridge.setSelectionEnd()
	bridge.needsDisplay = true
}

@_cdecl("native_text_input_get_length")
func native_text_input_get_length(_ handle: UnsafeMutableRawPointer?) -> Int32 {
	guard let handle else { return 0 }
	return Int32(Unmanaged<GodotTextBridge>.fromOpaque(handle).takeUnretainedValue().text.utf16.count)
}

@_cdecl("native_text_input_get_character")
func native_text_input_get_character(_ handle: UnsafeMutableRawPointer?, _ index: Int32) -> Int32 {
	guard let handle, index >= 0 else { return 0 }
	let utf16 = Array(Unmanaged<GodotTextBridge>.fromOpaque(handle).takeUnretainedValue().text.utf16)
	return index < utf16.count ? Int32(utf16[Int(index)]) : 0
}

@_cdecl("native_text_input_set_geometry")
func native_text_input_set_geometry(_ handle: UnsafeMutableRawPointer?, _ x: Double, _ y: Double, _ width: Double, _ height: Double) {
	guard let handle else { return }
	Unmanaged<GodotTextBridge>.fromOpaque(handle).takeUnretainedValue().frame = NSRect(x: x, y: y, width: width, height: height)
}

@_cdecl("native_text_input_set_caption")
func native_text_input_set_caption(_ handle: UnsafeMutableRawPointer?, _ caption: UnsafePointer<CChar>?) {
	guard let handle, let caption else { return }
	let bridge = Unmanaged<GodotTextBridge>.fromOpaque(handle).takeUnretainedValue()
	bridge.caption = String(cString: caption)
	bridge.needsDisplay = true
}

@_cdecl("native_text_input_is_available")
func native_text_input_is_available() -> Int32 { 1 }

@_cdecl("native_text_input_has_mark")
func native_text_input_has_mark(_ handle: UnsafeMutableRawPointer?) -> Int32 {
	guard let handle else { return 0 }
	return Unmanaged<GodotTextBridge>.fromOpaque(handle).takeUnretainedValue().hasMarkedText() ? 1 : 0
}
