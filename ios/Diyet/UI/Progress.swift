import SwiftUI

// İlerleme ekranının kartları: uyum takvimi, sık yenenler, aylar, kilo.
// Seri, rozet ya da sayaç yok; yalnızca kayıt. Kadranlar Today.swift'teki `DialCard`.

// MARK: - Uyum takvimi

struct HeatDay: Identifiable, Equatable {
    var date: Date
    /// Uyum yüzdesi; kayıt yoksa nil.
    var pct: Int?
    var isToday = false
    var isFuture = false
    var id: Date { date }
    /// 0 kayıt yok, 1-4 düşükten yükseğe (web'deki `lvl` ile aynı eşikler).
    var level: Int { guard let p = pct else { return 0 }; return p < 50 ? 1 : p < 75 ? 2 : p < 90 ? 3 : 4 }
}

/// Sütunlar hafta, satırlar Pazartesi'den Pazar'a. Son hafta sağda; sığmayan haftalar sola kaydırılır.
/// Renk tek: yazı rengi dört yoğunlukta. Bugünün hücresi turuncu çerçeve alır ("şimdi").
struct HeatCalendar: View {
    var weeks: [[HeatDay]]
    @Binding var selected: Date?

    private let cell: CGFloat = 14, gap: CGFloat = 3
    private static let tr = Locale(identifier: "tr_TR")
    private static let month: DateFormatter = { let f = DateFormatter(); f.locale = tr; f.dateFormat = "LLL"; return f }()
    private static let long: DateFormatter = { let f = DateFormatter(); f.locale = tr; f.dateFormat = "d MMMM EEEE"; return f }()

    static func fill(_ level: Int) -> Color {
        switch level {
        case 1: Theme.Palette.fg.opacity(0.16)
        case 2: Theme.Palette.fg.opacity(0.36)
        case 3: Theme.Palette.fg.opacity(0.62)
        case 4: Theme.Palette.fg.opacity(0.92)
        default: Theme.Palette.track
        }
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: Theme.Space.x2) {
            VStack(alignment: .leading, spacing: gap) {
                ForEach(Array(["Pzt", "", "Çar", "", "Cum", "", ""].enumerated()), id: \.offset) { _, t in
                    Text(t).font(Theme.Typo.label).foregroundStyle(Theme.Palette.muted).frame(height: cell)
                }
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .bottom, spacing: gap) {
                    ForEach(Array(weeks.enumerated()), id: \.offset) { _, w in
                        VStack(spacing: gap) {
                            // Ayın ilk gününü içeren sütunun üstünde ay adı; yazı sütundan taşar, yer kaplamaz.
                            Color.clear.frame(width: cell, height: 16)
                                .overlay(alignment: .bottomLeading) {
                                    if let f = w.first(where: { Calendar.current.component(.day, from: $0.date) == 1 }) {
                                        Text(Self.month.string(from: f.date)).font(Theme.Typo.label).foregroundStyle(Theme.Palette.muted).fixedSize()
                                    }
                                }
                            ForEach(w) { d in dayCell(d) }
                        }
                    }
                }
                .padding(.vertical, 2).padding(.trailing, 2)
            }
            .defaultScrollAnchor(.trailing)
        }
    }

    @ViewBuilder private func dayCell(_ d: HeatDay) -> some View {
        let shape = RoundedRectangle(cornerRadius: 4, style: .continuous)
        if d.isFuture {
            shape.fill(.clear).frame(width: cell, height: cell)
        } else {
            Button { selected = selected == d.date ? nil : d.date } label: {
                shape.fill(Self.fill(d.level)).frame(width: cell, height: cell)
                    .overlay { if d.isToday { shape.strokeBorder(Theme.Palette.accent, lineWidth: 1.5) } }
                    .overlay { if selected == d.date { shape.inset(by: -2.5).strokeBorder(Theme.Palette.fg, lineWidth: 1.5) } }
                    .contentShape(Rectangle().inset(by: -gap / 2))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Self.long.string(from: d.date) + (d.pct.map { ", uyum yüzde \($0)" } ?? ", kayıt yok"))
        }
    }

    static func caption(_ d: HeatDay) -> String { long.string(from: d.date) }
}

/// Takvim kartı: ortalama, kayıtlı gün sayısı, takvim, seçilen günün satırı ve renk anahtarı.
struct ScoreCalendarCard: View {
    var average: Int?
    var logged: Int
    var weeks: [[HeatDay]]
    var onDay: (Date) -> Void = { _ in }
    var onExplain: () -> Void = {}

    @State private var selected: Date?
    private var picked: HeatDay? { weeks.joined().first { $0.date == selected } }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x4) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Ortalama uyum").font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
                    Text(average.map { "%\($0)" } ?? "—").font(Theme.Typo.title).monospacedDigit().foregroundStyle(Theme.Palette.fg)
                }
                Spacer()
                Text("\(logged) gün kayıtlı").font(Theme.Typo.captionMedium).monospacedDigit().foregroundStyle(Theme.Palette.muted)
                    .padding(.horizontal, 10).frame(minHeight: Theme.Size.pill).background(Theme.Palette.ctl, in: Capsule())
            }
            HeatCalendar(weeks: weeks, selected: $selected)

            if let d = picked {
                Button { onDay(d.date) } label: {
                    HStack(spacing: Theme.Space.x2) {
                        Text(HeatCalendar.caption(d)).font(Theme.Typo.secondaryMedium).foregroundStyle(Theme.Palette.fg)
                        Text(d.pct.map { "uyum %\($0)" } ?? "kayıt yok").font(Theme.Typo.secondary).monospacedDigit().foregroundStyle(Theme.Palette.muted)
                        Spacer()
                        Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Palette.faint)
                    }
                    .frame(minHeight: Theme.Size.tap).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            } else {
                HStack(spacing: Theme.Space.x1) {
                    Button("Nasıl hesaplanır?", action: onExplain).font(Theme.Typo.captionMedium).foregroundStyle(Theme.Palette.fg)
                        .frame(minHeight: Theme.Size.tap)
                    Spacer()
                    Text("Düşük").padding(.trailing, 2)
                    ForEach(1..<5) { RoundedRectangle(cornerRadius: 4, style: .continuous).fill(HeatCalendar.fill($0)).frame(width: 14, height: 14) }
                    Text("Yüksek").padding(.leading, 2)
                }
                .font(Theme.Typo.label).foregroundStyle(Theme.Palette.muted)
            }
        }
        .padding(Theme.Space.card).padding(.bottom, -Theme.Space.x2)
        .sofraCard()
    }
}

// MARK: - Sık yenenler

/// Dönemde en sık yenenler, tabak sırası olarak. Sıralama ya da ödül yok; yalnızca ne yendiğinin kaydı.
struct TopFoodsCard: View {
    struct Item: Identifiable, Equatable { var id: String; var name: String; var icon: String?; var count: Int }
    var items: [Item]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: Theme.Space.x1) {
                ForEach(items) { i in
                    VStack(spacing: Theme.Space.x2) {
                        PlateView(icon: i.icon, size: Theme.Size.plateSide)
                        VStack(spacing: 0) {
                            Text(i.name).font(Theme.Typo.captionMedium).foregroundStyle(Theme.Palette.fg).multilineTextAlignment(.center).lineLimit(2)
                            Text("\(i.count) kez").font(Theme.Typo.label).monospacedDigit().foregroundStyle(Theme.Palette.muted)
                        }
                    }
                    .frame(width: 80)
                    .accessibilityElement(children: .ignore).accessibilityLabel("\(i.name), \(i.count) kez")
                }
            }
            .padding(.horizontal, Theme.Space.x3).padding(.vertical, Theme.Space.card)
        }
        .sofraCard()
    }
}

// MARK: - Aylar

struct MonthsCard: View {
    struct Row: Identifiable, Equatable { var month: String; var days: Int; var score: Int?; var gym: Int?; var kg: Double?; var id: String { month } }
    var rows: [Row]

    private func kgText(_ v: Double) -> String { v.formatted(.number.precision(.fractionLength(1)).locale(Locale(identifier: "tr_TR"))) }

    var body: some View {
        Grid(alignment: .trailing, horizontalSpacing: Theme.Space.x3, verticalSpacing: 0) {
            GridRow {
                Color.clear.gridCellUnsizedAxes([.horizontal, .vertical])
                ForEach(["Kayıt", "Uyum", "Antr.", "Kilo"], id: \.self) { Text($0) }
            }
            .font(Theme.Typo.label).foregroundStyle(Theme.Palette.muted).frame(minHeight: 32)
            ForEach(rows) { r in
                GridRow {
                    Text(r.month).font(Theme.Typo.bodyMedium).foregroundStyle(Theme.Palette.fg).gridColumnAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("\(r.days) gün")
                    Text(r.score.map { "%\($0)" } ?? "—")
                    Text(r.gym.map { "\($0)" } ?? "—")
                    Text(r.kg.map(kgText) ?? "—")
                }
                .font(Theme.Typo.secondary).monospacedDigit().foregroundStyle(Theme.Palette.fg).frame(minHeight: Theme.Size.tap)
            }
        }
        .padding(.horizontal, Theme.Space.card).padding(.vertical, Theme.Space.x2)
        .sofraCard()
    }
}

// MARK: - Kilo

struct WeightEntry: Identifiable, Equatable { var date: Date; var kg: Double; var id: Date { date } }

/// Son ölçüm, başlangıçtan fark, çizgi grafik (hedef kesik çizgi) ve bugünkü kiloyu yazma alanı.
struct WeightCard: View {
    var entries: [WeightEntry]
    var goal: Double? = nil
    var onSave: (Double) -> Void

    @State private var text = ""
    @FocusState private var focused: Bool
    private static let tr = Locale(identifier: "tr_TR")
    private static let dm: DateFormatter = { let f = DateFormatter(); f.locale = tr; f.dateFormat = "d MMM"; return f }()
    private func kg(_ v: Double) -> String { v.formatted(.number.precision(.fractionLength(1)).locale(Self.tr)) }
    private var sorted: [WeightEntry] { entries.sorted { $0.date < $1.date } }
    private var parsed: Double? {
        guard let v = Double(text.replacingOccurrences(of: ",", with: ".")), v > 30, v < 300 else { return nil }
        return v
    }

    var body: some View {
        let ws = sorted, first = ws.first, last = ws.last
        let diff = ws.count > 1 ? last!.kg - first!.kg : 0
        VStack(alignment: .leading, spacing: Theme.Space.x4) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(last.map { "Son ölçüm, \(Self.dm.string(from: $0.date))" } ?? "Son ölçüm").font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text(last.map { kg($0.kg) } ?? "—").font(Theme.Typo.title).monospacedDigit().contentTransition(.numericText())
                        Text("kg").font(Theme.Typo.secondaryMedium).foregroundStyle(Theme.Palette.muted)
                    }
                    .foregroundStyle(Theme.Palette.fg)
                }
                Spacer()
                if abs(diff) >= 0.05 {
                    Text("Başlangıçtan \(diff > 0 ? "+" : "−")\(kg(abs(diff))) kg").font(Theme.Typo.captionMedium).monospacedDigit().foregroundStyle(Theme.Palette.muted)
                        .padding(.horizontal, 10).frame(minHeight: Theme.Size.pill).background(Theme.Palette.ctl, in: Capsule())
                }
            }
            if ws.count > 1 {
                VStack(spacing: Theme.Space.x2) {
                    WeightChart(entries: ws, goal: goal).frame(height: 120)
                    HStack {
                        Text("\(Self.dm.string(from: first!.date)), \(kg(first!.kg)) kg")
                        Spacer()
                        if let goal { Text("Hedef \(goal.formatted(.number.precision(.fractionLength(0...1)).locale(Self.tr))) kg") }
                    }
                    .font(Theme.Typo.label).monospacedDigit().foregroundStyle(Theme.Palette.muted)
                }
            }
            HStack(spacing: Theme.Space.x2) {
                TextField("Bugünkü kilo", text: $text)
                    .keyboardType(.decimalPad).focused($focused)
                    .font(Theme.Typo.body).foregroundStyle(Theme.Palette.fg)
                    .padding(.horizontal, Theme.Space.x4).frame(minHeight: Theme.Size.button)
                    .background(Theme.Palette.ctl, in: RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
                Button("Kaydet") { if let v = parsed { onSave(v); text = ""; focused = false } }
                    .buttonStyle(PrimaryButton(quiet: parsed == nil)).frame(width: 104)
                    .disabled(parsed == nil)
            }
        }
        .padding(Theme.Space.card)
        .sofraCard()
    }
}

/// Kilo çizgisi. Yatay eksen tarih, dikey eksen ölçümlerin ve hedefin aralığı (yarım kilo payla).
struct WeightChart: View {
    var entries: [WeightEntry]
    var goal: Double?

    var body: some View {
        GeometryReader { g in
            let v = entries.map(\.kg)
            let mn = min(v.min() ?? 0, goal ?? .infinity) - 0.5, mx = max(v.max() ?? 1, goal ?? -.infinity) + 0.5
            let t0 = entries.first!.date.timeIntervalSince1970, span = max(1, entries.last!.date.timeIntervalSince1970 - t0)
            let pt: (WeightEntry) -> CGPoint = { e in
                CGPoint(x: 5 + (e.date.timeIntervalSince1970 - t0) / span * (g.size.width - 10),
                        y: 6 + (1 - (e.kg - mn) / (mx - mn)) * (g.size.height - 12))
            }
            ZStack {
                if let goal {
                    let y = 6 + (1 - (goal - mn) / (mx - mn)) * (g.size.height - 12)
                    Path { p in p.move(to: CGPoint(x: 0, y: y)); p.addLine(to: CGPoint(x: g.size.width, y: y)) }
                        .stroke(Theme.Palette.faint, style: StrokeStyle(lineWidth: 1, dash: [3, 4]))
                }
                Path { p in
                    for (i, e) in entries.enumerated() { i == 0 ? p.move(to: pt(e)) : p.addLine(to: pt(e)) }
                }
                .stroke(Theme.Palette.fg, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                if let l = entries.last {
                    Circle().fill(Theme.Palette.fg).frame(width: 8, height: 8)
                        .overlay(Circle().stroke(Theme.Palette.card, lineWidth: 2)).position(pt(l))
                }
            }
        }
        .accessibilityHidden(true)
    }
}
