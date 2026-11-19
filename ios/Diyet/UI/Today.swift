import SwiftUI

// Bugün ekranının kartları: kadranlar, kapalı öğün kartı (ikon şeridiyle), gün boyu kartı, kalem sayfası.
// Açık öğün kartı ve tabak Sofra.swift ve Plate.swift'te.

// MARK: - Kadranlar

/// Gün özeti: sayı halkanın içinde, ad ve hedef altta. Kalori ve protein nötr, su mavi; turuncu yok.
struct DialCard: View {
    var title: String
    var value: String
    var unit: String = ""
    var target: String
    var progress: Double
    var color: Color = Theme.Palette.fg

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: Theme.Space.x2) {
            ZStack {
                Circle().stroke(Theme.Palette.track, lineWidth: 6)
                Circle().trim(from: 0, to: max(0.001, min(1, progress)))
                    .stroke(color, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .opacity(progress > 0 ? 1 : 0)
                    .animation(reduceMotion ? nil : Theme.Motion.settle, value: progress)
                HStack(alignment: .firstTextBaseline, spacing: 1) {
                    Text(value).font(Theme.Typo.bodyStrong).monospacedDigit().contentTransition(.numericText())
                    if !unit.isEmpty { Text(unit).font(Theme.Typo.label) }
                }
                .foregroundStyle(Theme.Palette.fg)
                .minimumScaleFactor(0.8).lineLimit(1).padding(.horizontal, 10)
            }
            .frame(width: 76, height: 76)
            VStack(spacing: 0) {
                Text(title).font(Theme.Typo.captionMedium).foregroundStyle(Theme.Palette.fg)
                Text(target).font(Theme.Typo.label).monospacedDigit().foregroundStyle(Theme.Palette.muted).lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.Space.x3).padding(.horizontal, Theme.Space.x1)
        .sofraCard()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title) \(value) \(unit), hedef \(target)")
    }
}

struct DialRow<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View { HStack(spacing: Theme.Space.x2) { content() } }
}

// MARK: - Kapalı öğün kartı

/// Zaman çizelgesinde kapalı öğün. Bekleyen öğün yiyeceklerini küçük tabaklarda gösterir (ne yiyeceğin bir bakışta);
/// biten öğün yazıya iner ve söner. Şimdiki öğün turuncu nokta alır.
struct MealRowCard: View {
    var time: String
    var title: String
    var isNow = false
    var status: RowStatus = .none
    /// Bekleyen kalemler: tabak şeridi. Boşsa `parts` yazı olarak görünür.
    var plates: [FoodTileModel] = []
    var prefix: String = ""
    var parts: [LinePart] = []
    var action: () -> Void

    private var faded: Bool { status == .done || status == .skipped }

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
            VStack(alignment: .leading, spacing: Theme.Space.x3) {
                HStack(alignment: .firstTextBaseline, spacing: Theme.Space.x2) {
                    if isNow { NowDot().alignmentGuide(.firstTextBaseline) { $0[.bottom] + 4 } }
                    Text(title).font(Theme.Typo.bodyStrong).foregroundStyle(faded ? Theme.Palette.muted : Theme.Palette.fg)
                    Text(time).font(Theme.Typo.secondary).monospacedDigit().foregroundStyle(Theme.Palette.muted)
                    Spacer(minLength: Theme.Space.x2)
                    statusView
                }
                if !plates.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(plates.prefix(6)) { p in PlateView(icon: p.icon, state: p.state, size: 44) }
                        if plates.count > 6 { Text("+\(plates.count - 6)").font(Theme.Typo.captionMedium).foregroundStyle(Theme.Palette.muted) }
                    }
                }
                if !parts.isEmpty {
                    Text(line).font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                        .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.Space.card)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressScale(0.98))
        .sofraCard()
    }

    @ViewBuilder private var statusView: some View {
        switch status {
        case .none: Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Palette.faint)
        case .done, .toggle(true): mark(false)
        case .skipped: mark(true)
        case .text(let t): Text(t).font(Theme.Typo.captionMedium).foregroundStyle(Theme.Palette.muted)
                .padding(.horizontal, 10).frame(minHeight: Theme.Size.pill).background(Theme.Palette.ctl, in: Capsule())
        case .toggle(false): Circle().strokeBorder(Theme.Palette.faint, lineWidth: 1.5).frame(width: 24, height: 24)
        }
    }
    private func mark(_ dash: Bool) -> some View {
        MarkShape(dash: dash).stroke(Theme.Palette.muted, style: StrokeStyle(lineWidth: 1.75, lineCap: .round, lineJoin: .round)).frame(width: 24, height: 24)
    }
}

/// Tek dokunuşluk satır kartı: saatsiz öğün (Uyanınca), antrenman. Solda tabakta ikon ya da sembol.
struct SimpleRowCard: View {
    var title: String
    var subtitle: String
    var time: String = ""
    var icon: String? = nil
    var symbol: String? = nil
    var done = false
    var showsToggle = true
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Space.x3) {
                ZStack {
                    PlateView(icon: icon, size: 44).opacity(symbol == nil ? 1 : 0)
                    if let symbol {
                        Circle().fill(Theme.Palette.ctl).frame(width: 44, height: 44)
                        Image(systemName: symbol).font(.system(size: 17, weight: .medium)).foregroundStyle(done ? Theme.Palette.muted : Theme.Palette.fg)
                    }
                }
                VStack(alignment: .leading, spacing: 2) {
                    HStack(alignment: .firstTextBaseline, spacing: Theme.Space.x2) {
                        Text(title).font(Theme.Typo.bodyStrong).foregroundStyle(done ? Theme.Palette.muted : Theme.Palette.fg)
                        if !time.isEmpty { Text(time).font(Theme.Typo.secondary).monospacedDigit().foregroundStyle(Theme.Palette.muted) }
                    }
                    Text(subtitle).font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                }
                Spacer(minLength: Theme.Space.x2)
                if showsToggle {
                    if done { MarkShape().stroke(Theme.Palette.muted, style: StrokeStyle(lineWidth: 1.75, lineCap: .round, lineJoin: .round)).frame(width: 24, height: 24) }
                    else { Circle().strokeBorder(Theme.Palette.faint, lineWidth: 1.5).frame(width: 24, height: 24) }
                } else {
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Palette.faint)
                }
            }
            .padding(Theme.Space.card)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressScale(0.98))
        .sensoryFeedback(.selection, trigger: done)
        .sofraCard()
    }
}

// MARK: - Gün boyu

/// Sayaç: eksi, sayı, artı. Artı düğmesi öne çıkar.
struct CountStepper: View {
    var value: Int
    var over = false
    var tint: Color = Theme.Palette.fg
    var onChange: (Int) -> Void

    var body: some View {
        HStack(spacing: 0) {
            Button { onChange(-1) } label: { Image(systemName: "minus").frame(width: 40, height: 40) }
                .disabled(value <= 0)
            Text("\(value)").font(Theme.Typo.bodyStrong).monospacedDigit().contentTransition(.numericText())
                .foregroundStyle(over ? Theme.Palette.danger : Theme.Palette.fg).frame(minWidth: 28)
            Button { onChange(1) } label: {
                Image(systemName: "plus").frame(width: 40, height: 40).foregroundStyle(tint)
                    .background(Theme.Palette.card, in: Circle()).overlay(Circle().strokeBorder(Theme.Palette.line, lineWidth: 1))
            }
        }
        .font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.Palette.fg)
        .buttonStyle(PressScale(0.9))
        .padding(2)
        .background(Theme.Palette.ctl, in: Capsule())
        .sensoryFeedback(.increase, trigger: value)
    }
}

struct AllDayRow<Trailing: View>: View {
    var symbol: String
    var symbolColor: Color = Theme.Palette.fg
    var title: String
    var subtitle: String
    @ViewBuilder var trailing: () -> Trailing
    var body: some View {
        HStack(spacing: Theme.Space.x3) {
            Image(systemName: symbol).font(.system(size: 17, weight: .medium)).foregroundStyle(symbolColor)
                .frame(width: 44, height: 44).background(Theme.Palette.ctl, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Theme.Typo.bodyMedium).foregroundStyle(Theme.Palette.fg)
                Text(subtitle).font(Theme.Typo.caption).monospacedDigit().foregroundStyle(Theme.Palette.muted).lineLimit(1).minimumScaleFactor(0.85)
            }
            .layoutPriority(1)
            Spacer(minLength: Theme.Space.x2)
            trailing().fixedSize()
        }
        .frame(minHeight: 56)
    }
}

// MARK: - Kalem sayfası

struct ItemSheetModel: Identifiable, Equatable {
    var mealID: String
    /// Plandaki kalem.
    var item: FoodTileModel
    /// Programın seçenekleri ve muadilleri; ilki plandaki hâlidir.
    var options: [FoodTileModel]
    var kcal: Int? = nil
    var protein: Double = 0
    var id: String { mealID + "." + item.id }
}

/// Kalem sayfası: büyük tabak, porsiyon adımı, programın seçenekleri tabak sırası olarak. Tek ana düğme "Yedim".
struct ItemSheet: View {
    var model: ItemSheetModel
    /// Seçilen seçeneğin kimliği ve porsiyon çarpanı.
    var onEat: (String, Double) -> Void
    var onSkip: () -> Void

    @State private var pick: String = ""
    @State private var q: Double = 1
    private var current: FoodTileModel { model.options.first { $0.id == pick } ?? model.item }
    private func qText(_ q: Double) -> String {
        let w = Int(q), f = q - Double(w)
        return (w > 0 ? "\(w)" : "") + (f == 0.25 ? "¼" : f == 0.5 ? "½" : f == 0.75 ? "¾" : "")
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                PlateView(icon: current.icon, size: Theme.Size.plateHero).padding(.top, Theme.Space.x6)
                    .id(current.id).transition(.scale(scale: 0.9).combined(with: .opacity))
                Text(current.name).font(Theme.Typo.heading).foregroundStyle(Theme.Palette.fg).multilineTextAlignment(.center).padding(.top, Theme.Space.x3)
                if let n = current.note ?? current.caption {
                    Text(n).font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted).multilineTextAlignment(.center).padding(.top, 2)
                }
                HStack(spacing: 0) {
                    Button { q = max(0.25, q - 0.25) } label: { Image(systemName: "minus").frame(width: 44, height: 44) }
                    VStack(spacing: 0) {
                        Text(q == 1 ? current.amount : "\(qText(q)) × \(current.amount)").font(Theme.Typo.bodyStrong).monospacedDigit().contentTransition(.numericText())
                    }.frame(minWidth: 120)
                    Button { q = min(3, q + 0.25) } label: { Image(systemName: "plus").frame(width: 44, height: 44) }
                }
                .font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.Palette.fg)
                .buttonStyle(PressScale(0.9))
                .background(Theme.Palette.ctl, in: Capsule())
                .sensoryFeedback(.selection, trigger: q)
                .padding(.top, Theme.Space.x4)
                Text([model.kcal.map { "\(Int((Double($0) * q).rounded())) kcal" }, "\((model.protein * q).formatted(.number.precision(.fractionLength(0...1)).locale(Locale(identifier: "tr_TR")))) g protein"].compactMap { $0 }.joined(separator: ", "))
                    .font(Theme.Typo.caption).monospacedDigit().foregroundStyle(Theme.Palette.muted).padding(.top, Theme.Space.x2)

                if model.options.count > 1 {
                    Text("Programdaki seçenekler").font(Theme.Typo.secondaryStrong).foregroundStyle(Theme.Palette.fg)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.top, Theme.Space.x6).padding(.horizontal, Theme.Space.x5)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(alignment: .top, spacing: Theme.Space.x2) {
                            ForEach(model.options) { o in
                                Button { withAnimation(Theme.Motion.settle) { pick = o.id; q = 1 } } label: {
                                    VStack(spacing: Theme.Space.x2) {
                                        PlateView(icon: o.icon, size: 72)
                                            .padding(4).overlay(Circle().strokeBorder(Theme.Palette.fg, lineWidth: 1.5).opacity(o.id == pick ? 1 : 0))
                                        Text(o.name).font(Theme.Typo.captionMedium).foregroundStyle(Theme.Palette.fg).multilineTextAlignment(.center).lineLimit(2)
                                        AmountPill(text: o.amount)
                                    }
                                    .frame(width: 96)
                                }
                                .buttonStyle(PressScale(0.96))
                            }
                        }
                        .padding(.horizontal, Theme.Space.x4).padding(.vertical, Theme.Space.x3)
                    }
                }
            }
            .padding(.bottom, 120)
        }
        .safeAreaInset(edge: .bottom) {
            HStack(spacing: Theme.Space.x2) {
                Button("Yedim") { onEat(pick, q) }.buttonStyle(PrimaryButton())
                Button("Atladım", action: onSkip).font(Theme.Typo.body).foregroundStyle(Theme.Palette.muted).padding(.horizontal, Theme.Space.x4).frame(minHeight: Theme.Size.button)
            }
            .padding(.horizontal, Theme.Space.x4).padding(.top, Theme.Space.x3).padding(.bottom, Theme.Space.x2)
            .background(Theme.Palette.sheet)
        }
        .background(Theme.Palette.sheet)
        .onAppear { pick = model.options.first?.id ?? model.item.id }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.panel)
    }
}

// MARK: - Hafta: ana yemekler

/// Haftanın ana yemekleri yedi sütunda tabak olarak; geçen günlerin tabağı boş, bugün işaretli.
struct WeekMainsCard: View {
    struct Day: Identifiable, Equatable {
        var id: Int
        var label: String
        var name: String
        var isToday = false
        var lunch: FoodTileModel
        var dinner: FoodTileModel
    }
    var days: [Day]
    @Binding var selected: Int

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Text("Ana yemekler").font(Theme.Typo.bodyStrong).foregroundStyle(Theme.Palette.fg).padding(.bottom, Theme.Space.x1)
            HStack(spacing: 0) {
                ForEach(days) { d in
                    VStack(spacing: 3) {
                        Text(d.label).font(d.isToday ? Theme.Typo.captionMedium : Theme.Typo.caption).foregroundStyle(d.isToday ? Theme.Palette.fg : Theme.Palette.muted)
                        Circle().fill(Theme.Palette.accent).frame(width: 4, height: 4).opacity(d.isToday ? 1 : 0)
                    }.frame(maxWidth: .infinity)
                }
            }
            row("Öğle") { $0.lunch }
            row("Akşam") { $0.dinner }
            if let d = days.first(where: { $0.id == selected }) {
                (Text(d.name).font(Theme.Typo.secondaryStrong).foregroundStyle(Theme.Palette.fg)
                 + Text("  öğle \(d.lunch.name.lowercased(with: Locale(identifier: "tr_TR"))), akşam \(d.dinner.name.lowercased(with: Locale(identifier: "tr_TR")))").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted))
                    .padding(.top, Theme.Space.x2)
            }
        }
        .padding(Theme.Space.card)
        .sofraCard()
    }

    private func row(_ title: String, _ pick: @escaping (Day) -> FoodTileModel) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x1) {
            Text(title).font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
            HStack(spacing: 0) {
                ForEach(days) { d in
                    Button { selected = d.id } label: {
                        PlateView(icon: pick(d).icon, state: pick(d).state, size: 40)
                            .padding(3).overlay(Circle().strokeBorder(Theme.Palette.fg, lineWidth: 1.5).opacity(d.id == selected ? 1 : 0))
                            .frame(maxWidth: .infinity, minHeight: Theme.Size.tap)
                    }
                    .buttonStyle(PressScale(0.94))
                    .accessibilityLabel("\(d.name) \(title.lowercased()), \(pick(d).name)")
                }
            }
        }
    }
}

/// Çizelge kartı: solda ad ve açıklama, sağda sayı.
struct LedgerCard: View {
    struct Row: Identifiable, Equatable { var title: String; var value: String; var note: String = ""; var id: String { title } }
    var rows: [Row]
    var body: some View {
        VStack(spacing: 0) {
            ForEach(rows) { r in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.title).font(Theme.Typo.body).foregroundStyle(Theme.Palette.fg)
                        if !r.note.isEmpty { Text(r.note).font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted) }
                    }
                    Spacer()
                    Text(r.value).font(Theme.Typo.bodyStrong).monospacedDigit().foregroundStyle(Theme.Palette.fg)
                }
                .frame(minHeight: 52)
            }
        }
        .padding(.horizontal, Theme.Space.card).padding(.vertical, Theme.Space.x2)
        .sofraCard()
    }
}

/// Bölüm başlığı.
struct SectionTitle: View {
    var text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).font(Theme.Typo.secondaryStrong).foregroundStyle(Theme.Palette.fg)
            .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, Theme.Space.x1).padding(.top, Theme.Space.x5).padding(.bottom, Theme.Space.x2)
    }
}
