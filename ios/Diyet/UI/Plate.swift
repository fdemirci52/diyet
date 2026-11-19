import SwiftUI
import UIKit

/// Kalemin durumu. Tabak ve etiket bunu okur.
enum FoodState: Equatable {
    case pending, eaten, skipped
    var isDone: Bool { self != .pending }
}

/// Gıda ikonu (img/f/<kimlik>-320.webp). Uygulama paketinde `f` klasöründe ya da kökte aranır; bulunamazsa nil döner
/// ve tabakta çatal işareti durur. İkon 40 pt'in altında ve tabaksız kullanılmaz: küçükken emoji gibi okunuyor.
enum FoodIcon {
    private static let cache = NSCache<NSString, UIImage>()
    static func image(_ id: String?) -> UIImage? {
        guard let id, !id.isEmpty else { return nil }
        if let hit = cache.object(forKey: id as NSString) { return hit }
        let name = "\(id)-320"
        let url = Bundle.main.url(forResource: name, withExtension: "webp", subdirectory: "f")
            ?? Bundle.main.url(forResource: name, withExtension: "webp")
        guard let url, let img = UIImage(contentsOfFile: url.path) ?? UIImage(named: name) else { return nil }
        cache.setObject(img, forKey: id as NSString)
        return img
    }
}

/// Tabak: kenar ve çukur. Üstünde yiyecek durur; yenince yiyecek küçülüp silinir, tabak kenarını bırakıp geri çekilir
/// ve ortasında onay çizilir. Kutu aynı kalır: yerleşim kaymaz, dokunma alanı küçülmez.
struct PlateView: View {
    var icon: String?
    var state: FoodState = .pending
    var size: CGFloat = Theme.Size.plate
    /// "Hepsini yedim"de sıra: hareket bu kadar adım gecikir.
    var order: Int = 0

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var rim: CGFloat { size >= 112 ? 12 : size >= 72 ? 8 : size >= 56 ? 6 : 4 }
    /// Küçük tabak daha az çekilir; onay işaretine yer kalsın.
    private var back: CGFloat { size <= 48 ? 0.8 : 0.7 }
    private var markSize: CGFloat { size >= 112 ? 32 : size <= 40 ? 16 : 24 }
    private var done: Bool { state.isDone }

    var body: some View {
        let delay = reduceMotion ? 0 : Double(order) * Theme.Motion.stagger
        ZStack {
            // Tabak: doluyken kenar + çukur, boşken tek tonlu küçük iz.
            Circle().fill(done ? Theme.Palette.ghost : Theme.Palette.plate)
                .overlay(Circle().fill(Theme.Palette.well).padding(rim).opacity(done ? 0 : 1))
                .scaleEffect(done ? back : 1)
                .animation(reduceMotion ? nil : Theme.Motion.settle.delay(delay), value: state)

            // Yiyecek.
            Group {
                if let img = FoodIcon.image(icon) {
                    Image(uiImage: img).resizable().interpolation(.high).scaledToFit()
                } else {
                    ForkGlyph().stroke(Theme.Palette.muted, style: StrokeStyle(lineWidth: size >= 112 ? 2 : 1.75, lineCap: .round, lineJoin: .round))
                        .frame(width: size >= 112 ? 40 : markSize, height: size >= 112 ? 40 : markSize)
                }
            }
            .frame(width: size - rim * 2, height: size - rim * 2)
            .scaleEffect(done ? 0.4 : 1)
            .opacity(done ? 0 : 1)
            .animation(reduceMotion ? nil : (done ? Theme.Motion.eat : Theme.Motion.settle).delay(delay), value: state)

            // Onay ya da atlandı çizgisi: aynı yerde çizilir.
            MarkShape(dash: state == .skipped)
                .trim(from: 0, to: done ? 1 : 0)
                .stroke(Theme.Palette.muted, style: StrokeStyle(lineWidth: 1.75, lineCap: .round, lineJoin: .round))
                .frame(width: markSize, height: markSize)
                .opacity(done ? 1 : 0)
                .animation(reduceMotion ? nil : (done ? Theme.Motion.settle.delay(delay + 0.12) : nil), value: state)
        }
        .frame(width: size, height: size)
        .contentShape(Circle())
        .accessibilityHidden(true)
    }
}

/// Onay işareti (24 birimlik kutuda M5 12.5 l4.5 4.5 L19 7.5) ya da atlandı çizgisi.
struct MarkShape: Shape {
    var dash = false
    func path(in r: CGRect) -> Path {
        let s = min(r.width, r.height) / 24
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: r.minX + x * s, y: r.minY + y * s) }
        var path = Path()
        if dash { path.move(to: p(7, 12)); path.addLine(to: p(17, 12)) }
        else { path.move(to: p(5, 12.5)); path.addLine(to: p(9.5, 17)); path.addLine(to: p(19, 7.5)) }
        return path
    }
}

/// İkonu olmayan kalem: çatal ve bıçak. Harf ya da boş kutu yerine "yiyecek, resmi yok" der.
struct ForkGlyph: Shape {
    func path(in r: CGRect) -> Path {
        let s = min(r.width, r.height) / 24
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: r.minX + x * s, y: r.minY + y * s) }
        var path = Path()
        // Çatal
        path.move(to: p(8, 3)); path.addLine(to: p(8, 9))
        path.addArc(center: p(10, 9), radius: 2 * s, startAngle: .degrees(180), endAngle: .degrees(0), clockwise: true)
        path.addLine(to: p(12, 3))
        path.move(to: p(10, 3)); path.addLine(to: p(10, 21))
        // Bıçak
        path.move(to: p(16, 21)); path.addLine(to: p(16, 3))
        path.addQuadCurve(to: p(13.5, 10.5), control: p(13.5, 5.5))
        path.addLine(to: p(16, 10.5))
        return path
    }
}
