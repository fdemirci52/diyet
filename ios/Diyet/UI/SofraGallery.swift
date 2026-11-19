#if DEBUG
import SwiftUI

/// Bileşenlerin bir arada, dokunulabilir örneği: plan.js'teki Çarşamba günü, gün ortası (14:10).
/// Gerçek ekran DiyetKit'e bağlanınca bu dosya yalnızca önizleme için kalır; uygulamaya girmez (DEBUG).
struct SofraGallery: View {
    struct Meal: Identifiable {
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

    @State private var meals: [Meal] = SofraGallery.sample
    @State private var open: String? = "ogle"
    @State private var woke = true
    @State private var foldTask: Task<Void, Never>?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let nowID = "ogle"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("18 Kasım Çarşamba").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                    Text("Bugün").font(Theme.Typo.title).foregroundStyle(Theme.Palette.fg)
                }
                .padding(.horizontal, Theme.Space.x1).padding(.bottom, Theme.Space.x5)

                DayStats(stats: stats).padding(.bottom, Theme.Space.x4)

                TimelineRow(title: "Uyanınca", parts: [LinePart(text: "2 bardak ılık limonlu su")], status: .toggle(woke)) { woke.toggle() }

                ForEach(meals) { m in
                    if open == m.id { card(m).padding(.vertical, Theme.Space.x2).transition(.opacity) }
                    else { row(m).transition(.opacity) }
                    if m.id == "ikindi" {
                        TimelineRow(time: "18:00", title: "Antrenman", parts: [LinePart(text: "Alt"), LinePart(text: "7 hareket")]) {}
                    }
                }
            }
            .padding(.horizontal, Theme.Space.page).padding(.top, Theme.Space.x4).padding(.bottom, 120)
        }
        .background(Theme.Palette.bg.ignoresSafeArea())
        .tint(Theme.Palette.fg)
    }

    private var stats: [DayStats.Stat] {
        var k = 0, p = 0
        for m in meals { for t in m.all where t.state == .eaten { k += SofraGallery.kcal[t.id]?.0 ?? 0; p += SofraGallery.kcal[t.id]?.1 ?? 0 } }
        return [.init(value: k.formatted(.number.locale(Locale(identifier: "tr_TR"))), caption: "/ 2.160 kcal"),
                .init(value: "\(p) g", caption: "/ 148 g protein"), .init(value: "1 L", caption: "/ 2,5 L su")]
    }

    private func row(_ m: Meal) -> some View {
        let pending = m.required.filter { !$0.state.isDone }
        let parts: [LinePart] = m.finished ? m.all.filter { $0.state.isDone }.map { LinePart(text: $0.name, struck: $0.state == .skipped) }
            : (m.started ? pending : m.required).map { LinePart(text: $0.name) }
        let lowered = parts.enumerated().map { i, p in LinePart(text: i == 0 && !(m.started && !m.finished) ? p.text : p.text.lowercased(with: Locale(identifier: "tr_TR")), struck: p.struck) }
        return TimelineRow(time: m.time, title: m.title, prefix: m.started && !m.finished ? "Kalan: " : "", parts: lowered,
                           status: m.finished ? .done : m.id == nowID ? .text("Şimdi") : .none, isNow: m.id == nowID && !m.finished) {
            withAnimation(reduceMotion ? nil : Theme.Motion.fold) { open = m.id }
        }
    }

    private func card(_ m: Meal) -> some View {
        let isNow = m.id == nowID && !m.finished
        let model = MealCardModel(id: m.id, title: m.title, time: m.time, isNow: isNow, when: m.finished ? "Yendi" : isNow ? "Şimdi" : "",
                                  info: "\(m.kcal) kcal, \(m.protein) g protein", note: m.note, main: m.main, items: m.items,
                                  primary: m.finished ? nil : m.started ? "Kalanını yedim" : "Hepsini yedim")
        return MealCard(model: model, onToggle: { toggle(m.id, $0) }, onDetail: { _ in }, onPrimary: { eatAll(m.id) }, onMore: {},
                        onClose: { withAnimation(reduceMotion ? nil : Theme.Motion.fold) { open = nil } })
    }

    private func mutate(_ mid: String, _ f: (inout FoodTileModel) -> Void) {
        guard let i = meals.firstIndex(where: { $0.id == mid }) else { return }
        if var x = meals[i].main { f(&x); meals[i].main = x }
        for j in meals[i].items.indices { f(&meals[i].items[j]) }
        settle(mid)
    }
    private func toggle(_ mid: String, _ id: String) { mutate(mid) { if $0.id == id { $0.state = $0.state.isDone ? .pending : .eaten } } }
    private func eatAll(_ mid: String) { mutate(mid) { if $0.state == .pending && $0.caption != "İsteğe bağlı" { $0.state = .eaten } } }

    /// Son kalem yenince kart bir an boş sofrayı gösterir, sonra tek satıra katlanır.
    private func settle(_ mid: String) {
        foldTask?.cancel()
        guard let m = meals.first(where: { $0.id == mid }), m.finished, open == mid else { return }
        foldTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(Theme.Motion.foldDelay))
            guard !Task.isCancelled, open == mid, meals.first(where: { $0.id == mid })?.finished == true else { return }
            withAnimation(reduceMotion ? nil : Theme.Motion.fold) { open = nil }
        }
    }

    // plan.js (PLAN_DEFAULT), Çarşamba: öğle köfte, akşam balık. Kahvaltıda ceviz ve yulaf ezmesi muadil olarak yenmiş.
    static let kcal: [String: (Int, Int)] = ["peynir": (160, 10), "yumurta": (150, 13), "sebze": (30, 1), "yag": (110, 2), "ekmek-k": (125, 5),
        "kofte": (330, 27), "yogurt-o": (45, 3), "ekmek-o": (125, 5), "salata-o": (70, 1), "galeta": (100, 3), "meyve": (70, 1),
        "balik": (330, 40), "yogurt-a": (45, 3), "ekmek-a": (125, 5), "salata-a": (70, 1), "psut": (160, 22), "kabak": (115, 6)]
    static let sample: [Meal] = [
        Meal(id: "kahvalti", title: "Kahvaltı", time: "11:00", items: [
            .init(id: "peynir", name: "Peynir", amount: "2 dilim", icon: "beyaz-peynir", state: .eaten),
            .init(id: "yumurta", name: "Yumurta", amount: "2 adet", icon: "haslanmis-yumurta", state: .eaten),
            .init(id: "sebze", name: "Söğüş", amount: "1 porsiyon", icon: "sogus", state: .eaten),
            .init(id: "yag", name: "Ceviz", amount: "2-3 tam", icon: "ceviz", state: .eaten),
            .init(id: "ekmek-k", name: "Yulaf ezmesi", amount: "4 yk", caption: "ekmek yerine", icon: "yulaf-ezmesi", state: .eaten),
            .init(id: "cay", name: "Açık çay", amount: "1 fincan", caption: "İsteğe bağlı", icon: "acik-cay"),
        ], kcal: 575, protein: 31),
        Meal(id: "ogle", title: "Öğle", time: "14:00",
             main: .init(id: "kofte", name: "Izgara köfte", amount: "5 adet", note: "Izgara veya tost makinesinde", icon: "izgara-kofte", state: .eaten),
             items: [
                .init(id: "yogurt-o", name: "Yoğurt", amount: "3-4 yk", icon: "yogurt", state: .eaten),
                .init(id: "ekmek-o", name: "Ekmek", amount: "2 dilim", icon: "tam-bugday-ekmegi"),
                .init(id: "salata-o", name: "Salata", amount: "1 porsiyon", icon: "yesil-salata"),
             ], kcal: 570, protein: 36),
        Meal(id: "ikindi", title: "İkindi", time: "16:00", items: [
            .init(id: "galeta", name: "Galeta", amount: "5 adet", icon: "galeta"),
            .init(id: "meyve", name: "Meyve", amount: "1 porsiyon", icon: "elma"),
        ], kcal: 170, protein: 4, note: "Antrenmandan önce: galeta ve meyveyi seç, karbonhidrat işe yarar."),
        Meal(id: "aksam", title: "Akşam", time: "20:00",
             main: .init(id: "balik", name: "Balık", amount: "250 g", note: "Izgara, buğulama veya fırın", icon: "levrek-izgara"),
             items: [
                .init(id: "yogurt-a", name: "Yoğurt", amount: "3-4 yk", icon: "yogurt"),
                .init(id: "ekmek-a", name: "Ekmek", amount: "2 dilim", icon: "tam-bugday-ekmegi"),
                .init(id: "salata-a", name: "Salata", amount: "1 porsiyon", icon: "yesil-salata"),
             ], kcal: 570, protein: 49, note: "Antrenmandan sonra: bu öğünü ve ekmeğini atlama."),
        Meal(id: "gece", title: "Gece", time: "21:00", items: [
            .init(id: "psut", name: "Protein süt", amount: "1 bardak", icon: "protein-sut"),
            .init(id: "kabak", name: "Kabak çekirdeği", amount: "1 avuç içi", icon: "kabak-cekirdegi"),
        ], kcal: 275, protein: 28),
    ]
}

#Preview("Sofra, açık") { SofraGallery().preferredColorScheme(.light) }
#Preview("Sofra, koyu") { SofraGallery().preferredColorScheme(.dark) }
#endif
