// Gıda ikonu sayfasını hücrelere böler, Vision ile zemini kaldırır, kare tuvale ortalar.
// Kullanım: swift kes.swift <sayfa> <sütun> <satır> <çıkış klasörü> ad1 ad2 ...
import AppKit
import CoreImage
import ImageIO
import UniformTypeIdentifiers
import Vision

let a = CommandLine.arguments
guard a.count >= 6, let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[1]) as CFURL, nil),
      let sheet = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("kullanım hatalı"); exit(1) }
let cols = Int(a[2])!, rows = Int(a[3])!, out = URL(fileURLWithPath: a[4]), names = Array(a[5...])
try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
let ctx = CIContext()
let cw = sheet.width / cols, ch = sheet.height / rows
let FILL = 0.84   // nesnenin en uzun kenarı tuvalin bu oranı kadar

func save(_ img: CGImage, _ url: URL, _ type: UTType) {
  guard let d = CGImageDestinationCreateWithURL(url as CFURL, type.identifier as CFString, 1, nil) else { print("yazılamadı", url.lastPathComponent); return }
  CGImageDestinationAddImage(d, img, [kCGImageDestinationLossyCompressionQuality: 0.86] as CFDictionary)
  CGImageDestinationFinalize(d)
}
func square(_ img: CGImage, _ side: Int) -> CGImage {
  let c = CGContext(data: nil, width: side, height: side, bitsPerComponent: 8, bytesPerRow: 0,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  c.interpolationQuality = .high
  let s = Double(side) * FILL / Double(max(img.width, img.height))
  let w = Double(img.width) * s, h = Double(img.height) * s
  c.draw(img, in: CGRect(x: (Double(side) - w) / 2, y: (Double(side) - h) / 2, width: w, height: h))
  return c.makeImage()!
}

for (i, name) in names.enumerated() where i < cols * rows {
  let cell = sheet.cropping(to: CGRect(x: (i % cols) * cw, y: (i / cols) * ch, width: cw, height: ch))!
  let req = VNGenerateForegroundInstanceMaskRequest()
  let h = VNImageRequestHandler(cgImage: cell)
  do { try h.perform([req]) } catch { print(name, "vision hatası", error); continue }
  guard let r = req.results?.first else { print(name, "nesne bulunamadı"); continue }
  let buf = try! r.generateMaskedImage(ofInstances: r.allInstances, from: h, croppedToInstancesExtent: true)
  let ci = CIImage(cvPixelBuffer: buf)
  guard let cut = ctx.createCGImage(ci, from: ci.extent) else { continue }
  let big = square(cut, 512)
  save(big, out.appendingPathComponent("\(name).png"), .png)
  for s in [160, 320] { save(square(cut, s), out.appendingPathComponent("\(name)-\(s).png"), .png) }
  print(name, "\(cut.width)x\(cut.height)")
}
