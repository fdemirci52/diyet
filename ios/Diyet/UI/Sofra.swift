import SwiftUI

// Sofra bileşenleri: açık öğünün kalemleri tabaklarında durur. Veri modelinden bağımsızdır; DiyetKit tiplerini
// buradaki küçük görünüm modellerine çevirmek ekranın işidir.

// MARK: - Görünüm modelleri

/// Bir kalemin tabağı ve etiketi için gerekenler.
struct FoodTileModel: Identifiable, Equatable {
    var id: String
    /// Tabağın altındaki kısa ad ("Ekmek"); ana yemekte tam ad ("Izgara köfte").
    var name: String
    /// Diyetisyenin ölçüsü: "2 dilim", "½ adet", "60 g". Ölçü yoksa "1 porsiyon".
    var amount: String
    /// Ad ile hap arasındaki açıklama: "ekmek yerine", "Bugün azaltıldı", "İsteğe bağlı".
    var caption: String? = nil
    /// Diyetisyenin yan notu; yalnızca ana yemekte görünür.
    var note: String? = nil
    /// foods.js ICONS kimliği. Yoksa çatal işareti.
    var icon: String? = nil
    var state: FoodState = .pending
    /// Porsiyon plandan farklı: hap dolu görünür.
    var amountChanged = false
}

enum FoodTileStyle { case grid, hero, side }

// MARK: - Miktar hapı (imza)

/// Diyetisyenin ölçüsü her ekranda aynı hapta durur. Dokunulabilir olduğunu söyler; kalem sayfasını açar.
struct AmountPill: View {
    var text: String
    var filled = false
    var dimmed = false
    var body: some View {
        Text(text)
            .font(Theme.Typo.captionMedium)
            .monospacedDigit()
            .lineLimit(1)
            .foregroundStyle(filled ? Theme.Palette.bg : dimmed ? Theme.Palette.muted : Theme.Palette.fg)
            .padding(.horizontal, 10)
            .frame(minHeight: Theme.Size.pill)
            .background(filled ? Theme.Palette.fg : Theme.Palette.ctl, in: Capsule())
    }
}

// MARK: - Kalem: tabak + etiket

/// Tabağa dokununca yendi/yenmedi; etikete (ad ve hap) dokununca porsiyon ve muadil sayfası.
struct FoodTile: View {
    var model: FoodTileModel
    var style: FoodTileStyle = .grid
    var order: Int = 0
    var onToggle: () -> Void
    var onDetail: () -> Void

    private var plateSize: CGFloat { style == .hero ? Theme.Size.plateHero : style == .side ? Theme.Size.plateSide : Theme.Size.plate }
    private var done: Bool { model.state.isDone }

    var body: some View {
        Group {
            if style == .side {
                HStack(spacing: Theme.Space.x3) { plate; label(alignment: .leading) ; Spacer(minLength: 0) }
            } else {
                VStack(spacing: Theme.Space.x2) { plate; label(alignment: .center) }
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var plate: some View {
        Button(action: onToggle) {
            PlateView(icon: model.icon, state: model.state, size: plateSize, order: order)
        }
        .buttonStyle(PressScale(0.96))
        .sensoryFeedback(.selection, trigger: model.state)
        .accessibilityLabel(model.name)
        .accessibilityValue(model.state == .eaten ? "Yendi" : model.state == .skipped ? "Atlandı" : "Bekliyor")
        .accessibilityAddTraits(done ? .isSelected : [])
    }

    private func label(alignment: HorizontalAlignment) -> some View {
        Button(action: onDetail) {
            VStack(alignment: alignment, spacing: Theme.Space.x1) {
                Text(model.name)
                    .font(style == .hero ? Theme.Typo.bodyStrong : Theme.Typo.secondaryMedium)
                    .foregroundStyle(done ? Theme.Palette.muted : Theme.Palette.fg)
                    .strikethrough(model.state == .skipped, color: Theme.Palette.muted)
                    .multilineTextAlignment(alignment == .center ? .center : .leading)
                    .lineLimit(2)
                if let c = model.caption { Text(c).font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted) }
                AmountPill(text: model.state == .skipped ? "Atlandı" : model.amount, filled: model.amountChanged && !done, dimmed: done)
                if style == .hero, let n = model.note {
                    Text(n).font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
                        .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(minHeight: Theme.Size.tap, alignment: .top)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(model.name), \(model.amount)")
        .accessibilityHint("Porsiyon ve muadil")
    }
}

// MARK: - Sofra: öğünün tabakları

/// Ana yemekli öğünde ana yemek solda büyük tabakta, yanındakiler sağda tek sütunda. Diğer öğünlerde eşit tabaklar:
/// iki ya da dört kalemde iki sütun, tek kalemde ortada büyük tabak, kalanında üç sütun.
struct MealTable: View {
    var main: FoodTileModel?
    var items: [FoodTileModel]
    var onToggle: (String) -> Void
    var onDetail: (String) -> Void

    var body: some View {
        if let main, !items.isEmpty, items.count <= 4 {
            HStack(alignment: .center, spacing: Theme.Space.x4) {
                tile(main, .hero, 0).frame(width: 136)
                VStack(alignment: .leading, spacing: Theme.Space.x4) {
                    ForEach(Array(items.enumerated()), id: \.element.id) { i, it in tile(it, .side, i + 1) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            let all = (main.map { [$0] } ?? []) + items
            if all.count == 1 {
                tile(all[0], .hero, 0).frame(maxWidth: .infinity)
            } else {
                let cols = all.count == 2 || all.count == 4 ? 2 : 3
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: Theme.Space.x2, alignment: .top), count: cols), spacing: Theme.Space.x4) {
                    ForEach(Array(all.enumerated()), id: \.element.id) { i, it in tile(it, .grid, i) }
                }
            }
        }
    }

    private func tile(_ m: FoodTileModel, _ s: FoodTileStyle, _ order: Int) -> some View {
        FoodTile(model: m, style: s, order: order, onToggle: { onToggle(m.id) }, onDetail: { onDetail(m.id) })
    }
}

// MARK: - Açık öğün kartı

struct MealCardModel: Equatable {
    var id: String
    var title: String
    var time: String
    /// Şimdiki öğün: turuncu nokta ve turuncu ana düğme yalnızca burada.
    var isNow = false
    /// Başlığın altındaki durum: "Şimdi", "20 dk sonra", "Yendi", "Takviye bekliyor".
    var when: String = ""
    /// Sağda öğünün toplamı: "570 kcal, 36 g protein"; kalori gizliyse yalnızca protein.
    var info: String = ""
    /// Antrenman günü notu ya da öğün notu.
    var note: String? = nil
    var main: FoodTileModel? = nil
    var items: [FoodTileModel] = []
    /// Ana düğmenin yazısı. nil ise öğün tamamdır, düğme sakin "Kapat" olur.
    var primary: String? = "Hepsini yedim"
}

/// Açık öğün: başlık, sofra, tek ana düğme ve "diğer". `extra` sofranın altına satır ekler (telafi, plan dışı, takviye).
struct MealCard<Extra: View>: View {
    var model: MealCardModel
    var onToggle: (String) -> Void
    var onDetail: (String) -> Void
    var onPrimary: () -> Void
    var onMore: () -> Void
    var onClose: () -> Void
    @ViewBuilder var extra: () -> Extra

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onClose) {
                VStack(spacing: 0) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(model.title).font(Theme.Typo.heading).foregroundStyle(Theme.Palette.fg)
                        Spacer(minLength: Theme.Space.x3)
                        HStack(spacing: Theme.Space.x2) {
                            if model.isNow { NowDot() }
                            Text(model.time).font(Theme.Typo.bodyStrong).monospacedDigit().foregroundStyle(Theme.Palette.fg)
                        }
                    }
                    HStack(alignment: .firstTextBaseline) {
                        Text(model.when)
                        Spacer(minLength: Theme.Space.x3)
                        Text(model.info).monospacedDigit()
                    }
                    .font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                }
                .padding(.horizontal, Theme.Space.x1)
                .padding(.top, Theme.Space.x1).padding(.bottom, Theme.Space.x3)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(model.title), \(model.time), \(model.when)")
            .accessibilityHint("Kapat")

            if let n = model.note {
                Text(n).font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
                    .padding(.horizontal, Theme.Space.x1).padding(.bottom, Theme.Space.x4)
            }

            MealTable(main: model.main, items: model.items, onToggle: onToggle, onDetail: onDetail)
                .padding(.top, Theme.Space.x1).padding(.bottom, Theme.Space.x4)

            extra()

            HStack(spacing: Theme.Space.x2) {
                if let p = model.primary {
                    Button(p, action: onPrimary).buttonStyle(PrimaryButton(now: model.isNow))
                } else {
                    Button("Kapat", action: onClose).buttonStyle(PrimaryButton(quiet: true))
                }
                Button(action: onMore) {
                    Image(systemName: "ellipsis").font(.system(size: 17, weight: .semibold))
                        .frame(width: Theme.Size.button, height: Theme.Size.button)
                        .background(Theme.Palette.ctl, in: RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
                        .foregroundStyle(Theme.Palette.fg)
                }
                .buttonStyle(PressScale(0.97))
                .accessibilityLabel("Diğer")
            }
        }
        .padding(Theme.Space.card)
        .sofraCard()
    }
}

extension MealCard where Extra == EmptyView {
    init(model: MealCardModel, onToggle: @escaping (String) -> Void, onDetail: @escaping (String) -> Void,
         onPrimary: @escaping () -> Void, onMore: @escaping () -> Void, onClose: @escaping () -> Void) {
        self.init(model: model, onToggle: onToggle, onDetail: onDetail, onPrimary: onPrimary, onMore: onMore, onClose: onClose) { EmptyView() }
    }
}

// MARK: - Zaman çizelgesi satırı (kapalı olay)

/// Kapalı öğünün satırındaki ad: atlanan üstü çizili yazılır.
struct LinePart: Equatable {
    var text: String
    var struck = false
}

enum RowStatus: Equatable {
    case none
    /// Yendi.
    case done
    /// Tümü atlandı.
    case skipped
    /// Sağda kısa yazı: "20 dk sonra", "Gecikti".
    case text(String)
    /// Saatsiz tek kalem: dokununca işaretlenir.
    case toggle(Bool)
}

/// Saat solda, başlık ve altında düz yazı; ikon yok. Biten öğün söner, şimdiki öğün turuncu nokta alır.
struct TimelineRow: View {
    var time: String = ""
    var title: String
    /// "Kalan: " gibi ön ek.
    var prefix: String = ""
    var parts: [LinePart]
    var status: RowStatus = .none
    var isNow = false
    var action: () -> Void

    private var faded: Bool { status == .done || status == .skipped || status == .toggle(true) }

    private var line: AttributedString {
        var out = AttributedString(prefix)
        for (i, p) in parts.enumerated() {
            if i > 0 { out += AttributedString(", ") }
            var a = AttributedString(p.text)
            if p.struck { a.strikethroughStyle = .single }
            out += a
        }
        return out
    }

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: Theme.Space.x2) {
                Text(time).font(isNow ? Theme.Typo.secondaryStrong : Theme.Typo.secondary).monospacedDigit()
                    .foregroundStyle(isNow ? Theme.Palette.fg : Theme.Palette.muted)
                    .frame(width: Theme.Size.timeColumn, height: 24, alignment: .leading)
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: Theme.Space.x2) {
                        if isNow { NowDot() }
                        Text(title).font(Theme.Typo.bodyMedium).foregroundStyle(faded ? Theme.Palette.muted : Theme.Palette.fg)
                    }
                    .frame(minHeight: 24)
                    Text(line).font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                        .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: Theme.Space.x2)
                statusView.frame(minWidth: 24, minHeight: 24)
            }
            .padding(.vertical, Theme.Space.x2).padding(.horizontal, Theme.Space.x1)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder private var statusView: some View {
        switch status {
        case .none: Color.clear.frame(width: 24, height: 24)
        case .done, .toggle(true): mark(dash: false)
        case .skipped: mark(dash: true)
        case .text(let t): Text(t).font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
        case .toggle(false): Circle().strokeBorder(Theme.Palette.faint, lineWidth: 1.5).frame(width: 24, height: 24)
        }
    }

    private func mark(dash: Bool) -> some View {
        MarkShape(dash: dash).stroke(Theme.Palette.muted, style: StrokeStyle(lineWidth: 1.75, lineCap: .round, lineJoin: .round)).frame(width: 24, height: 24)
    }
}

// MARK: - Gün özeti

/// Üç düz sayı: kart, halka ya da çubuk yok. Kalori gizliyse iki sayı kalır, sütunlar yerinden oynamaz.
struct DayStats: View {
    struct Stat: Identifiable, Equatable {
        var value: String
        var caption: String
        var id: String { caption }
    }
    var stats: [Stat]

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Space.x2) {
            ForEach(0..<3, id: \.self) { i in
                VStack(alignment: .leading, spacing: 0) {
                    if i < stats.count {
                        Text(stats[i].value).font(Theme.Typo.heading).monospacedDigit().foregroundStyle(Theme.Palette.fg)
                            .contentTransition(.numericText())
                        Text(stats[i].caption).font(Theme.Typo.caption).monospacedDigit().foregroundStyle(Theme.Palette.muted).lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.horizontal, Theme.Space.x1)
    }
}

// MARK: - Küçük parçalar

/// "Şimdi" noktası: turuncunun iki yerinden biri.
struct NowDot: View {
    var body: some View { Circle().fill(Theme.Palette.accent).frame(width: 8, height: 8).accessibilityHidden(true) }
}

/// Öğün başına tek ana düğme. Turuncu yalnızca şimdiki öğünde; diğerlerinde koyu, tamamlanmış öğünde sakin.
struct PrimaryButton: ButtonStyle {
    var now = false
    var quiet = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.Typo.bodyStrong)
            .foregroundStyle(quiet ? Theme.Palette.fg : now ? Theme.Palette.onAccent : Theme.Palette.bg)
            .frame(maxWidth: .infinity, minHeight: Theme.Size.button)
            .background(quiet ? Theme.Palette.ctl : now ? Theme.Palette.accent : Theme.Palette.fg,
                        in: RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(Theme.Motion.quick, value: configuration.isPressed)
    }
}

/// Basınca hafifçe küçülür.
struct PressScale: ButtonStyle {
    var scale: CGFloat
    init(_ scale: CGFloat = 0.96) { self.scale = scale }
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.scaleEffect(configuration.isPressed ? scale : 1).animation(Theme.Motion.quick, value: configuration.isPressed)
    }
}
