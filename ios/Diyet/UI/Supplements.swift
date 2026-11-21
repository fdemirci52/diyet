import SwiftUI

// Takviyeler: kullanıcının kendi takviyeleri (programın parçası değil). Liste ekranı, form ve Bugün'deki satırlar.
// Ne zaman alınacağı dört türlü: bir öğünden sonra, yatarken, belirli saatte ya da saati önemsiz.

// MARK: - Model

struct Supplement: Identifiable, Equatable {
    enum When: Equatable {
        /// Saati önemsiz; Gün boyu bölümünde durur.
        case anytime
        /// Bir öğünden sonra; o öğünün kartının sonunda çıkar.
        case afterMeal(id: String, title: String)
        /// Yatarken; zaman çizelgesinin sonunda ayrı olay.
        case bedtime
        /// Belirli saatte; zaman çizelgesinde kendi saatinde.
        case time(hour: Int, minute: Int)

        var label: String {
            switch self {
            case .anytime: "Gün içinde"
            case .afterMeal(_, let t): "\(t) sonrası"
            case .bedtime: "Yatarken"
            case .time(let h, let m): String(format: "%02d:%02d", h, m)
            }
        }
    }
    var id: String
    var name: String
    var dose: String = ""
    var when: When = .anytime
    var detail: String { dose.isEmpty ? when.label : "\(dose), \(when.label.lowercased(with: Locale(identifier: "tr_TR")))" }
}

// MARK: - Bugün'deki satırlar

/// Tek takviye satırı: yuvarlak içinde hap, ad ve doz, sağda işaret. Öğün kartının sonunda ve Gün boyu'nda kullanılır.
struct SupplementRow: View {
    var supplement: Supplement
    var taken: Bool
    var showsWhen = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Space.x3) {
                Image(systemName: "pills").font(.system(size: 17, weight: .medium)).foregroundStyle(taken ? Theme.Palette.muted : Theme.Palette.fg)
                    .frame(width: 44, height: 44).background(Theme.Palette.ctl, in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text(supplement.name).font(Theme.Typo.bodyMedium).foregroundStyle(taken ? Theme.Palette.muted : Theme.Palette.fg).lineLimit(1)
                    let sub = showsWhen ? supplement.detail : supplement.dose
                    if !sub.isEmpty { Text(sub).font(Theme.Typo.caption).monospacedDigit().foregroundStyle(Theme.Palette.muted).lineLimit(1) }
                }
                Spacer(minLength: Theme.Space.x2)
                if taken { MarkShape().stroke(Theme.Palette.muted, style: StrokeStyle(lineWidth: 1.75, lineCap: .round, lineJoin: .round)).frame(width: 24, height: 24) }
                else { Circle().strokeBorder(Theme.Palette.faint, lineWidth: 1.5).frame(width: 24, height: 24) }
            }
            .frame(minHeight: 56).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: taken)
        .accessibilityLabel("\(supplement.name), \(supplement.dose)").accessibilityValue(taken ? "alındı" : "alınmadı")
    }
}

/// Öğün kartının sonundaki takviyeler: sofradan ince bir çizgiyle ayrılır.
struct MealSupplements: View {
    var items: [Supplement]
    var taken: Set<String>
    var onToggle: (String) -> Void

    var body: some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                Rectangle().fill(Theme.Palette.track).frame(height: 1)
                Text("Yemekten sonra").font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted).padding(.top, Theme.Space.x3)
                ForEach(items) { s in SupplementRow(supplement: s, taken: taken.contains(s.id)) { onToggle(s.id) } }
            }
            .padding(.horizontal, Theme.Space.x1).padding(.bottom, Theme.Space.x3)
        }
    }
}

/// Zaman çizelgesinde ayrı olay: "Yatarken" ya da belirli saatli takviyeler tek kartta.
struct SupplementEventCard: View {
    var title: String
    var time: String = ""
    var items: [Supplement]
    var taken: Set<String>
    var onToggle: (String) -> Void

    private var allTaken: Bool { items.allSatisfy { taken.contains($0.id) } }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x1) {
            HStack(alignment: .firstTextBaseline, spacing: Theme.Space.x2) {
                Text(title).font(Theme.Typo.bodyStrong).foregroundStyle(allTaken ? Theme.Palette.muted : Theme.Palette.fg)
                if !time.isEmpty { Text(time).font(Theme.Typo.secondary).monospacedDigit().foregroundStyle(Theme.Palette.muted) }
            }
            VStack(spacing: 0) {
                ForEach(items) { s in SupplementRow(supplement: s, taken: taken.contains(s.id)) { onToggle(s.id) } }
            }
        }
        .padding(.horizontal, Theme.Space.card).padding(.top, Theme.Space.card).padding(.bottom, Theme.Space.x2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .sofraCard()
    }
}

// MARK: - Takviyeler ekranı

/// Takviyeler: liste ve "Takviye ekle". Satıra dokununca form açılır.
struct SupplementsScreen: View {
    var supplements: [Supplement]
    /// Öğünden sonra seçeneği için saatli öğünler: (kimlik, ad).
    var meals: [(id: String, title: String)]
    var onSave: (Supplement) -> Void
    var onDelete: (String) -> Void

    @State private var editing: Supplement?

    var body: some View {
        DetailPage(title: "Takviyeler", lead: "Kendi takviyelerin; programın parçası değil. Ne zaman alacağını seçersen Bugün'de o anda karşına çıkar.") {
            if supplements.isEmpty {
                Text("Henüz takviye eklemedin.").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted).padding(.horizontal, Theme.Space.x1)
            } else {
                RowsCard {
                    ForEach(supplements) { s in
                        Button { editing = s } label: { NavRow(symbol: "pills", title: s.name, subtitle: s.detail) }.buttonStyle(.plain)
                    }
                }
            }
            Button { editing = Supplement(id: "", name: "") } label: { Label("Takviye ekle", systemImage: "plus").font(Theme.Typo.bodyStrong) }
                .buttonStyle(PrimaryButton(quiet: true)).padding(.top, Theme.Space.x2)
            Text("Doz ve kullanım için hekimine ya da diyetisyenine danış; uygulama yalnızca hatırlatır.").font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
                .padding(.horizontal, Theme.Space.x1).padding(.top, Theme.Space.x2)
        }
        .sheet(item: $editing) { s in
            SupplementFormSheet(supplement: s, meals: meals, onSave: { onSave($0); editing = nil }, onDelete: s.id.isEmpty ? nil : { onDelete(s.id); editing = nil })
        }
    }
}

// MARK: - Form

struct SupplementFormSheet: View {
    var supplement: Supplement
    var meals: [(id: String, title: String)]
    var onSave: (Supplement) -> Void
    var onDelete: (() -> Void)?

    private enum Kind: String { case anytime, meal, bedtime, time }
    @State private var name = ""
    @State private var dose = ""
    @State private var kind: Kind = .anytime
    @State private var mealID = ""
    @State private var clock = Calendar.current.date(from: DateComponents(hour: 9, minute: 0)) ?? .now
    private var valid: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text(supplement.id.isEmpty ? "Takviye ekle" : "Takviye").font(Theme.Typo.heading).foregroundStyle(Theme.Palette.fg)
                    .padding(.horizontal, Theme.Space.x1).padding(.top, Theme.Space.x6).padding(.bottom, Theme.Space.x4)
                VStack(spacing: 0) {
                    field("Ad", $name, "Örn. Kreatin")
                    Rectangle().fill(Theme.Palette.track).frame(height: 1)
                    field("Doz", $dose, "5 g")
                }
                .padding(.horizontal, Theme.Space.card)
                .background(Theme.Palette.ctl, in: RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))

                SectionTitle("Ne zaman")
                VStack(spacing: 0) {
                    choice("Gün içinde, saati önemsiz", kind == .anytime) { kind = .anytime }
                    ForEach(meals, id: \.id) { m in
                        choice("\(m.title) sonrası", kind == .meal && mealID == m.id) { kind = .meal; mealID = m.id }
                    }
                    choice("Yatarken", kind == .bedtime) { kind = .bedtime }
                    choice("Belirli saatte", kind == .time) { kind = .time }
                    if kind == .time {
                        DatePicker("Saat", selection: $clock, displayedComponents: .hourAndMinute)
                            .font(Theme.Typo.body).foregroundStyle(Theme.Palette.muted).environment(\.locale, Locale(identifier: "tr_TR"))
                            .frame(minHeight: 52)
                    }
                }
                .padding(.horizontal, Theme.Space.card).padding(.vertical, Theme.Space.x1)
                .background(Theme.Palette.ctl, in: RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
                .sensoryFeedback(.selection, trigger: kind.rawValue + mealID)
            }
            .padding(.horizontal, Theme.Space.page).padding(.bottom, Theme.Space.x8)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom) {
            HStack(spacing: Theme.Space.x2) {
                Button("Kaydet") { onSave(result) }.buttonStyle(PrimaryButton(quiet: !valid)).disabled(!valid)
                if let onDelete {
                    Button("Sil", role: .destructive, action: onDelete).font(Theme.Typo.body).foregroundStyle(Theme.Palette.danger)
                        .padding(.horizontal, Theme.Space.x4).frame(minHeight: Theme.Size.button)
                }
            }
            .padding(.horizontal, Theme.Space.x4).padding(.top, Theme.Space.x3).padding(.bottom, Theme.Space.x2)
            .background(Theme.Palette.sheet)
        }
        .background(Theme.Palette.sheet)
        .onAppear(perform: load)
        .presentationDetents([.large]).presentationDragIndicator(.visible).presentationCornerRadius(Theme.Radius.panel)
    }

    private var result: Supplement {
        var s = supplement
        s.name = name.trimmingCharacters(in: .whitespaces); s.dose = dose.trimmingCharacters(in: .whitespaces)
        if s.id.isEmpty { s.id = "s-" + FoodEntry.slug(s.name) + "-\(Int(Date.now.timeIntervalSince1970) % 100000)" }
        switch kind {
        case .anytime: s.when = .anytime
        case .bedtime: s.when = .bedtime
        case .meal: s.when = .afterMeal(id: mealID, title: meals.first { $0.id == mealID }?.title ?? "")
        case .time:
            let c = Calendar.current.dateComponents([.hour, .minute], from: clock)
            s.when = .time(hour: c.hour ?? 9, minute: c.minute ?? 0)
        }
        return s
    }
    private func load() {
        name = supplement.name; dose = supplement.dose
        switch supplement.when {
        case .anytime: kind = .anytime
        case .bedtime: kind = .bedtime
        case .afterMeal(let id, _): kind = .meal; mealID = id
        case .time(let h, let m): kind = .time; clock = Calendar.current.date(from: DateComponents(hour: h, minute: m)) ?? clock
        }
    }
    private func field(_ label: String, _ text: Binding<String>, _ prompt: String) -> some View {
        HStack(spacing: Theme.Space.x2) {
            Text(label).font(Theme.Typo.body).foregroundStyle(Theme.Palette.muted).frame(width: 88, alignment: .leading)
            TextField(prompt, text: text).font(Theme.Typo.bodyMedium).foregroundStyle(Theme.Palette.fg).multilineTextAlignment(.trailing)
        }
        .frame(minHeight: 52)
    }
    private func choice(_ title: String, _ on: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(title).font(Theme.Typo.body).foregroundStyle(Theme.Palette.fg)
                Spacer()
                if on { MarkShape().stroke(Theme.Palette.fg, style: StrokeStyle(lineWidth: 1.75, lineCap: .round, lineJoin: .round)).frame(width: 24, height: 24) }
            }
            .frame(minHeight: 48).contentShape(Rectangle())
        }
        .buttonStyle(.plain).accessibilityAddTraits(on ? .isSelected : [])
    }
}
