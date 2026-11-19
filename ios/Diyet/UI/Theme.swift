import SwiftUI
import UIKit

/// Tasarım belirteçleri. Kaynak: design/arayuz-c/index.html içindeki `.t-light` ve `.t-dark` blokları (Sofra yönü)
/// ve CLAUDE.md'deki tasarım kuralları. Web tarafıyla aynı değerler; biri değişirse öteki de değişmeli.
///
/// Kurallar: 4 pt ızgara · köşe: kart 24, panel 22, kontrol 16, hap tam yuvarlak · yazı: 34 / 22 / 17 / 15 / 13 / 11,
/// ağırlık 400 / 500 / 600 · tek renkli zemin · turuncu yalnızca "şimdi", mavi yalnızca su.
/// Uygulamanın tint rengi nötr kalır; turuncu yalnızca `Theme.Palette.accent` ile, elle verilir.
enum Theme {

    // MARK: Renk

    enum Palette {
        /// Sayfa zemini.
        static let bg = Color(light: 0xF2F2F4, dark: 0x0A0A0B)
        /// Kart zemini. Koyu temada ince çizgiyle (`line`) ayrılır, açık temada gölgeyle.
        static let card = Color(light: 0xFFFFFF, dark: 0x161618)
        /// Alt sayfa zemini.
        static let sheet = Color(light: 0xFFFFFF, dark: 0x18181B)

        /// Birincil yazı.
        static let fg = Color(light: 0x0B0B0C, dark: 0xF5F5F7)
        /// İkincil yazı. Açık temada sayfa zemininde 4,8:1.
        static let muted = Color(light: 0x6A6A71, dark: 0x8F8F97)
        /// Yazı olmayan soluk öğeler: boş onay halkası, tutamaç.
        static let faint = Color(light: 0xB9B9C0, dark: 0x4E4E55)

        /// Kontrol zemini: hap, ikincil düğme, sayaç.
        static let ctl = Color(light: 0xF0F0F3, dark: 0xFFFFFF, darkAlpha: 0.07)
        /// Çubuk ve halka izi.
        static let track = Color(light: 0xE6E6EB, dark: 0xFFFFFF, darkAlpha: 0.10)
        /// Kartın ince kenarı; açık temada görünmez.
        static let line = Color(light: 0x000000, dark: 0xFFFFFF, lightAlpha: 0, darkAlpha: 0.06)

        /// Tabağın kenarı.
        static let plate = Color(light: 0xF0F0F3, dark: 0xFFFFFF, darkAlpha: 0.07)
        /// Tabağın çukuru.
        static let well = Color(light: 0xF8F8FA, dark: 0xFFFFFF, darkAlpha: 0.03)
        /// Yenmiş kalemin geri çekilmiş tabağı.
        static let ghost = Color(light: 0xF4F4F6, dark: 0xFFFFFF, darkAlpha: 0.04)

        /// Yalnızca "şimdi": şimdiki öğünün noktası ve ana düğmesi.
        static let accent = Color(light: 0xFF6A1A, dark: 0xFF7A2F)
        /// Turuncunun üstündeki yazı. İki temada da koyu (6,6:1); beyaz 2,9:1'de kalıyordu.
        static let onAccent = Color(light: 0x1C0E04, dark: 0x1C0E04)
        /// Yalnızca su.
        static let water = Color(light: 0x3B82F6, dark: 0x5B9DFF)
        /// Sınır aşımı, silme.
        static let danger = Color(light: 0xE5252A, dark: 0xFF5A52)
    }

    // MARK: Aralık (4 pt ızgara)

    enum Space {
        static let x1: CGFloat = 4
        static let x2: CGFloat = 8
        static let x3: CGFloat = 12
        static let x4: CGFloat = 16
        static let x5: CGFloat = 20
        static let x6: CGFloat = 24
        static let x8: CGFloat = 32
        /// Sayfanın yan boşluğu.
        static let page: CGFloat = 16
        /// Kartın iç boşluğu.
        static let card: CGFloat = 16
    }

    // MARK: Köşe

    enum Radius {
        static let card: CGFloat = 24
        static let panel: CGFloat = 22
        static let control: CGFloat = 16
    }

    // MARK: Ölçü

    enum Size {
        /// Ana düğme ve yanındaki kare düğme.
        static let button: CGFloat = 52
        /// En küçük dokunma alanı.
        static let tap: CGFloat = 44
        /// Miktar hapı.
        static let pill: CGFloat = 24
        /// Zaman çizelgesinde saat sütunu.
        static let timeColumn: CGFloat = 48
        /// Tabak çapları: ana yemek, eşit ızgara, yan sütun, liste satırı, hafta ızgarası.
        static let plateHero: CGFloat = 128
        static let plate: CGFloat = 80
        static let plateSide: CGFloat = 64
        static let plateRow: CGFloat = 48
        static let plateWeek: CGFloat = 40
    }

    // MARK: Yazı
    // Altı boyut iOS'un yazı stillerine birebir denk gelir; böylece Dynamic Type kendiliğinden çalışır.

    enum Typo {
        /// 34 · sayfa başlığı.
        static let title = Font.system(.largeTitle).weight(.semibold)
        /// 22 · kart başlığı, gün özetindeki sayılar.
        static let heading = Font.system(.title2).weight(.semibold)
        /// 17 · gövde.
        static let body = Font.system(.body)
        static let bodyMedium = Font.system(.body).weight(.medium)
        static let bodyStrong = Font.system(.body).weight(.semibold)
        /// 15 · ikincil.
        static let secondary = Font.system(.subheadline)
        static let secondaryMedium = Font.system(.subheadline).weight(.medium)
        static let secondaryStrong = Font.system(.subheadline).weight(.semibold)
        /// 13 · açıklama, miktar hapı.
        static let caption = Font.system(.footnote)
        static let captionMedium = Font.system(.footnote).weight(.medium)
        /// 11 · etiket.
        static let label = Font.system(.caption2).weight(.medium)
    }

    // MARK: Hareket

    enum Motion {
        /// Basış, renk.
        static let quick = Animation.easeOut(duration: 0.12)
        /// "Yedim": yiyecek küçülüp silinir.
        static let eat = Animation.easeIn(duration: 0.18)
        /// Onay çizilir, tabak geri çekilir.
        static let settle = Animation.timingCurve(0.22, 1, 0.36, 1, duration: 0.3)
        /// Kart açılır ve kapanır; alttaki satırlar aynı eğriyle yer değiştirir.
        static let fold = Animation.timingCurve(0.32, 0.72, 0, 1, duration: 0.32)
        /// "Hepsini yedim"de kalemler arası gecikme.
        static let stagger: Double = 0.05
        /// Son kalemden sonra öğünün tek satıra katlanmadan önce beklediği süre.
        static let foldDelay: Double = 0.9
    }
}

// MARK: - Yardımcılar

extension Color {
    /// Açık ve koyu temada farklı değer alan renk. Değerler 0xRRGGBB.
    init(light: UInt32, dark: UInt32, lightAlpha: CGFloat = 1, darkAlpha: CGFloat = 1) {
        self.init(uiColor: UIColor { traits in
            let dark_ = traits.userInterfaceStyle == .dark
            let v = dark_ ? dark : light
            return UIColor(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255,
                           blue: CGFloat(v & 0xFF) / 255, alpha: dark_ ? darkAlpha : lightAlpha)
        })
    }
}

extension View {
    /// Kart yüzeyi: zemin, 24 pt köşe; açık temada gölge, koyu temada ince çizgi.
    func sofraCard(radius: CGFloat = Theme.Radius.card) -> some View {
        self
            .background(CardSurface(radius: radius))
            .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(Theme.Palette.line, lineWidth: 1))
    }
}

/// Gölge yalnızca kartın zeminine düşer; içindeki tabak ve haplara bulaşmaz.
private struct CardSurface: View {
    var radius: CGFloat
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous).fill(Theme.Palette.card)
        if scheme == .dark { shape }
        else {
            shape
                .shadow(color: .black.opacity(0.04), radius: 1, y: 1)
                .shadow(color: .black.opacity(0.10), radius: 13, y: 10)
        }
    }
}
