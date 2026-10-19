import AppKit
import CoreImage
import Foundation
import Vision

enum CutoutError: Error {
    case usage
    case imageUnavailable
    case foregroundUnavailable
    case maskWriteFailed
}

func run() throws {
    guard CommandLine.arguments.count == 3 else {
        throw CutoutError.usage
    }

    let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
    let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
    guard let source = CIImage(contentsOf: inputURL) else {
        throw CutoutError.imageUnavailable
    }

    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(ciImage: source, options: [:])
    try handler.perform([request])
    guard let observation = request.results?.first else {
        throw CutoutError.foregroundUnavailable
    }

    let maskBuffer = try observation.generateScaledMaskForImage(
        forInstances: observation.allInstances,
        from: handler
    )
    let mask = CIImage(cvPixelBuffer: maskBuffer)
    let clear = CIImage(color: .clear).cropped(to: source.extent)
    let cutout = source.applyingFilter(
        "CIBlendWithMask",
        parameters: [
            kCIInputBackgroundImageKey: clear,
            kCIInputMaskImageKey: mask,
        ]
    )
    let context = CIContext(options: [.useSoftwareRenderer: false])
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else {
        throw CutoutError.maskWriteFailed
    }
    try context.writePNGRepresentation(
        of: cutout,
        to: outputURL,
        format: .RGBA8,
        colorSpace: colorSpace
    )
}

do {
    try run()
} catch CutoutError.usage {
    fputs("Usage: swift tools/vision_cutout.swift <input> <output>\n", stderr)
    exit(2)
} catch {
    fputs("Cutout failed: \(error)\n", stderr)
    exit(1)
}
