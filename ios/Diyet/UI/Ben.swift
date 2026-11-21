import SwiftUI
import DiyetKit

// Ben sekmesi: tartı kâğıdı okunur hâle gelir. Tasarım: "Ben ve Tarifler" tuvali, A · Gövde (21 Kasım 2026 kararı).
// Moral kuralları: kahraman diyetisyenin hedefi (gövde yağı ve bel), kilo değil; değişim sözle ("0,5 kg az"),
// kırmızı-yeşil, ok ve yüzde yok; aralık ve sınıflar yalnızca ölçüm sayfasında, etiketsiz.

// MARK: - Ekran

struct BenScreen<Settings: View>: View {
    var scans: [Scan]
    /// Diyetisyenin hedefi, kısa: "önce bel çevresindeki yağ".
    var goal: String
    /// Sonraki ölçüm, okunur: "27 Kasım, Cuma".
    var next: String
    var onAddScan: () -> Void
    var onOpenScan: (Scan) -> Void
    @ViewBuilder var settings: () -> Settings

    private var last: Scan? { scans.last }
    private var prev: Scan? { scans.count > 1 ? scans[scans.count - 2] : nil }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(last.map { "\(BenFormat.day($0.d)), \(scans.count). ölçüm" } ?? "Henüz ölçüm yok").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                    Text("Ben").font(Theme.Typo.title).foregroundStyle(Theme.Palette.fg)
                }
                .padding(.horizontal, Theme.Space.x1).padding(.bottom, Theme.Space.x5)

                if let a = last {
                    BodyHeroCard(goal: goal, now: a, before: prev)
                    SectionTitle("Tartıdaki fark")
                    if let p = prev, let s = BodyStory.split(a, since: p) {
                        ScaleSplitCard(split: s, since: BenFormat.day(p.d),
                                       why: BodyStory.why(s, muscle: a.muscle.flatMap { m in p.muscle.map { m - $0 } }))
                    } else {
                        WaitCard(text: "İkinci ölçümden sonra burada, tartıdaki farkın ne kadarının yağ, ne kadarının su olduğu görünür. Sonraki ölçüm \(next).")
                    }
                    if a.kg != nil, a.muscle != nil, a.fat != nil {
                        SectionTitle("\(TR.num(a.kg ?? 0, digits: 1)) kg neyden oluşuyor")
                        CompositionCard(scan: a)
                    }
                } else {
                    WaitCard(text: "Diyetisyenindeki tartının kâğıdını çek; gövde yağın, belin ve tartıdaki farkın parçaları burada görünür.")
                }

                SectionTitle("Ölçümler")
                MeasurementsCard(scans: scans, next: next, onOpen: onOpenScan, onAdd: onAddScan)

                SectionTitle("Program ve hesap")
                RowsCard { settings() }
            }
            .padding(.horizontal, Theme.Space.page).padding(.top, Theme.Space.x2).padding(.bottom, Theme.Space.x8)
        }
        .background(Theme.Palette.bg.ignoresSafeArea())
    }
}

enum BenFormat {
    static let tr = Locale(identifier: "tr_TR")
    /// "20 Kasım".
    static func day(_ k: String) -> String { DayKey.date(k).map { $0.formatted(.dateTime.day().month(.wide).locale(tr)) } ?? k }
    /// "Cuma".
    static func weekday(_ k: String) -> String { DayKey.date(k).map { $0.formatted(.dateTime.weekday(.wide).locale(tr)) }.map(TR.cap) ?? "" }
    static func kg(_ v: Double?) -> String { v.map { "\(TR.num($0, digits: 1)) kg" } ?? "—" }
}

// MARK: - Kahraman: hedef, gövde yağı ve bel

struct BodyHeroCard: View {
    var goal: String
    var now: Scan
    var before: Scan?

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x4) {
            Text("Hedef: \(goal)").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
            HStack(alignment: .center, spacing: Theme.Space.x4) {
                VStack(alignment: .leading, spacing: Theme.Space.x5) {
                    metric("Gövde yağı", BenFormat.kg(now.trunkFat ?? now.fat),
                           lead: before.map { "\(BenFormat.day($0.d))’dan beri " } ?? "İlk ölçüm",
                           change: delta(now.trunkFat ?? now.fat, before?.trunkFat ?? before?.fat, unit: "kg", digits: 1))
                    if let w = now.waist {
                        metric("Bel", "\(TR.num(w)) cm", lead: "", change: delta(w, before?.waist, unit: "cm", digits: 0))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                TrunkFigure().frame(width: 112, height: 184)
            }
        }
        .padding(Theme.Space.x5)
        .sofraCard()
        .accessibilityElement(children: .combine)
    }

    private func delta(_ a: Double?, _ b: Double?, unit: String, digits: Int) -> String {
        guard let a, let b else { return "" }
        return BodyStory.word(a - b, unit: unit, digits: digits)
    }

    private func metric(_ label: String, _ value: String, lead: String, change: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label).font(Theme.Typo.secondaryMedium).foregroundStyle(Theme.Palette.muted)
            Text(value).font(Theme.Typo.title).monospacedDigit().foregroundStyle(Theme.Palette.fg)
            if !lead.isEmpty || !change.isEmpty {
                (Text(lead).foregroundStyle(Theme.Palette.muted) + Text(change).fontWeight(.semibold).foregroundStyle(Theme.Palette.fg))
                    .font(Theme.Typo.secondary)
            }
        }
    }
}

/// Sade beden: gövde vurgulu, belde mezura çizgisi. 112 × 184 birimlik çizim.
struct TrunkFigure: View {
    var body: some View {
        Canvas { ctx, size in
            let s = min(size.width / 112, size.height / 184)
            func r(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ rad: CGFloat) -> Path {
                Path(roundedRect: CGRect(x: x * s, y: y * s, width: w * s, height: h * s), cornerRadius: rad * s)
            }
            let limb = GraphicsContext.Shading.color(Theme.Palette.track)
            ctx.fill(Path(ellipseIn: CGRect(x: 45 * s, y: 2 * s, width: 22 * s, height: 22 * s)), with: limb)
            for p in [r(14, 32, 12, 64, 6), r(86, 32, 12, 64, 6), r(35, 104, 19, 78, 9.5), r(58, 104, 19, 78, 9.5)] { ctx.fill(p, with: limb) }
            ctx.fill(r(31, 29, 50, 72, 18), with: .color(Theme.Palette.fg))
            var tape = Path(); tape.move(to: CGPoint(x: 31 * s, y: 80 * s)); tape.addLine(to: CGPoint(x: 81 * s, y: 80 * s))
            ctx.stroke(tape, with: .color(Theme.Palette.card), style: StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Tartıdaki fark

/// Tartının gösterdiği farkı parçalarına ayırır: ortada sıfır çizgisi, solda azalanlar, sağda artanlar.
struct ScaleSplitCard: View {
    var split: BodyStory.Split
    var since: String
    var why: String

    private func color(_ n: String) -> Color { n == "Yağ" ? Theme.Palette.fg : n == "Su" ? Theme.Palette.water : Theme.Palette.mid }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Tartı \(TR.num(abs(split.total), digits: 1)) kg \(split.total < 0 ? "az" : "fazla") gösterdi")
                .font(Theme.Typo.heading).foregroundStyle(Theme.Palette.fg)
            Text("\(since) ölçümüne göre").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)

            GeometryReader { g in
                let half = g.size.width / 2 - 4
                let L = split.parts.filter { $0.d < 0 }.reduce(0) { $0 - $1.d }, R = split.parts.filter { $0.d > 0 }.reduce(0) { $0 + $1.d }
                let k = half * 0.9 / max(L, R, 0.1)
                ZStack {
                    HStack(spacing: 0) {
                        HStack(spacing: 2) { ForEach(split.parts.filter { $0.d < 0 }.reversed(), id: \.name) { seg($0, k) } }
                            .frame(width: half, alignment: .trailing).padding(.trailing, 4)
                        HStack(spacing: 2) { ForEach(split.parts.filter { $0.d > 0 }, id: \.name) { seg($0, k) } }
                            .frame(width: half, alignment: .leading).padding(.leading, 4)
                    }
                    Capsule().fill(Theme.Palette.fg).frame(width: 1.5, height: 36)
                }
                .frame(width: g.size.width, height: 28)
            }
            .frame(height: 28).padding(.top, Theme.Space.x4).padding(.bottom, Theme.Space.x1)
            .accessibilityElement().accessibilityLabel(split.parts.map { "\($0.name) \(BodyStory.word($0.d, unit: "kg"))" }.joined(separator: ", "))

            HStack { Text("az"); Spacer(); Text("fazla") }.font(Theme.Typo.label).foregroundStyle(Theme.Palette.muted).padding(.bottom, Theme.Space.x3)

            ForEach(split.parts, id: \.name) { p in
                HStack(spacing: Theme.Space.x3) {
                    Circle().fill(color(p.name)).frame(width: 8, height: 8)
                    Text(p.name).font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.fg)
                    Spacer()
                    Text(BodyStory.word(p.d, unit: "kg")).font(Theme.Typo.secondaryStrong).foregroundStyle(Theme.Palette.fg)
                }
                .frame(minHeight: 36)
            }
            Text(why).font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted).fixedSize(horizontal: false, vertical: true).padding(.top, Theme.Space.x3)
        }
        .padding(Theme.Space.card)
        .sofraCard()
    }

    private func seg(_ p: (name: String, d: Double), _ k: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 6, style: .continuous).fill(color(p.name)).frame(width: max(4, abs(p.d) * k))
    }
}

/// İkinci ölçüm gelene kadar: ne göreceğini söyler.
struct WaitCard: View {
    var text: String
    var body: some View {
        HStack(alignment: .top, spacing: Theme.Space.x3) {
            Image(systemName: "clock").font(.system(size: 17, weight: .medium)).foregroundStyle(Theme.Palette.muted)
                .frame(width: 40, height: 40).background(Theme.Palette.ctl, in: Circle())
            Text(text).font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Space.card)
        .sofraCard()
    }
}

// MARK: - Bileşim

/// Kilonun neyden oluştuğu: kas, yağ, kemik ve diğer; tek yatay çubuk ve üç sayı.
struct CompositionCard: View {
    var scan: Scan
    var body: some View {
        let kg = scan.kg ?? 1, kas = scan.muscle ?? 0, yag = scan.fat ?? 0, kem = scan.bone ?? max(0, kg - kas - yag)
        let parts: [(String, Double, Color, String)] = [("Kas, kg", kas, Theme.Palette.fg, TR.num(kas, digits: 1)),
                                                       ("Yağ, %\(TR.num(scan.fatPct ?? yag / kg * 100, digits: 1))", yag, Theme.Palette.mid, TR.num(yag, digits: 1)),
                                                       ("Kemik, kg", kem, Theme.Palette.track, TR.num(kem, digits: 1))]
        VStack(alignment: .leading, spacing: Theme.Space.x4) {
            GeometryReader { g in
                HStack(spacing: 2) {
                    ForEach(parts, id: \.0) { p in Rectangle().fill(p.2).frame(width: max(2, (g.size.width - 4) * p.1 / max(kas + yag + kem, 0.1))) }
                }
            }
            .frame(height: 12).clipShape(Capsule()).padding(.top, Theme.Space.x1)
            .accessibilityElement().accessibilityLabel("Kas \(parts[0].3) kg, yağ \(parts[1].3) kg, kemik \(parts[2].3) kg")
            HStack(alignment: .top, spacing: Theme.Space.x2) {
                ForEach(parts, id: \.0) { p in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(p.3).font(Theme.Typo.heading).monospacedDigit().foregroundStyle(Theme.Palette.fg)
                        HStack(spacing: 6) { Circle().fill(p.2).frame(width: 8, height: 8); Text(p.0).font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted) }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(Theme.Space.card)
        .sofraCard()
    }
}

// MARK: - Ölçümler listesi

struct MeasurementsCard: View {
    var scans: [Scan]
    var next: String
    var onOpen: (Scan) -> Void
    var onAdd: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(scans.reversed()) { s in
                Button { onOpen(s) } label: {
                    HStack(spacing: Theme.Space.x3) {
                        VStack(alignment: .leading, spacing: 0) {
                            Text(BenFormat.day(s.d)).font(Theme.Typo.body).foregroundStyle(Theme.Palette.fg)
                            Text("\(BenFormat.weekday(s.d))\(s.src == nil ? "" : ", diyetisyende")").font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 0) {
                            Text(BenFormat.kg(s.kg)).font(Theme.Typo.bodyStrong).monospacedDigit().foregroundStyle(Theme.Palette.fg)
                            if let p = s.fatPct { Text("%\(TR.num(p, digits: 1)) yağ").font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted) }
                        }
                        Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Palette.faint)
                    }
                    .frame(minHeight: 60).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            Text("Sonraki ölçüm \(next)").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted).padding(.top, Theme.Space.x3).padding(.bottom, Theme.Space.x4)
            Button(action: onAdd) { Label("Tartı kâğıdını ekle", systemImage: "camera") }.buttonStyle(PrimaryButton(quiet: true))
        }
        .padding(.horizontal, Theme.Space.card).padding(.top, Theme.Space.x1).padding(.bottom, Theme.Space.card)
        .sofraCard()
    }
}

/// Ayar satırı: ad ve ok.
struct PlainRow: View {
    var title: String
    var subtitle: String = ""
    var body: some View {
        HStack {
            Text(title).font(Theme.Typo.body).foregroundStyle(Theme.Palette.fg)
            Spacer()
            if !subtitle.isEmpty { Text(subtitle).font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted).lineLimit(1) }
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Palette.faint)
        }
        .frame(minHeight: 52).contentShape(Rectangle())
    }
}

// MARK: - Ölçüm sayfası

/// Bir ölçümün bütün değerleri. Aralık, cihazın kâğıda bastığı aralıktır; sınıf adı (Obez, Yağlı) gösterilmez.
struct ScanDetailSheet: View {
    var scans: [Scan]
    @State var selected: String
    @Environment(\.dismiss) private var dismiss

    private var a: Scan { scans.first { $0.d == selected } ?? scans.last! }
    private var p: Scan? { scans.firstIndex { $0.d == a.d }.flatMap { $0 > 0 ? scans[$0 - 1] : nil } }

    struct Row: Identifiable { var n: String; var v: String; var sub: String; var range: (lo: Double, hi: Double, a0: Double, a1: Double, v: Double, lab: (Double) -> String)?; var id: String { n } }

    private func ch(_ k: KeyPath<Scan, Double?>, _ u: String, _ digits: Int = 1) -> String {
        guard let p else { return "İlk ölçüm" }
        guard let x = a[keyPath: k], let y = p[keyPath: k] else { return "" }
        let w = BodyStory.word(x - y, unit: u, digits: digits); return w == "aynı" ? "Aynı" : w
    }
    private func rng(_ key: String, _ v: Double?, _ a0: Double, _ a1: Double, _ lab: @escaping (Double) -> String) -> (Double, Double, Double, Double, Double, (Double) -> String)? {
        guard let v, let r = a.rng?[key], r.count == 2 else { return nil }
        return (r[0], r[1], a0, a1, v, lab)
    }

    var body: some View {
        let pct: (Double) -> String = { "%\(TR.num($0))" }
        let comp: [Row] = [
            Row(n: "Kilo", v: BenFormat.kg(a.kg), sub: ch(\.kg, "kg")),
            Row(n: "Yağ", v: BenFormat.kg(a.fat), sub: ch(\.fat, "kg")),
            Row(n: "Yağ oranı", v: a.fatPct.map { "%\(TR.num($0, digits: 1))" } ?? "—", sub: ch(\.fatPct, "puan"), range: rng("fatPct", a.fatPct, 4, 34, pct)),
            Row(n: "Kas", v: BenFormat.kg(a.muscle), sub: ch(\.muscle, "kg")),
            Row(n: "Su oranı", v: a.waterPct.map { "%\(TR.num($0, digits: 1))" } ?? "—", sub: a.water.map { "\(TR.num($0, digits: 1)) kg" } ?? "", range: rng("waterPct", a.waterPct, 45, 76, pct)),
            Row(n: "Protein", v: BenFormat.kg(a.protein), sub: ch(\.protein, "kg")),
            Row(n: "Mineral", v: BenFormat.kg(a.mineral), sub: ch(\.mineral, "kg")),
        ].filter { $0.v != "—" }
        let other: [Row] = [
            Row(n: "İç yağlanma", v: a.visceral.map { TR.num($0) } ?? "—", sub: ch(\.visceral, "", 0), range: rng("visceral", a.visceral, 1, 30, { TR.num($0) })),
            Row(n: "Bel", v: a.waist.map { "\(TR.num($0)) cm" } ?? "—", sub: ch(\.waist, "cm", 0)),
            Row(n: "Bel / boy", v: a.waistToHeight.map { TR.num($0, digits: 2) } ?? "—", sub: a.height.map { "\(TR.num($0)) cm boya göre" } ?? ""),
            Row(n: "Bazal metabolizma", v: a.bmr.map { "\(TR.num($0)) kcal" } ?? "—", sub: "Dinlenirken bir günde"),
            Row(n: "Metabolik yaş", v: a.metaAge.map { TR.num($0) } ?? "—", sub: "Cihazın tahmini"),
        ].filter { $0.v != "—" }

        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(BenFormat.day(a.d)) ölçümü").font(Theme.Typo.heading).foregroundStyle(Theme.Palette.fg)
                    Text("\(a.src ?? "Vücut analizi")\(a.src == nil ? "" : ", diyetisyende")").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                }
                .padding(.top, Theme.Space.x6).padding(.bottom, Theme.Space.x4)
                if scans.count > 1 {
                    Picker("Ölçüm tarihi", selection: $selected) { ForEach(scans.reversed()) { Text(BenFormat.day($0.d)).tag($0.d) } }
                        .pickerStyle(.segmented)
                }
                SectionTitle("Bileşim")
                ForEach(comp) { ValueRow(row: $0) }
                if let seg = a.seg, !seg.isEmpty {
                    SectionTitle("Bölgesel, kg")
                    Grid(alignment: .trailing, horizontalSpacing: Theme.Space.x2, verticalSpacing: 0) {
                        GridRow { Text("").gridColumnAlignment(.leading); Text("Kas"); Text("Yağ") }
                            .font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted).padding(.vertical, Theme.Space.x1)
                        ForEach(Array(seg.enumerated()), id: \.offset) { i, r in
                            GridRow {
                                Text(r.n).frame(maxWidth: .infinity, alignment: .leading)
                                Text(TR.num(r.kas, digits: 1)).frame(width: 72, alignment: .trailing)
                                Text(TR.num(r.yag, digits: 1)).fontWeight(i == 0 ? .semibold : .regular).frame(width: 72, alignment: .trailing)
                            }
                            .font(Theme.Typo.body).monospacedDigit().foregroundStyle(Theme.Palette.fg).padding(.vertical, Theme.Space.x2)
                        }
                    }
                }
                SectionTitle("Diğer")
                ForEach(other) { ValueRow(row: $0) }
            }
            .padding(.horizontal, Theme.Space.page + Theme.Space.x1).padding(.bottom, Theme.Space.x8)
        }
        .background(Theme.Palette.sheet)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.panel)
    }

    struct ValueRow: View {
        var row: Row
        var body: some View {
            VStack(spacing: Theme.Space.x2) {
                HStack(alignment: .center) {
                    Text(row.n).font(Theme.Typo.body).foregroundStyle(Theme.Palette.fg)
                    Spacer()
                    VStack(alignment: .trailing, spacing: 0) {
                        Text(row.v).font(Theme.Typo.bodyStrong).monospacedDigit().foregroundStyle(Theme.Palette.fg)
                        if !row.sub.isEmpty { Text(row.sub).font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted) }
                    }
                }
                if let r = row.range { RangeBar(lo: r.lo, hi: r.hi, a0: r.a0, a1: r.a1, value: r.v, label: r.lab) }
            }
            .padding(.vertical, Theme.Space.x2).frame(minHeight: 56)
        }
    }
}

/// Etiketsiz aralık çubuğu: cihazın aralığı soluk bant, değer nokta. Renk yok.
struct RangeBar: View {
    var lo: Double, hi: Double, a0: Double, a1: Double, value: Double
    var label: (Double) -> String
    private func pc(_ x: Double) -> CGFloat { CGFloat(max(0, min(1, (x - a0) / (a1 - a0)))) }
    var body: some View {
        VStack(spacing: 4) {
            GeometryReader { g in
                let w = g.size.width
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.Palette.track).frame(height: 6)
                    Capsule().fill(Theme.Palette.faint).frame(width: (pc(hi) - pc(lo)) * w, height: 6).offset(x: pc(lo) * w)
                    Circle().fill(Theme.Palette.fg).frame(width: 14, height: 14).overlay(Circle().stroke(Theme.Palette.sheet, lineWidth: 3))
                        .offset(x: pc(value) * w - 7)
                }
                .frame(height: 14)
            }
            .frame(height: 14)
            GeometryReader { g in
                ZStack(alignment: .topLeading) {
                    Text(label(lo)).fixedSize().position(x: pc(lo) * g.size.width, y: 6)
                    Text(label(hi)).fixedSize().position(x: pc(hi) * g.size.width, y: 6)
                }
            }
            .frame(height: 13).font(Theme.Typo.label).foregroundStyle(Theme.Palette.muted)
        }
        .accessibilityElement().accessibilityLabel("Aralık \(label(lo)) ile \(label(hi)) arası, değer \(label(value))")
    }
}

// MARK: - Tartı kâğıdını okuma

/// Kâğıttan okunan değerler kaydedilmeden önce gözden geçirilir. Bulanık okunan değer düzeltilebilir.
struct ScanReviewSheet: View {
    @State var scan: Scan
    /// Okunan değer sayısı ve bulanık okunanlar (anahtar: "waist" …).
    var count: Int
    var unsure: Set<String> = []
    var onSave: (Scan) -> Void
    var onRetake: () -> Void
    @State private var editing: String?
    @State private var draft = ""

    private var rows: [(key: String, n: String, v: String)] {
        var r: [(String, String, String)] = []
        if let x = scan.kg { r.append(("kg", "Kilo", BenFormat.kg(x))) }
        if let x = scan.fat { r.append(("fat", "Yağ", BenFormat.kg(x) + (scan.fatPct.map { ", %\(TR.num($0, digits: 1))" } ?? ""))) }
        if let x = scan.muscle { r.append(("muscle", "Kas", BenFormat.kg(x))) }
        if let x = scan.water { r.append(("water", "Su", BenFormat.kg(x))) }
        if let x = scan.trunkFat { r.append(("trunk", "Gövde yağı", BenFormat.kg(x))) }
        if let x = scan.waist { r.append(("waist", "Bel", "\(TR.num(x)) cm")) }
        return r
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: Theme.Space.x3) {
                        VStack(alignment: .leading, spacing: 5) {
                            ForEach([0.7, 1, 0.85, 1, 0.6, 1, 0.8], id: \.self) { w in Capsule().fill(Theme.Palette.track).frame(width: 40 * w, height: 3) }
                        }
                        .padding(8).frame(width: 56, height: 72, alignment: .topLeading)
                        .background(Theme.Palette.card, in: RoundedRectangle(cornerRadius: 6)).overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Theme.Palette.track))
                        .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(BenFormat.day(scan.d))\(scan.at.map { ", \($0)" } ?? "")").font(Theme.Typo.heading).foregroundStyle(Theme.Palette.fg)
                            Text("\(scan.src ?? "Tartı") kâğıdından \(count) değer okundu").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                        }
                    }
                    .padding(.top, Theme.Space.x6).padding(.bottom, Theme.Space.x4)
                    ForEach(rows, id: \.key) { r in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(r.n).font(Theme.Typo.body).foregroundStyle(Theme.Palette.fg)
                                if unsure.contains(r.key) { Text("Bulanık okundu, doğru mu?").font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted) }
                            }
                            Spacer()
                            if unsure.contains(r.key) {
                                Button(r.v) { editing = r.key; draft = "" }
                                    .font(Theme.Typo.captionMedium).foregroundStyle(Theme.Palette.fg)
                                    .padding(.horizontal, 10).frame(height: 28).background(Theme.Palette.ctl, in: Capsule())
                                    .overlay(Capsule().strokeBorder(Theme.Palette.faint, style: StrokeStyle(lineWidth: 1, dash: [3, 2])))
                                    .accessibilityLabel("\(r.n), \(r.v), düzenle")
                            } else {
                                Text(r.v).font(Theme.Typo.bodyStrong).monospacedDigit().foregroundStyle(Theme.Palette.fg)
                            }
                        }
                        .frame(minHeight: 56)
                    }
                    Text("Kâğıttaki ad ve soyad kaydedilmez.").font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted).padding(.top, Theme.Space.x3)
                }
                .padding(.horizontal, Theme.Space.page + Theme.Space.x1)
            }
            HStack(spacing: Theme.Space.x2) {
                Button("Yeniden çek", action: onRetake).font(Theme.Typo.bodyMedium).foregroundStyle(Theme.Palette.fg).frame(minWidth: 120, minHeight: Theme.Size.button)
                Button("Kaydet") { onSave(scan) }.buttonStyle(PrimaryButton())
            }
            .padding(.horizontal, Theme.Space.page).padding(.vertical, Theme.Space.x3)
        }
        .background(Theme.Palette.sheet)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.panel)
        .alert("Değeri düzelt", isPresented: Binding(get: { editing != nil }, set: { if !$0 { editing = nil } })) {
            TextField("Değer", text: $draft).keyboardType(.decimalPad)
            Button("Vazgeç", role: .cancel) {}
            Button("Kaydet") {
                if let v = Double(draft.replacingOccurrences(of: ",", with: ".")) {
                    switch editing { case "waist": scan.waist = v; case "kg": scan.kg = v; case "fat": scan.fat = v; case "muscle": scan.muscle = v; case "water": scan.water = v; default: break }
                }
            }
        }
    }
}
