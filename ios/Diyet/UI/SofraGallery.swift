#if DEBUG
import SwiftUI

/// Bileşenlerin bir arada, dokunulabilir örneği: beş sekmeli kabuk, Bugün ve Hafta. Veri plan.js'teki Çarşamba günü,
/// gün ortası (14:10). Gerçek ekran DiyetKit'e bağlanınca bu dosya yalnızca önizleme için kalır (DEBUG).
struct SofraGallery: View {
    var body: some View {
        TabView {
            DemoToday().tabItem { Label("Bugün", systemImage: "checkmark.circle") }
            DemoWeek().tabItem { Label("Hafta", systemImage: "chart.bar") }
            placeholder("Asistan").tabItem { Label("Asistan", systemImage: "bubble.left") }
            DemoProgress().tabItem { Label("İlerleme", systemImage: "square.grid.3x3") }
            placeholder("Program").tabItem { Label("Program", systemImage: "list.bullet") }
        }
        .tint(Theme.Palette.fg)
    }
    private func placeholder(_ t: String) -> some View {
        ZStack { Theme.Palette.bg.ignoresSafeArea(); Text("\(t) henüz çizilmedi").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted) }
    }
}

// MARK: - Bugün

struct DemoMeal: Identifiable {
    var id: String, title: String, time: String
    var main: FoodTileModel? = nil
    var items: [FoodTileModel]
    var kcal: Int, protein: Int
    var note: String? = nil
    var all: [FoodTileModel] { (main.map { [$0] } ?? []) + items }
    var required: [FoodTileModel] { all.filter { $0.caption != "İsteğe bağlı" } }
    var finished: Bool { required.allSatisfy { $0.state.isDone } }
    var started: Bool { all.contains { $0.state.isDone } }
}

struct DemoToday: View {
    @State private var meals: [DemoMeal] = DemoData.meals
    @State private var open: String? = "ogle"
    @State private var woke = true
    @State private var gym = false
    @State private var water = 4
    @State private var coffee = 1
    @State private var walk = false
    @State private var sheet: ItemSheetModel?
    @State private var menuFor: String?
    @State private var foldTask: Task<Void, Never>?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let nowID = "ogle"
    private let tr = Locale(identifier: "tr_TR")

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("18 Kasım Çarşamba").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                    Text("Bugün").font(Theme.Typo.title).foregroundStyle(Theme.Palette.fg)
                }
                .padding(.horizontal, Theme.Space.x1).padding(.bottom, Theme.Space.x4)

                dials.padding(.bottom, Theme.Space.x5)

                VStack(spacing: Theme.Space.x2) {
                    SimpleRowCard(title: "Uyanınca", subtitle: "2 bardak ılık limonlu su", icon: "limonlu-su", done: woke) { woke.toggle() }
                    ForEach(meals) { m in
                        if open == m.id { card(m).transition(.opacity) } else { row(m).transition(.opacity) }
                        if m.id == "ikindi" {
                            SimpleRowCard(title: "Antrenman", subtitle: "Alt, 7 hareket", time: "18:00", symbol: "dumbbell", done: gym) { gym.toggle() }
                        }
                    }
                }

                SectionTitle("Gün boyu")
                VStack(spacing: 0) {
                    AllDayRow(symbol: "drop.fill", symbolColor: Theme.Palette.water, title: "Su", subtitle: "\(water) bardak, hedef 10") {
                        CountStepper(value: water, tint: Theme.Palette.water) { water = max(0, water + $0) }
                    }
                    AllDayRow(symbol: "cup.and.saucer", title: "Kahve", subtitle: coffee > 2 ? "Günlük sınır aşıldı" : "En fazla 2 fincan, sade") {
                        CountStepper(value: coffee, over: coffee > 2) { coffee = max(0, coffee + $0) }
                    }
                    Button { walk.toggle() } label: {
                        AllDayRow(symbol: "figure.walk", title: "45 dk yürüyüş", subtitle: "Bu hafta \(walk ? 1 : 0) / 3") {
                            if walk { MarkShape().stroke(Theme.Palette.muted, style: StrokeStyle(lineWidth: 1.75, lineCap: .round, lineJoin: .round)).frame(width: 24, height: 24) }
                            else { Circle().strokeBorder(Theme.Palette.faint, lineWidth: 1.5).frame(width: 24, height: 24) }
                        }
                    }
                    .buttonStyle(.plain).sensoryFeedback(.selection, trigger: walk)
                }
                .padding(.horizontal, Theme.Space.card).padding(.vertical, Theme.Space.x2)
                .sofraCard()
            }
            .padding(.horizontal, Theme.Space.page).padding(.top, Theme.Space.x2).padding(.bottom, Theme.Space.x8)
        }
        .background(Theme.Palette.bg.ignoresSafeArea())
        .sheet(item: $sheet) { s in
            ItemSheet(model: s, onEat: { pick, q in apply(s, pick: pick, q: q); sheet = nil }, onSkip: { setState(s.mealID, s.item.id, .skipped); sheet = nil })
        }
        .confirmationDialog(meals.first { $0.id == menuFor }?.title ?? "", isPresented: Binding(get: { menuFor != nil }, set: { if !$0 { menuFor = nil } }), titleVisibility: .visible) {
            Button("Fotoğrafla kaydet") {}
            Button("Yazarak kaydet") {}
            Button("Not ekle") {}
            if let id = menuFor {
                Button("Bu öğünü atladım") { mutate(id) { if $0.state == .pending && $0.caption != "İsteğe bağlı" { $0.state = .skipped } } }
                Button("İşaretleri sıfırla", role: .destructive) { mutate(id) { $0.state = .pending } }
            }
        }
    }

    private var dials: some View {
        var k = 0, p = 0
        for m in meals { for t in m.all where t.state == .eaten { k += DemoData.values[t.id]?.0 ?? 0; p += DemoData.values[t.id]?.1 ?? 0 } }
        let litres = Double(water) * 0.25
        return DialRow {
            DialCard(title: "Kalori", value: k.formatted(.number.locale(tr)), target: "/ 2.160 kcal", progress: Double(k) / 2160)
            DialCard(title: "Protein", value: "\(p)", unit: "g", target: "/ 148 g", progress: Double(p) / 148)
            DialCard(title: "Su", value: litres.formatted(.number.precision(.fractionLength(0...2)).locale(tr)), unit: "L", target: "/ 2,5 L", progress: litres / 2.5, color: Theme.Palette.water)
        }
    }

    private func row(_ m: DemoMeal) -> some View {
        let isNow = m.id == nowID && !m.finished
        let parts: [LinePart] = m.finished ? m.all.filter { $0.state.isDone }.enumerated().map { i, t in
            LinePart(text: i == 0 ? t.name : t.name.lowercased(with: tr), struck: t.state == .skipped) } : []
        return MealRowCard(time: m.time, title: m.title, isNow: isNow, status: m.finished ? .done : isNow ? .text("Şimdi") : .none,
                           plates: m.finished ? m.all.filter { $0.state.isDone }.map { var t = $0; t.state = t.state == .skipped ? .skipped : .pending; return t } : m.all, parts: parts) {
            withAnimation(reduceMotion ? nil : Theme.Motion.fold) { open = m.id }
        }
    }

    private func card(_ m: DemoMeal) -> some View {
        let isNow = m.id == nowID && !m.finished
        let model = MealCardModel(id: m.id, title: m.title, time: m.time, isNow: isNow, when: m.finished ? "Yendi" : isNow ? "Şimdi" : "",
                                  info: "\(m.kcal) kcal, \(m.protein) g protein", note: m.note, main: m.main, items: m.items,
                                  primary: m.finished ? nil : m.started ? "Kalanını yedim" : "Hepsini yedim")
        return MealCard(model: model, onToggle: { id in mutate(m.id) { if $0.id == id { $0.state = $0.state.isDone ? .pending : .eaten } } },
                        onDetail: { id in if let t = m.all.first(where: { $0.id == id }) {
                            sheet = ItemSheetModel(mealID: m.id, item: t, options: [t] + (DemoData.options[id] ?? []), kcal: DemoData.values[id]?.0, protein: Double(DemoData.values[id]?.1 ?? 0)) } },
                        onPrimary: { mutate(m.id) { if $0.state == .pending && $0.caption != "İsteğe bağlı" { $0.state = .eaten } } },
                        onMore: { menuFor = m.id },
                        onClose: { withAnimation(reduceMotion ? nil : Theme.Motion.fold) { open = nil } })
    }

    private func mutate(_ mid: String, _ f: (inout FoodTileModel) -> Void) {
        guard let i = meals.firstIndex(where: { $0.id == mid }) else { return }
        if var x = meals[i].main { f(&x); meals[i].main = x }
        for j in meals[i].items.indices { f(&meals[i].items[j]) }
        settle(mid)
    }
    private func setState(_ mid: String, _ id: String, _ s: FoodState) { mutate(mid) { if $0.id == id { $0.state = s } } }
    private func apply(_ s: ItemSheetModel, pick: String, q: Double) {
        let o = s.options.first { $0.id == pick } ?? s.item
        mutate(s.mealID) { t in
            guard t.id == s.item.id else { return }
            if o.id != s.item.id { t.caption = "\(s.item.name.lowercased(with: tr)) yerine"; t.name = o.name; t.icon = o.icon; t.amount = o.amount; t.note = nil }
            t.amountChanged = q != 1
            t.state = .eaten
        }
    }

    /// Son kalem yenince kart bir an boş sofrayı gösterir, sonra tek karta katlanır.
    private func settle(_ mid: String) {
        foldTask?.cancel()
        guard let m = meals.first(where: { $0.id == mid }), m.finished, open == mid else { return }
        foldTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(Theme.Motion.foldDelay))
            guard !Task.isCancelled, open == mid, meals.first(where: { $0.id == mid })?.finished == true else { return }
            withAnimation(reduceMotion ? nil : Theme.Motion.fold) { open = nil }
        }
    }
}

// MARK: - Hafta

struct DemoWeek: View {
    @State private var selected = 2
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("16 – 22 Kasım").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                    Text("Hafta").font(Theme.Typo.title).foregroundStyle(Theme.Palette.fg)
                }
                .padding(.horizontal, Theme.Space.x1).padding(.bottom, Theme.Space.x4)
                DialRow {
                    DialCard(title: "Uyum", value: "%98", target: "3 gün kayıtlı", progress: 0.98)
                    DialCard(title: "Antrenman", value: "0", target: "/ 3", progress: 0)
                    DialCard(title: "Su", value: "1,8", unit: "L", target: "günlük ort.", progress: 0.72, color: Theme.Palette.water)
                }
                .padding(.bottom, Theme.Space.x2)
                WeekMainsCard(days: DemoData.week, selected: $selected)
                SectionTitle("Bu hafta")
                LedgerCard(rows: [.init(title: "Kalori dengesi", value: "−250 kcal", note: "Günlük ortalama, plandan eksik"),
                                  .init(title: "Yürüyüş", value: "0 / 3"), .init(title: "Atlanan öğün", value: "0")])
            }
            .padding(.horizontal, Theme.Space.page).padding(.top, Theme.Space.x2).padding(.bottom, Theme.Space.x8)
        }
        .background(Theme.Palette.bg.ignoresSafeArea())
    }
}

// MARK: - İlerleme

struct DemoProgress: View {
    @State private var weights = DemoData.weights
    private var logged: [HeatDay] { DemoData.heat.joined().filter { $0.pct != nil } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Programın başından beri").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                    Text("İlerleme").font(Theme.Typo.title).foregroundStyle(Theme.Palette.fg)
                }
                .padding(.horizontal, Theme.Space.x1).padding(.bottom, Theme.Space.x4)

                ScoreCalendarCard(average: logged.isEmpty ? nil : logged.reduce(0) { $0 + ($1.pct ?? 0) } / logged.count, logged: logged.count, weeks: DemoData.heat)

                SectionTitle("Son 30 gün")
                DialRow {
                    DialCard(title: "Uyum", value: "%91", target: "27 / 30 gün", progress: 0.91)
                    DialCard(title: "Protein", value: "136", unit: "g", target: "günlük ort.", progress: 136.0 / 148)
                    DialCard(title: "Su", value: "2,1", unit: "L", target: "günlük ort.", progress: 2.1 / 2.5, color: Theme.Palette.water)
                }
                .padding(.bottom, Theme.Space.x2)
                LedgerCard(rows: [.init(title: "Antrenman", value: "11 / 13"), .init(title: "Yürüyüş", value: "9 / 13")])

                SectionTitle("Son 30 günde sofranda")
                TopFoodsCard(items: DemoData.top)

                SectionTitle("Aylar")
                MonthsCard(rows: [.init(month: "Kasım", days: 18, score: 93, gym: 7, kg: 90.6), .init(month: "Ekim", days: 29, score: 88, gym: 12, kg: 91.4),
                                  .init(month: "Eylül", days: 17, score: 81, gym: 6, kg: 93.1)])

                SectionTitle("Kilo")
                WeightCard(entries: weights, goal: 85) { v in
                    let today = Calendar.current.startOfDay(for: DemoData.today)
                    withAnimation(Theme.Motion.settle) { weights = weights.filter { $0.date != today } + [WeightEntry(date: today, kg: v)] }
                }
                Text("Haftada bir, aynı saatte tartıl.").font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
                    .padding(.horizontal, Theme.Space.x1).padding(.top, Theme.Space.x2)
            }
            .padding(.horizontal, Theme.Space.page).padding(.top, Theme.Space.x2).padding(.bottom, Theme.Space.x8)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.Palette.bg.ignoresSafeArea())
    }
}

// MARK: - Örnek veri (plan.js, PLAN_DEFAULT)

enum DemoData {
    static func t(_ id: String, _ name: String, _ amount: String, _ icon: String?, _ state: FoodState = .pending, caption: String? = nil, note: String? = nil) -> FoodTileModel {
        FoodTileModel(id: id, name: name, amount: amount, caption: caption, note: note, icon: icon, state: state)
    }
    static let values: [String: (Int, Int)] = ["peynir": (160, 10), "yumurta": (150, 13), "sebze": (30, 1), "yag": (110, 2), "ekmek-k": (125, 5),
        "kofte": (330, 27), "yogurt-o": (45, 3), "ekmek-o": (125, 5), "salata-o": (70, 1), "galeta": (100, 3), "meyve": (70, 1),
        "balik": (330, 40), "yogurt-a": (45, 3), "ekmek-a": (125, 5), "salata-a": (70, 1), "psut": (160, 22), "kabak": (115, 6)]
    static let bread = [t("yulaf", "Yulaf ezmesi", "4 yk", "yulaf-ezmesi"), t("bulgur", "Bulgur pilavı", "6 yk", "bulgur-pilavi"),
                        t("makarna", "Tam buğday makarna", "6 yk", "tam-bugday-makarna"), t("patates", "Haşlanmış patates", "1 orta boy", "haslanmis-patates"), t("lavas", "Tam buğday lavaş", "1 küçük", "lavas")]
    static let yogurt = [t("ayran", "Ayran", "1 bardak", "ayran"), t("cacik", "Yağsız cacık", "1 küçük kase", "cacik"), t("kefir", "Kefir", "1 çay bardağı", "kefir")]
    static let options: [String: [FoodTileModel]] = [
        "ekmek-o": bread, "ekmek-a": bread, "yogurt-o": yogurt, "yogurt-a": yogurt,
        "kofte": [t("et", "Yağsız ızgara et", "150 g", "biftek"), t("hindi", "Hindi ya da tavuk köfte", "150 g", nil)],
        "balik": [t("tavuk", "Tavuk", "150 g", "izgara-tavuk-gogsu"), t("ton", "Ton balığı", "160 g", "ton-baligi")],
        "meyve": [t("portakal", "Portakal", "1 adet", "portakal"), t("mandalina", "Mandalina", "2 adet", "mandalina"), t("muz", "Muz", "1 küçük", "muz"), t("cilek", "Çilek", "10-12 adet", "cilek")],
        "galeta": [t("leblebi", "Leblebi", "½ çay bardağı", "leblebi"), t("patlak", "Pirinç patlağı", "2 adet", "pirinc-patlagi")],
        "psut": [t("quark", "Sek quark protein", "1 kutu", "quark"), t("skyr", "Skyr", "200 g", "skyr")],
        "kabak": [t("badem", "Çiğ badem ya da fındık", "6-8 adet", "badem"), t("ceviz", "Ceviz", "2 tam", "ceviz")],
    ]
    static let meals: [DemoMeal] = [
        DemoMeal(id: "kahvalti", title: "Kahvaltı", time: "11:00", items: [
            t("peynir", "Peynir", "2 dilim", "beyaz-peynir", .eaten), t("yumurta", "Yumurta", "2 adet", "haslanmis-yumurta", .eaten),
            t("sebze", "Söğüş", "1 porsiyon", "sogus", .eaten), t("yag", "Ceviz", "2-3 tam", "ceviz", .eaten),
            t("ekmek-k", "Yulaf ezmesi", "4 yk", "yulaf-ezmesi", .eaten, caption: "ekmek yerine"), t("cay", "Açık çay", "1 fincan", "acik-cay", caption: "İsteğe bağlı"),
        ], kcal: 575, protein: 31),
        DemoMeal(id: "ogle", title: "Öğle", time: "14:00", main: t("kofte", "Izgara köfte", "5 adet", "izgara-kofte", .eaten, note: "Izgara veya tost makinesinde"),
                 items: [t("yogurt-o", "Yoğurt", "3-4 yk", "yogurt", .eaten), t("ekmek-o", "Ekmek", "2 dilim", "tam-bugday-ekmegi"), t("salata-o", "Salata", "1 porsiyon", "yesil-salata")], kcal: 570, protein: 36),
        DemoMeal(id: "ikindi", title: "İkindi", time: "16:00", items: [t("galeta", "Galeta", "5 adet", "galeta"), t("meyve", "Meyve", "1 porsiyon", "elma")],
                 kcal: 170, protein: 4, note: "Antrenmandan önce: galeta ve meyveyi seç, karbonhidrat işe yarar."),
        DemoMeal(id: "aksam", title: "Akşam", time: "20:00", main: t("balik", "Balık", "250 g", "levrek-izgara", note: "Izgara, buğulama veya fırın"),
                 items: [t("yogurt-a", "Yoğurt", "3-4 yk", "yogurt"), t("ekmek-a", "Ekmek", "2 dilim", "tam-bugday-ekmegi"), t("salata-a", "Salata", "1 porsiyon", "yesil-salata")],
                 kcal: 570, protein: 49, note: "Antrenmandan sonra: bu öğünü ve ekmeğini atlama."),
        DemoMeal(id: "gece", title: "Gece", time: "21:00", items: [t("psut", "Protein süt", "1 bardak", "protein-sut"), t("kabak", "Kabak çekirdeği", "1 avuç içi", "kabak-cekirdegi")], kcal: 275, protein: 28),
    ]
    /// Örnek gün: 18 Kasım 2026 Çarşamba.
    static let today: Date = Calendar.current.date(from: DateComponents(year: 2026, month: 11, day: 18))!
    /// 26 hafta; program 14 Eylül'de başlamış, öncesi kayıtsız. Değerler sabit bir diziden, her açılışta aynı.
    static let heat: [[HeatDay]] = {
        var cal = Calendar(identifier: .gregorian); cal.firstWeekday = 2
        let monday = cal.date(byAdding: .day, value: -2, to: today)!
        let start = cal.date(from: DateComponents(year: 2026, month: 9, day: 14))!
        var seed: UInt64 = 42
        func next() -> Int { seed = seed &* 6364136223846793005 &+ 1442695040888963407; return Int((seed >> 33) % 100) }
        return (0..<26).map { w in
            (0..<7).map { d in
                let date = cal.date(byAdding: .day, value: (w - 25) * 7 + d, to: monday)!
                let r = next(), ramp = min(1, max(0, date.timeIntervalSince(start) / (86400 * 50)))
                var pct: Int? = nil
                if date >= start && date <= today && r > 7 { pct = min(100, Int(64 + ramp * 18) + r * 22 / 100 + (d >= 5 ? -12 : 0)) }
                if date == today { pct = 96 }
                return HeatDay(date: date, pct: pct, isToday: date == today, isFuture: date > today)
            }
        }
    }()
    static let weights: [WeightEntry] = {
        let kg: [(Int, Int, Double)] = [(9, 14, 94.2), (9, 21, 93.6), (9, 28, 93.1), (10, 5, 92.8), (10, 12, 92.1), (10, 19, 92.3), (10, 26, 91.4), (11, 2, 91.2), (11, 9, 90.9), (11, 16, 90.6)]
        return kg.map { WeightEntry(date: Calendar.current.date(from: DateComponents(year: 2026, month: $0.0, day: $0.1))!, kg: $0.2) }
    }()
    static let top: [TopFoodsCard.Item] = [
        .init(id: "yogurt", name: "Yoğurt", icon: "yogurt", count: 41), .init(id: "ekmek", name: "Tam buğday ekmeği", icon: "tam-bugday-ekmegi", count: 38),
        .init(id: "yumurta", name: "Yumurta", icon: "haslanmis-yumurta", count: 27), .init(id: "salata", name: "Salata", icon: "yesil-salata", count: 26),
        .init(id: "peynir", name: "Peynir", icon: "beyaz-peynir", count: 24), .init(id: "kofte", name: "Izgara köfte", icon: "izgara-kofte", count: 11),
        .init(id: "tavuk", name: "Tavuk", icon: "izgara-tavuk-gogsu", count: 9), .init(id: "balik", name: "Balık", icon: "levrek-izgara", count: 8),
    ]
    /// plan.js rota: öğle ve akşam ana yemekleri, Pazartesi'den Pazar'a. Kurubaklagilin ikonu yok.
    static let week: [WeekMainsCard.Day] = {
        let names = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"], labels = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]
        let main: [String: (String, String?)] = ["bakla": ("Kurubaklagil", nil), "tavuk": ("Tavuk", "izgara-tavuk-gogsu"), "kofte": ("Köfte", "izgara-kofte"), "balik": ("Balık", "levrek-izgara"), "ton": ("Ton balıklı", "ton-baligi")]
        let ogle = ["bakla", "tavuk", "kofte", "bakla", "balik", "kofte", "ton"], aksam = ["kofte", "bakla", "balik", "ton", "kofte", "tavuk", "bakla"]
        return (0..<7).map { i in
            WeekMainsCard.Day(id: i, label: labels[i], name: names[i], isToday: i == 2,
                              lunch: t("o\(i)", main[ogle[i]]!.0, "", main[ogle[i]]!.1, i <= 2 ? .eaten : .pending),
                              dinner: t("a\(i)", main[aksam[i]]!.0, "", main[aksam[i]]!.1, i < 2 ? .eaten : .pending))
        }
    }()
}

#Preview("Sofra, açık") { SofraGallery().preferredColorScheme(.light) }
#Preview("Sofra, koyu") { SofraGallery().preferredColorScheme(.dark) }
#endif
