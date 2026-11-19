#if DEBUG
import SwiftUI

/// Bileşenlerin bir arada, dokunulabilir örneği: beş sekmeli kabuk, Bugün ve Hafta. Veri plan.js'teki Çarşamba günü,
/// gün ortası (14:10). Gerçek ekran DiyetKit'e bağlanınca bu dosya yalnızca önizleme için kalır (DEBUG).
struct SofraGallery: View {
    @AppStorage("diyet-theme") private var theme = ""
    var body: some View {
        TabView {
            DemoToday().tabItem { Label("Bugün", systemImage: "checkmark.circle") }
            DemoWeek().tabItem { Label("Hafta", systemImage: "chart.bar") }
            DemoChat().tabItem { Label("Asistan", systemImage: "bubble.left") }
            DemoProgress().tabItem { Label("İlerleme", systemImage: "square.grid.3x3") }
            DemoProgram().tabItem { Label("Program", systemImage: "list.bullet") }
        }
        .tint(Theme.Palette.fg)
        .preferredColorScheme(theme == "light" ? .light : theme == "dark" ? .dark : nil)
    }
}

// MARK: - Asistan

/// Örnek sohbet: cevaplar hazır metin, sözcük sözcük akar; gerçek çağrı yok.
struct DemoChat: View {
    @State private var messages: [ChatMessage] = DemoData.chat
    @State private var title = "Galeta yerine ne olur"
    @State private var draft = ""
    @State private var history = false
    @State private var chats = DemoData.chats
    @State private var stream: Task<Void, Never>?
    @FocusState private var focused: Bool
    private var busy: Bool { messages.last?.streaming == true }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Space.x5) {
                    if messages.isEmpty {
                        ChatEmptyState(prompts: ["Bugün ne kadar proteinim kaldı?", "Akşam dışarıda yiyeceğim, ne seçeyim?", "Su hedefimi 12 bardak yap"]) { send($0) }
                            .padding(.top, Theme.Space.x2)
                    }
                    ForEach(messages) { m in
                        ChatMessageView(message: m, onApply: { setAction(m.id, .done) }, onDecline: { setAction(m.id, .declined) },
                                        onCopy: { UIPasteboard.general.string = m.text })
                    }
                    Color.clear.frame(height: 1).id("end")
                }
                .padding(.horizontal, Theme.Space.page).padding(.top, Theme.Space.x2).padding(.bottom, Theme.Space.x4)
            }
            .scrollDismissesKeyboard(.interactively)
            .defaultScrollAnchor(.bottom)
            .onChange(of: messages.last?.text) { proxy.scrollTo("end", anchor: .bottom) }
            .onChange(of: focused) { if focused { proxy.scrollTo("end", anchor: .bottom) } }
        }
        .background(Theme.Palette.bg.ignoresSafeArea())
        .safeAreaInset(edge: .top, spacing: 0) {
            ChatTopBar(title: messages.isEmpty ? "Yeni sohbet" : title, onHistory: { history = true }, onNew: { stop(); messages = []; title = "Yeni sohbet" })
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            ChatComposer(text: $draft, busy: busy, focus: $focused, onSend: { send(draft) }, onStop: stop)
        }
        .sheet(isPresented: $history) {
            ChatHistorySheet(chats: chats, current: "c1", onOpen: { _ in history = false; messages = DemoData.chat; title = "Galeta yerine ne olur" },
                             onDelete: { id in chats.removeAll { $0.id == id } })
        }
    }

    private func setAction(_ id: UUID, _ s: ChatAction.State) {
        guard let i = messages.firstIndex(where: { $0.id == id }) else { return }
        withAnimation(Theme.Motion.settle) { messages[i].action?.state = s }
    }
    private func stop() {
        stream?.cancel()
        if let i = messages.indices.last, messages[i].streaming { messages[i].streaming = false }
    }
    private func send(_ raw: String) {
        let q = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty, !busy else { return }
        if messages.isEmpty { title = String(q.prefix(28)) }
        draft = ""
        let water = q.lowercased(with: Locale(identifier: "tr_TR")).contains("su hedef")
        let full = water ? "Su hedefini 12 bardağa çıkarabilirim. Onaylarsan Bugün ekranındaki kadran da 3 litreye göre dolar."
                         : "Bugün **94 g** protein aldın, hedefe **54 g** kaldı. Akşam ve gece öğünü planlandığı gibi giderse yaklaşık 77 g daha gelir, yani hedefi geçersin.\n- Akşam: balık 250 g, yoğurt, ekmek\n- Gece: protein süt ve kabak çekirdeği\nEk bir şey yemene gerek yok."
        messages.append(ChatMessage(role: .user, text: q))
        var reply = ChatMessage(role: .assistant, text: "", streaming: true)
        if water { reply.action = ChatAction(lines: ["Su hedefi: 10 → 12 bardak"]) }
        else { reply.foods = [DemoData.t("c-balik", "Balık", "250 g", "levrek-izgara", caption: "40 g protein"), DemoData.t("c-psut", "Protein süt", "1 bardak", "protein-sut", caption: "22 g protein")] }
        messages.append(reply)
        let id = reply.id
        stream = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(500))
            for w in full.split(separator: " ", omittingEmptySubsequences: false) {
                guard !Task.isCancelled, let i = messages.firstIndex(where: { $0.id == id }) else { return }
                messages[i].text += (messages[i].text.isEmpty ? "" : " ") + w
                try? await Task.sleep(for: .milliseconds(45))
            }
            if let i = messages.firstIndex(where: { $0.id == id }) { messages[i].streaming = false }
        }
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

// MARK: - Program

struct DemoProgram: View {
    enum Page: String, Hashable { case kurallar, saatler, muadil, gidalar, takviye, gorunum, antrenman, vucut, ai, baglanti, veri }
    @AppStorage("diyet-theme") private var theme = ""
    @State private var path: [Page] = []
    private let rows: [(Page, String, String, String)] = [
        (.kurallar, "list.bullet", "Kurallar", "9 madde"), (.saatler, "clock", "Öğün saatleri", "Hafta içi ve hafta sonu"),
        (.muadil, "arrow.left.arrow.right", "Muadiller", "Neyin yerine ne yenir"), (.gidalar, "fork.knife", "Gıdalarım", "Kendi ürünlerin"),
        (.takviye, "pills", "Takviyeler", "Ne zaman alacağını hatırlat"), (.antrenman, "dumbbell", "Antrenman", "Pzt üst, Çar alt, Cum full body"),
        (.vucut, "figure.stand", "Vücut analizi", "13 Kasım ölçümü"), (.gorunum, "sun.max", "Görünüm", ""),
        (.ai, "bubble.left", "Yapay zekâ", "Davet kodu gerekli"), (.baglanti, "link", "Program bağlantısı", "Yükle ya da paylaş"), (.veri, "arrow.down.to.line", "Yedek", "İndir ya da geri yükle"),
    ]

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Diyetisyen programı, 13 Kasım").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                        Text("Program").font(Theme.Typo.title).foregroundStyle(Theme.Palette.fg)
                    }
                    .padding(.horizontal, Theme.Space.x1).padding(.bottom, Theme.Space.x4)

                    GoalCard(value: "85", text: "Göbeksiz, kas ağırlıklı. Önce yağ ver, sonra kaloriyi artırıp tırman.",
                             stats: [.init(title: "Şu an", value: "83,9", unit: "kg", note: "%14,5 yağ"), .init(title: "Günlük plan", value: "2.160", unit: "kcal", note: "148 g protein")])

                    SectionTitle("Günlük program")
                    PlanMealsCard(meals: DemoData.planMeals)
                    Text("Öğle ve akşamın ana yemeği gün gün değişir; haftalık dağılım Hafta sekmesinde.").font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
                        .padding(.horizontal, Theme.Space.x1).padding(.top, Theme.Space.x2)

                    SectionTitle("Program ve ayarlar")
                    RowsCard {
                        ForEach(rows, id: \.0) { r in
                            NavigationLink(value: r.0) {
                                NavRow(symbol: r.1, title: r.2, subtitle: r.0 == .gorunum ? (theme == "light" ? "Açık" : theme == "dark" ? "Koyu" : "Sistemle aynı") : r.3)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    Text("Kalori ve protein değerleri yaklaşık tahminlerdir.").font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
                        .padding(.horizontal, Theme.Space.x1).padding(.top, Theme.Space.x2)
                }
                .padding(.horizontal, Theme.Space.page).padding(.top, Theme.Space.x2).padding(.bottom, Theme.Space.x8)
            }
            .background(Theme.Palette.bg.ignoresSafeArea())
            .navigationTitle("Program")   // çubuk gizli; alt ekranın geri düğmesi bu adı taşır
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Page.self) { page($0) }
        }
    }

    @ViewBuilder private func page(_ p: Page) -> some View {
        switch p {
        case .kurallar:
            DetailPage(title: "Kurallar", lead: "Diyetisyenin notları.") { ProseCard(rows: DemoData.rules) }
        case .saatler:
            DetailPage(title: "Öğün saatleri", lead: "Hafta sonu saatleri kendiliğinden uygulanır.") {
                SectionTitle("Hafta içi")
                LedgerCard(rows: [.init(title: "Kahvaltı", value: "11:00"), .init(title: "Öğle", value: "14:00"), .init(title: "İkindi", value: "16:00"), .init(title: "Akşam", value: "20:00"), .init(title: "Gece", value: "21:00")])
                SectionTitle("Hafta sonu")
                LedgerCard(rows: [.init(title: "Kahvaltı", value: "10:00"), .init(title: "Öğle", value: "14:00"), .init(title: "İkindi", value: "16:30"), .init(title: "Akşam", value: "19:00"), .init(title: "Gece", value: "21:00")])
            }
        case .muadil:
            DetailPage(title: "Muadiller", lead: "Aynı grup içinde değişim programı bozmaz. Yaklaşık eşdeğerlerdir; diyetisyenin onayladıklarını kullan.") {
                ForEach(DemoData.swaps) { SwapGroupCard(group: $0) }
            }
        case .antrenman:
            DetailPage(title: "Antrenman", lead: "Haftada üç gün, akşam 18:00-19:00.") {
                ForEach(DemoData.workouts) { WorkoutCard(workout: $0, isToday: $0.day == "Çarşamba") }
            }
        case .vucut:
            DetailPage(title: "Vücut analizi", lead: "13 Kasım 2026 ölçümü.") { LedgerCard(rows: DemoData.body) }
        case .gorunum:
            DetailPage(title: "Görünüm", lead: "Açık ya da koyu tema. Sistemle aynı seçiliyken telefonun ayarını izler.") {
                ChoiceCard(options: [("", "Sistemle aynı"), ("light", "Açık"), ("dark", "Koyu")], selection: $theme)
            }
        default:
            DetailPage(title: rows.first { $0.0 == p }?.2 ?? "", lead: "Bu ekran henüz çizilmedi.") { EmptyView() }
        }
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
        // Önce yağ veriliyor (plan.js: 13 Kasım'da 83,9 kg), hedef sonra kasla 85 kg.
        let kg: [(Int, Int, Double)] = [(9, 14, 86.4), (9, 21, 86.0), (9, 28, 85.7), (10, 5, 85.5), (10, 12, 85.0), (10, 19, 85.1), (10, 26, 84.6), (11, 2, 84.4), (11, 9, 84.1), (11, 13, 83.9)]
        return kg.map { WeightEntry(date: Calendar.current.date(from: DateComponents(year: 2026, month: $0.0, day: $0.1))!, kg: $0.2) }
    }()
    static let top: [TopFoodsCard.Item] = [
        .init(id: "yogurt", name: "Yoğurt", icon: "yogurt", count: 41), .init(id: "ekmek", name: "Tam buğday ekmeği", icon: "tam-bugday-ekmegi", count: 38),
        .init(id: "yumurta", name: "Yumurta", icon: "haslanmis-yumurta", count: 27), .init(id: "salata", name: "Salata", icon: "yesil-salata", count: 26),
        .init(id: "peynir", name: "Peynir", icon: "beyaz-peynir", count: 24), .init(id: "kofte", name: "Izgara köfte", icon: "izgara-kofte", count: 11),
        .init(id: "tavuk", name: "Tavuk", icon: "izgara-tavuk-gogsu", count: 9), .init(id: "balik", name: "Balık", icon: "levrek-izgara", count: 8),
    ]
    static let chat: [ChatMessage] = [
        ChatMessage(role: .user, text: "İkindide galeta yerine ne yiyebilirim?"),
        ChatMessage(role: .assistant, text: "Programda galetanın iki muadili var; ikisi de aynı değişim, **yaklaşık 100 kcal**.\n- Antrenman günü olduğu için karbonhidratı atlamamak iyi olur.\n- Protein bar seçeneği de programda var ama o zaman meyveyi de bırakırsın.",
                    foods: [t("c1", "Leblebi", "½ çay bardağı", "leblebi"), t("c2", "Pirinç patlağı", "2 adet", "pirinc-patlagi"), t("c3", "Protein bar", "1 adet", "protein-bar", caption: "meyve yerine de")]),
        ChatMessage(role: .user, text: "Akşam öğününü 19:30'a al"),
        ChatMessage(role: .assistant, text: "Akşam öğününü hafta içi 19:30'a alabilirim. Gece öğünü 21:00'de kalır.",
                    action: ChatAction(lines: ["Akşam, hafta içi: 20:00 → 19:30"])),
    ]
    static let chats: [ChatSummary] = [
        .init(id: "c1", title: "Galeta yerine ne olur", group: "Bugün", count: 4), .init(id: "c2", title: "Dışarıda akşam yemeği", group: "Dün", count: 6),
        .init(id: "c3", title: "Kreatin ne zaman alınır", group: "Bu hafta", count: 2), .init(id: "c4", title: "Yulaf yerine ne olur", group: "Bu hafta", count: 8),
        .init(id: "c5", title: "Hafta sonu saatleri", group: "Daha eski", count: 3),
    ]
    static let planMeals: [PlanMealsCard.Meal] = {
        let side = [t("y", "Yoğurt", "3-4 yk", "yogurt"), t("e", "Ekmek", "2 dilim", "tam-bugday-ekmegi"), t("s", "Salata", "1 porsiyon", "yesil-salata")]
        return [
            .init(id: "uyaninca", title: "Uyanınca", time: "", plates: [t("su", "Ilık limonlu su", "2 bardak", "limonlu-su")], note: "2 bardak ılık limonlu su"),
            .init(id: "kahvalti", title: "Kahvaltı", time: "11:00", plates: meals[0].items.map { var x = $0; x.state = .pending; return x }),
            .init(id: "ogle", title: "Öğle", time: "14:00", plates: side, note: "+ günün ana yemeği"),
            .init(id: "ikindi", title: "İkindi", time: "16:00", plates: meals[2].items + [t("bar", "Protein bar", "1 adet", "protein-bar")], note: "ya da protein bar"),
            .init(id: "aksam", title: "Akşam", time: "20:00", plates: side, note: "+ günün ana yemeği"),
            .init(id: "gece", title: "Gece", time: "21:00", plates: meals[4].items),
        ]
    }()
    static let rules: [ProseCard.Row] = [
        .init(title: "Çay açık ve şekersiz", note: "Yemekten en az 40 dk sonra; demir emilimini bozmasın diye"),
        .init(title: "Kahve günde en fazla 2 fincan", note: "Sade; her fincanla birlikte 2 bardak su"),
        .init(title: "Ara öğün atlama"), .init(title: "Ekmekleri eksik yeme"),
        .init(title: "Bir öğün sebze, diğer öğün et ya da kurubaklagil", note: "Öğle ve akşam haftada en çok 2 gün yer değiştirebilir"),
        .init(title: "Her gün tartılma"), .init(title: "Günde 2-2,5 litre su"),
        .init(title: "Haftada 3 gün 45 dk yürüyüş", note: "veya 5K / 3 mil Leslie"), .init(title: "Yazanları ne eksik ne fazla ye"),
    ]
    static let swaps: [SwapGroupCard.Group] = [
        .init(base: t("s-ekmek", "Tam buğday ekmeği", "2 dilim, 50 g", "tam-bugday-ekmegi"), alts: [
            t("s1", "Yulaf ezmesi", "4 yk", "yulaf-ezmesi"), t("s2", "Bulgur pilavı", "6 yk", "bulgur-pilavi"), t("s3", "Tam buğday makarna", "6 yk", "tam-bugday-makarna"),
            t("s4", "Haşlanmış patates", "1 orta boy", "haslanmis-patates"), t("s5", "Tam buğday lavaş", "1 küçük", "lavas")]),
        .init(base: t("s-et", "Et, tavuk ya da balık", "30 g", "izgara-tavuk-gogsu"), alts: [
            t("e1", "Köfte", "1 adet", "izgara-kofte"), t("e2", "Yumurta", "1 adet", "haslanmis-yumurta"), t("e3", "Peynir", "1 dilim", "beyaz-peynir"), t("e4", "Lor", "2 yk", "lor")]),
        .init(base: t("s-yogurt", "Yoğurt", "3-4 yk", "yogurt"), alts: [t("y1", "Ayran", "1 bardak", "ayran"), t("y2", "Kefir", "1 çay bardağı", "kefir"), t("y3", "Cacık", "1 küçük kase", "cacik")]),
        .init(base: t("s-yag", "Sıvıyağ", "1 tatlı kaşığı", "zeytinyagi"), alts: [t("g1", "Zeytin", "5-6 adet", "zeytin"), t("g2", "Ceviz içi", "2 adet", "ceviz"), t("g3", "Badem ya da fındık", "6 adet", "badem")]),
        .init(base: t("s-meyve", "Meyve", "1 porsiyon", "elma"), alts: [
            t("m1", "Elma", "1 küçük", "elma"), t("m2", "Portakal", "1 adet", "portakal"), t("m3", "Mandalina", "2 adet", "mandalina"), t("m4", "Muz", "1 küçük", "muz"), t("m5", "Çilek", "10-12 adet", "cilek")]),
        .init(base: t("s-psut", "Protein süt", "1 bardak", "protein-sut"), alts: [t("p1", "Quark", "1 kutu", "quark"), t("p2", "Skyr", "200 g", "skyr"), t("p3", "Whey", "1 ölçü", "protein-shake")]),
    ]
    static let workouts: [WorkoutCard.Workout] = {
        func m(_ a: [(String, String)]) -> [LedgerCard.Row] { a.map { .init(title: $0.0, value: $0.1) } }
        return [
            .init(day: "Pazartesi", name: "Üst", pre: "İp 6 dk: 60 sn rahat tempo, 30 sn dinlenme, 4 tur", post: "10-15 dk Zone 2, bisiklet ya da %5-10 eğimli yürüyüş",
                  moves: m([("Bench", "3×5-8"), ("Ağırlıklı barfiks", "3×5-8"), ("OHP", "2×6-10"), ("Row", "3×8-10"), ("Peck Deck", "2×10-15"), ("Hammer Curl", "2×8-12"), ("Lateral Raise", "3×12-20")])),
            .init(day: "Çarşamba", name: "Alt", pre: "İp yok; istersen 2 dk çok rahat ısınma", post: "8-10 dk çok hafif bisiklet, koşu yok",
                  moves: m([("Zercher Squat", "3×5-8"), ("RDL", "3×6-10"), ("Bulgarian Split Squat", "2×8-12"), ("Leg Curl", "2×10-15"), ("Calf Raise", "3×12-20"), ("Boyun 4 yön", "1×15-20"), ("Ab Roller", "2×8-15")])),
            .init(day: "Cuma", name: "Full body", pre: "İp: 90 sn orta tempo, 60 sn dinlenme, 3 tur", post: "10-15 dk Zone 2, tercihen bisiklet; sert koşu ya da interval yok",
                  moves: m([("Barbell Squat", "3×5"), ("Paused Bench", "2×6-8"), ("Weighted Dips", "3×6-10"), ("Lat Pulldown", "3×8-12"), ("Leg Curl", "2×10-15"), ("Face Pull", "2×15-20"), ("Lateral Raise", "2×12-20")])),
        ]
    }()
    static let body: [LedgerCard.Row] = [("Kilo", "83,9 kg"), ("Boy", "188 cm"), ("BMI", "23,7"), ("Yağ", "%14,5, 12,2 kg"), ("Kas", "68,2 kg"), ("İç yağlanma", "3 (1-13)"),
        ("Bazal metabolizma", "2.093 kcal"), ("Metabolik yaş", "24"), ("Bel", "86 cm"), ("Fit puanı", "95 / 100")].map { .init(title: $0.0, value: $0.1) }
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
