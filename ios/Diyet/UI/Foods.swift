import SwiftUI

// Gıda seçilen her yerin parçaları: üç sütunlu tabaklı ızgara, arama alanı, Gıdalarım ekranı,
// gıda formu ve öğüne hızlı kayıt sayfası. Sıra her yerde aynı: önce kendi ürünlerin, sonra kütüphane.

// MARK: - Model

struct FoodEntry: Identifiable, Equatable {
    var id: String
    var name: String
    /// Bir porsiyonun tarifi: "1 adet", "1 porsiyon, lavaşla".
    var unit: String
    /// Bir porsiyon için.
    var kcal: Int
    var protein: Double
    var icon: String?
    /// Kullanıcının kendi girdiği ürün.
    var own = false

    /// foods.js'teki kuralla addan ikon kimliği: küçük harf, Türkçe harfler sadeleşir, boşluklar tire.
    static func slug(_ name: String) -> String {
        let map: [Character: String] = ["ı": "i", "ş": "s", "ğ": "g", "ü": "u", "ö": "o", "ç": "c", "â": "a", "î": "i", "û": "u"]
        var out = ""
        for ch in name.lowercased(with: Locale(identifier: "tr_TR")) {
            if let m = map[ch] { out += m }
            else if ch.isASCII && (ch.isLetter || ch.isNumber) { out.append(ch) }
            else if !out.hasSuffix("-") { out += "-" }
        }
        return out.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }
    /// Arama için sadeleşmiş ad.
    var folded: String { Self.slug(name) }

    static func values(_ kcal: Double, _ protein: Double) -> String {
        "\(Int(kcal.rounded())) kcal · \(protein.formatted(.number.precision(.fractionLength(0...1)).locale(Locale(identifier: "tr_TR")))) g"
    }
}

// MARK: - Kart ve ızgara

/// Gıda kartı: tabakta ikon, ad, altında porsiyon, altında `kcal · g`. Seçiliyse tabağın çevresinde halka ve porsiyon rozeti.
struct FoodCard: View {
    var food: FoodEntry
    /// Seçili porsiyon; nil seçili değil.
    var portion: Double? = nil
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 0) {
                PlateView(icon: food.icon, size: 72)
                    .padding(4).overlay(Circle().strokeBorder(Theme.Palette.fg, lineWidth: 1.5).opacity(portion == nil ? 0 : 1))
                    .overlay(alignment: .topTrailing) {
                        if let q = portion { AmountPill(text: PortionStepper.text(q), filled: true).offset(x: 6, y: -2) }
                    }
                Text(food.name).font(Theme.Typo.captionMedium).foregroundStyle(Theme.Palette.fg).multilineTextAlignment(.center)
                    .lineLimit(2).padding(.top, Theme.Space.x2).padding(.bottom, 2)
                Text(food.unit).font(Theme.Typo.label).foregroundStyle(Theme.Palette.muted).lineLimit(1)
                Text(FoodEntry.values(Double(food.kcal), food.protein)).font(Theme.Typo.label).monospacedDigit().foregroundStyle(Theme.Palette.muted).lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.Space.x2)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressScale(0.96))
        .accessibilityLabel("\(food.name), \(food.unit), \(food.kcal) kalori")
        .accessibilityAddTraits(portion == nil ? [] : .isSelected)
    }
}

/// Üç sütunlu gıda ızgarası.
struct FoodGrid: View {
    var foods: [FoodEntry]
    var portions: [String: Double] = [:]
    var onPick: (FoodEntry) -> Void

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(minimum: 0), spacing: Theme.Space.x1, alignment: .top), count: 3), spacing: Theme.Space.x2) {
            ForEach(foods) { f in FoodCard(food: f, portion: portions[f.id]) { onPick(f) } }
        }
        .padding(.horizontal, Theme.Space.x2).padding(.vertical, Theme.Space.x2)
        .sofraCard()
    }
}

/// Arama alanı: büyüteç, yazı, temizle.
struct SearchField: View {
    var prompt: String
    @Binding var text: String
    var body: some View {
        HStack(spacing: Theme.Space.x2) {
            Image(systemName: "magnifyingglass").font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.Palette.muted)
            TextField(prompt, text: $text).font(Theme.Typo.body).foregroundStyle(Theme.Palette.fg)
                .autocorrectionDisabled().textInputAutocapitalization(.never).submitLabel(.search)
            if !text.isEmpty {
                Button { text = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.Palette.faint).frame(width: 32, height: 32) }
                    .buttonStyle(.plain).accessibilityLabel("Temizle")
            }
        }
        .padding(.leading, Theme.Space.x4).padding(.trailing, Theme.Space.x2).frame(minHeight: Theme.Size.button)
        .background(Theme.Palette.card, in: RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous).strokeBorder(Theme.Palette.track, lineWidth: 1))
    }
}

/// Porsiyon adımı: ¼'ten 3'e, çeyrek adımla.
struct PortionStepper: View {
    @Binding var value: Double
    static func text(_ q: Double) -> String {
        let w = Int(q), f = q - Double(w)
        let frac = f == 0.25 ? "¼" : f == 0.5 ? "½" : f == 0.75 ? "¾" : ""
        return w == 0 ? frac : "\(w)\(frac)"
    }
    var body: some View {
        HStack(spacing: 0) {
            Button { value = max(0.25, value - 0.25) } label: { Image(systemName: "minus").frame(width: 40, height: 40) }.disabled(value <= 0.25)
            Text(Self.text(value)).font(Theme.Typo.bodyStrong).monospacedDigit().foregroundStyle(Theme.Palette.fg).frame(minWidth: 32)
            Button { value = min(3, value + 0.25) } label: { Image(systemName: "plus").frame(width: 40, height: 40) }.disabled(value >= 3)
        }
        .font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.Palette.fg)
        .buttonStyle(PressScale(0.9))
        .padding(2).background(Theme.Palette.ctl, in: Capsule())
        .sensoryFeedback(.selection, trigger: value)
        .accessibilityElement(children: .contain).accessibilityLabel("Porsiyon \(Self.text(value))")
    }
}

/// Aramayı kendi ürünlerine ve kütüphaneye uygular; kendi ürünlerin önde.
enum FoodSearch {
    static func filter(_ foods: [FoodEntry], _ query: String) -> [FoodEntry] {
        let q = FoodEntry.slug(query)
        let hit = q.isEmpty ? foods : foods.filter { $0.folded.contains(q) }
        return hit.filter(\.own) + hit.filter { !$0.own }
    }
}

// MARK: - Gıdalarım

/// Gıdalarım: arama, kendi ürünlerin ve kütüphane. Karta dokununca form açılır.
struct FoodsScreen: View {
    var foods: [FoodEntry]
    var onSave: (FoodEntry) -> Void
    var onDelete: (String) -> Void

    @State private var query = ""
    @State private var editing: FoodEntry?
    private var shown: [FoodEntry] { FoodSearch.filter(foods, query) }

    var body: some View {
        DetailPage(title: "Gıdalarım", lead: "Kendi ürünlerin aramada kütüphanenin önüne geçer. Değerler bir porsiyon içindir.") {
            SearchField(prompt: "Gıda ara", text: $query)
            Button { editing = FoodEntry(id: "", name: query, unit: "1 porsiyon", kcal: 0, protein: 0, own: true) } label: {
                Label("Yeni gıda ekle", systemImage: "plus").font(Theme.Typo.bodyStrong)
            }
            .buttonStyle(PrimaryButton(quiet: true))
            let own = shown.filter(\.own), lib = shown.filter { !$0.own }
            if !own.isEmpty { SectionTitle("Kendi ürünlerin"); FoodGrid(foods: own) { editing = $0 } }
            if !lib.isEmpty { SectionTitle("Kütüphane"); FoodGrid(foods: lib) { editing = $0 } }
            if shown.isEmpty {
                Text("“\(query)” bulunamadı. Yeni gıda olarak ekleyebilirsin.").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                    .padding(.horizontal, Theme.Space.x1).padding(.top, Theme.Space.x2)
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .sheet(item: $editing) { f in
            FoodFormSheet(food: f, onSave: { onSave($0); editing = nil }, onDelete: f.own && !f.id.isEmpty ? { onDelete(f.id); editing = nil } : nil)
        }
    }
}

// MARK: - Gıda formu

/// Gıda formu: tabak, ad, porsiyon, kalori, protein. Yeni gıdada fotoğraf ya da adla yapay zekâ doldurabilir.
struct FoodFormSheet: View {
    var food: FoodEntry
    var onSave: (FoodEntry) -> Void
    var onDelete: (() -> Void)?
    var onAI: (() -> Void)? = nil

    @State private var name = ""
    @State private var unit = ""
    @State private var kcal = ""
    @State private var protein = ""
    private var valid: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty && Int(kcal) != nil }
    private var isNew: Bool { food.id.isEmpty }

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Space.x4) {
                PlateView(icon: food.icon ?? FoodEntry.slug(name), size: Theme.Size.plateHero).padding(.top, Theme.Space.x6)
                Text(isNew ? "Yeni gıda" : food.own ? "Kendi ürünün" : "Kütüphaneden").font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
                VStack(spacing: 0) {
                    field("Ad", $name, "Örn. Yulaflı kurabiye")
                    divider
                    field("Porsiyon", $unit, "1 adet")
                    divider
                    field("Kalori", $kcal, "0", unit: "kcal", pad: .numberPad)
                    divider
                    field("Protein", $protein, "0", unit: "g", pad: .decimalPad)
                }
                .padding(.horizontal, Theme.Space.card)
                .background(Theme.Palette.ctl, in: RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
                if isNew, let onAI {
                    Button(action: onAI) { Label("Fotoğraftan ya da addan doldur", systemImage: "camera").font(Theme.Typo.bodyStrong) }
                        .buttonStyle(PrimaryButton(quiet: true))
                }
                if !food.own && !isNew {
                    Text("Kaydedince kendi ürünlerine kopyalanır; kütüphanedeki değer değişmez.").font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, Theme.Space.x1)
                }
            }
            .padding(.horizontal, Theme.Space.page).padding(.bottom, Theme.Space.x8)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom) {
            HStack(spacing: Theme.Space.x2) {
                Button("Kaydet") {
                    var f = food
                    f.name = name.trimmingCharacters(in: .whitespaces); f.unit = unit.isEmpty ? "1 porsiyon" : unit
                    f.kcal = Int(kcal) ?? 0; f.protein = Double(protein.replacingOccurrences(of: ",", with: ".")) ?? 0
                    f.own = true
                    if f.id.isEmpty || !food.own { f.id = "own-" + FoodEntry.slug(f.name) }
                    if f.icon == nil { f.icon = FoodEntry.slug(f.name) }
                    onSave(f)
                }
                .buttonStyle(PrimaryButton(quiet: !valid)).disabled(!valid)
                if let onDelete {
                    Button("Sil", role: .destructive, action: onDelete).font(Theme.Typo.body).foregroundStyle(Theme.Palette.danger)
                        .padding(.horizontal, Theme.Space.x4).frame(minHeight: Theme.Size.button)
                }
            }
            .padding(.horizontal, Theme.Space.x4).padding(.top, Theme.Space.x3).padding(.bottom, Theme.Space.x2)
            .background(Theme.Palette.sheet)
        }
        .background(Theme.Palette.sheet)
        .onAppear {
            name = food.name; unit = food.unit
            kcal = food.kcal > 0 ? "\(food.kcal)" : ""
            protein = food.protein > 0 ? food.protein.formatted(.number.precision(.fractionLength(0...1)).locale(Locale(identifier: "tr_TR"))) : ""
        }
        .presentationDetents([.large]).presentationDragIndicator(.visible).presentationCornerRadius(Theme.Radius.panel)
    }

    private var divider: some View { Rectangle().fill(Theme.Palette.track).frame(height: 1) }
    private func field(_ label: String, _ text: Binding<String>, _ prompt: String, unit: String = "", pad: UIKeyboardType = .default) -> some View {
        HStack(spacing: Theme.Space.x2) {
            Text(label).font(Theme.Typo.body).foregroundStyle(Theme.Palette.muted).frame(width: 88, alignment: .leading)
            TextField(prompt, text: text).keyboardType(pad).font(Theme.Typo.bodyMedium).foregroundStyle(Theme.Palette.fg).multilineTextAlignment(.trailing)
            if !unit.isEmpty { Text(unit).font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted) }
        }
        .frame(minHeight: 52)
    }
}

// MARK: - Hızlı kayıt

/// Öğüne plan dışı kayıt: ara, karta dokunarak seç, seçilenlerin porsiyonunu ayarla, tek düğmeyle kaydet.
/// Aramada bir şey çıkmazsa yapay zekâ satırı görünür. Saati uzak öğünde ana düğme "Planla" olur.
struct QuickAddSheet: View {
    struct Pick: Identifiable, Equatable { var food: FoodEntry; var portion: Double; var id: String { food.id } }
    var mealTitle: String
    var foods: [FoodEntry]
    var planning = false
    var onSave: ([Pick]) -> Void
    var onAI: (String) -> Void = { _ in }
    var onNew: (String) -> Void = { _ in }

    @State private var query = ""
    @State private var picks: [Pick] = []
    private var shown: [FoodEntry] { FoodSearch.filter(foods, query) }
    private var total: (Double, Double) { picks.reduce((0, 0)) { ($0.0 + Double($1.food.kcal) * $1.portion, $0.1 + $1.food.protein * $1.portion) } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.x2) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(mealTitle).font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                    Text(planning ? "Önceden planla" : "Ne yedin?").font(Theme.Typo.heading).foregroundStyle(Theme.Palette.fg)
                }
                .padding(.horizontal, Theme.Space.x1).padding(.top, Theme.Space.x6).padding(.bottom, Theme.Space.x2)
                SearchField(prompt: "Yemek ya da içecek ara", text: $query)

                if !picks.isEmpty {
                    VStack(spacing: 0) {
                        ForEach($picks) { $p in
                            HStack(spacing: Theme.Space.x3) {
                                PlateView(icon: p.food.icon, size: Theme.Size.plateRow)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(p.food.name).font(Theme.Typo.bodyMedium).foregroundStyle(Theme.Palette.fg).lineLimit(1)
                                    Text(FoodEntry.values(Double(p.food.kcal) * p.portion, p.food.protein * p.portion)).font(Theme.Typo.caption).monospacedDigit().foregroundStyle(Theme.Palette.muted)
                                        .contentTransition(.numericText())
                                }
                                Spacer(minLength: Theme.Space.x2)
                                PortionStepper(value: $p.portion)
                            }
                            .frame(minHeight: 64)
                        }
                    }
                    .padding(.horizontal, Theme.Space.x3).padding(.vertical, Theme.Space.x1)
                    .background(Theme.Palette.ctl, in: RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
                }

                if !shown.isEmpty {
                    FoodGrid(foods: shown, portions: Dictionary(uniqueKeysWithValues: picks.map { ($0.id, $0.portion) })) { toggle($0) }
                }
                if !query.trimmingCharacters(in: .whitespaces).isEmpty {
                    VStack(spacing: 0) {
                        Button { onAI(query) } label: { NavRow(symbol: "sparkle.magnifyingglass", title: "Yapay zekâyla işle", subtitle: "“\(query)” yazdığın gibi çözülür") }.buttonStyle(.plain)
                        Button { onNew(query) } label: { NavRow(symbol: "plus", title: "Yeni gıda ekle", subtitle: "Değerlerini kendin gir") }.buttonStyle(.plain)
                    }
                    .padding(.horizontal, Theme.Space.card).padding(.vertical, Theme.Space.x1)
                    .background(Theme.Palette.ctl, in: RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
                }
            }
            .padding(.horizontal, Theme.Space.page).padding(.bottom, Theme.Space.x8)
            .animation(Theme.Motion.settle, value: picks.map(\.id))
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: Theme.Space.x2) {
                if !picks.isEmpty {
                    Text("\(picks.count) kalem, \(FoodEntry.values(total.0, total.1)) protein").font(Theme.Typo.caption).monospacedDigit().foregroundStyle(Theme.Palette.muted)
                        .contentTransition(.numericText())
                }
                Button(planning ? "Planla" : "Kaydet") { onSave(picks) }
                    .buttonStyle(PrimaryButton(quiet: picks.isEmpty)).disabled(picks.isEmpty)
            }
            .padding(.horizontal, Theme.Space.x4).padding(.top, Theme.Space.x3).padding(.bottom, Theme.Space.x2)
            .background(Theme.Palette.sheet)
        }
        .background(Theme.Palette.sheet)
        .presentationDetents([.large]).presentationDragIndicator(.visible).presentationCornerRadius(Theme.Radius.panel)
    }

    private func toggle(_ f: FoodEntry) {
        if let i = picks.firstIndex(where: { $0.id == f.id }) { picks.remove(at: i) } else { picks.append(Pick(food: f, portion: 1)) }
    }
}
