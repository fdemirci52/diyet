// swift boya.swift girdi.jpg cikti.jpg y0:y1 [y0:y1 ...] — verilen yatay bantları (üstten piksel) köşedeki zemin rengiyle boyar; yanlışlıkla yazılan etiketleri siler.
import AppKit
let a = CommandLine.arguments
let rep = NSBitmapImageRep(data: try! Data(contentsOf: URL(fileURLWithPath: a[1])))!
let w = rep.pixelsWide
let bg = rep.colorAt(x: 8, y: 8)!
for s in a[3...] { let p = s.split(separator: ":").map { Int($0)! }; for y in p[0]..<p[1] { for x in 0..<w { rep.setColor(bg, atX: x, y: y) } } }
try! rep.representation(using: .jpeg, properties: [.compressionFactor: 0.95])!.write(to: URL(fileURLWithPath: a[2]))
print(w, rep.pixelsHigh)
