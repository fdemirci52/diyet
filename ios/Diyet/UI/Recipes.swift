import SwiftUI
import DiyetKit

// Tarifler sekmesi: tarif bir tezgâhtır. Tasarım: "Ben ve Tarifler" tuvali, 1 · Tezgâh ve Pişirirken (21 Kasım 2026 kararı).
// Tarifler diyetisyenin programından gelir (plan.recipes); programdaki ana yemeklerle adından eşleşir.

// MARK: - Malzeme ikonu

/// Malzeme adından gıda ikonu: yalnızca birebir karşılığı olanlar; yoksa tabakta baş harf durur.
enum IngredientIcon {
    static let alias: [String: String] = [
        "zeytinyagi": "zeytinyagi", "sivi yag": "zeytinyagi", "ton baligi": "ton-baligi", "yumurta": "haslanmis-yumurta", "yogurt": "yogurt",
        "ceviz": "ceviz", "badem": "badem", "findik": "findik", "bulgur": "bulgur-pilavi", "keten tohumu": "keten-tohumu", "sut": "sut",
        "lor": "lor", "beyaz peynir": "beyaz-peynir", "peynir": "beyaz-peynir", "zeytin": "zeytin", "leblebi": "leblebi", "kivi": "kivi",
        "elma": "elma", "muz": "muz", "portakal": "portakal", "mandalina": "mandalina", "cilek": "cilek", "avokado": "avokado", "kabak cekirdegi": "kabak-cekirdegi",
        "yulaf": "yulaf-ezmesi", "levrek": "levrek-izgara", "somon": "somon", "kefir": "kefir", "ayran": "ayran", "tereyagi": "tereyagi",
    ]
    static func id(_ name: String) -> String? {
        let f = TR.fold(name)
        if let x = alias[f] { return x }
        return alias.first { f.hasPrefix($0.key + " ") || f.hasSuffix(" " + $0.key) }?.value
    }
}

/// Malzeme tabağı: ikon varsa ikon, yoksa baş harf. Hazırlanınca boşalır (Sofra'daki "yedim" dili).
struct IngredientPlate: View {
    var name: String
    var used = false
    var size: CGFloat = Theme.Size.plate
    var body: some View {
        let icon = IngredientIcon.id(name)
        ZStack {
            PlateView(icon: icon, state: used ? .eaten : .pending, size: size, glyph: false)
            if icon == nil {
                Text(String(name.prefix(1))).font(.system(size: size * 0.28, weight: .semibold)).foregroundStyle(Theme.Palette.muted)
                    .scaleEffect(used ? 0.4 : 1).opacity(used ? 0 : 1).animation(Theme.Motion.eat, value: used).accessibilityHidden(true)
            }
        }
    }
}

// MARK: - Liste

struct RecipeCardModel: Identifiable, Equatable {
    var recipe: Recipe
    /// Programdaki ikonu (ana yemeğin ikonu) varsa.
    var icon: String?
    /// "Pzt, Cmt" ya da "Kurubaklagil yerine".
    var note: String
    var id: String { recipe.id }
}

struct RecipeTodayModel: Identifiable, Equatable {
    var recipe: Recipe
    var icon: String?
    /// "Öğle, 14.00".
    var when: String
    var now: Bool
    var id: String { recipe.id + when }
}

struct RecipesScreen: View {
    var today: [RecipeTodayModel]
    var week: [RecipeCardModel]
    var others: [RecipeCardModel]
    var dayName: String
    var onOpen: (Recipe) -> Void
    @State private var query = ""

    private var all: [RecipeCardModel] { week + others }
    private var found: [RecipeCardModel] {
        let q = TR.fold(query); guard !q.isEmpty else { return [] }
        return all.filter { TR.fold($0.recipe.name).contains(q) || $0.recipe.ings.contains { TR.fold($0).contains(q) } }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(all.isEmpty ? "Henüz tarif yok" : "Diyetisyeninden \(all.count) tarif").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                    Text("Tarifler").font(Theme.Typo.title).foregroundStyle(Theme.Palette.fg)
                }
                .padding(.horizontal, Theme.Space.x1).padding(.bottom, Theme.Space.x4)

                if all.isEmpty {
                    WaitCard(text: "Diyetisyeninin tarif sayfalarını programla birlikte aktarınca burada, haftanın yemekleriyle birlikte görünür.")
                } else {
                    SearchField(prompt: "Tarif ya da malzeme ara", text: $query)
                    if !query.isEmpty {
                        SectionTitle(found.isEmpty ? "Bulunamadı" : "Sonuçlar")
                        grid(found)
                    } else {
                        if !today.isEmpty {
                            SectionTitle("Bugün, \(dayName)")
                            RowsCard {
                                ForEach(today) { r in
                                    Button { onOpen(r.recipe) } label: {
                                        HStack(spacing: Theme.Space.x3) {
                                            PlateView(icon: r.icon, size: 56)
                                            VStack(alignment: .leading, spacing: 0) {
                                                HStack(spacing: 6) {
                                                    if r.now { NowDot() }
                                                    Text(r.when).font(r.now ? Theme.Typo.captionMedium.weight(.semibold) : Theme.Typo.caption)
                                                        .foregroundStyle(r.now ? Theme.Palette.fg : Theme.Palette.muted)
                                                }
                                                Text(r.recipe.name).font(Theme.Typo.bodyMedium).foregroundStyle(Theme.Palette.fg)
                                            }
                                            Spacer()
                                            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Palette.faint)
                                        }
                                        .frame(minHeight: 72).contentShape(Rectangle())
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        if !week.isEmpty { SectionTitle("Bu hafta programında"); grid(week) }
                        if !others.isEmpty { SectionTitle("Diğer tarifler"); grid(others) }
                    }
                }
            }
            .padding(.horizontal, Theme.Space.page).padding(.top, Theme.Space.x2).padding(.bottom, Theme.Space.x8)
        }
        .scrollDismissesKeyboard(.immediately)
        .background(Theme.Palette.bg.ignoresSafeArea())
    }

    private func grid(_ list: [RecipeCardModel]) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: Theme.Space.x2), GridItem(.flexible(), spacing: Theme.Space.x2)], spacing: Theme.Space.x2) {
            ForEach(list) { r in
                Button { onOpen(r.recipe) } label: {
                    VStack(spacing: Theme.Space.x1) {
                        PlateView(icon: r.icon, size: 96).padding(.bottom, Theme.Space.x2)
                        Text(r.recipe.name).font(Theme.Typo.bodyMedium).foregroundStyle(Theme.Palette.fg).multilineTextAlignment(.center).lineLimit(2, reservesSpace: true)
                        Text(r.note).font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted).multilineTextAlignment(.center).lineLimit(2, reservesSpace: true)
                    }
                    .frame(maxWidth: .infinity).padding(.horizontal, Theme.Space.x3).padding(.top, Theme.Space.x5).padding(.bottom, Theme.Space.x4)
                    .sofraCard()
                }
                .buttonStyle(PressScale())
            }
        }
    }
}

// MARK: - Tezgâh

/// Tarifin tezgâhı: malzemeler tabaklarda, hazırlanan dokununca boşalır; adımlar işaretlenir.
struct RecipeScreen: View {
    var recipe: Recipe
    var icon: String?
    /// "Ana yemek, bu hafta Pazartesi öğle ve Cumartesi akşam".
    var context: String
    /// Diyetisyenin tarife özel notu, varsa.
    var note: String = ""

    @State private var times: Double = 1
    @State private var used: Set<String> = []
    @State private var done: Set<Int> = []
    @State private var cooking = false
    @Environment(\.dismiss) private var dismiss

    private var timesText: String { "\(Recipe.frac(times)) tarif" }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(spacing: Theme.Space.x1) {
                    PlateView(icon: icon, size: 160).padding(.bottom, Theme.Space.x3)
                    Text(recipe.name).font(Theme.Typo.heading).foregroundStyle(Theme.Palette.fg).multilineTextAlignment(.center)
                    if !context.isEmpty { Text(context).font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted).multilineTextAlignment(.center) }
                }
                .frame(maxWidth: .infinity).padding(.horizontal, Theme.Space.x2).padding(.bottom, Theme.Space.x6)

                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Text("Ne kadar").font(Theme.Typo.bodyMedium).foregroundStyle(Theme.Palette.fg)
                        Spacer()
                        HStack(spacing: 0) {
                            Button { times = max(0.5, times - 0.5) } label: { Image(systemName: "minus").frame(width: 44, height: 44) }.disabled(times <= 0.5)
                            Text(timesText).font(Theme.Typo.bodyStrong).monospacedDigit().frame(minWidth: 96)
                            Button { times = min(4, times + 0.5) } label: { Image(systemName: "plus").frame(width: 44, height: 44) }.disabled(times >= 4)
                        }
                        .font(.system(size: 17, weight: .semibold)).foregroundStyle(Theme.Palette.fg)
                        .background(Theme.Palette.ctl, in: Capsule()).buttonStyle(PressScale(0.9))
                        .sensoryFeedback(.selection, trigger: times)
                    }
                    if !recipe.serve.isEmpty || recipe.k > 0 {
                        Text(["Bir öğün: \(recipe.serve)", recipe.k > 0 ? "yaklaşık \(TR.num(recipe.k)) kcal" : ""].filter { !$0.hasSuffix(": ") && !$0.isEmpty }.joined(separator: ", ") + ".")
                            .font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted).padding(.top, Theme.Space.x2)
                    }
                    if !note.isEmpty {
                        Divider().overlay(Theme.Palette.track).padding(.top, Theme.Space.x4)
                        HStack(alignment: .top, spacing: Theme.Space.x3) {
                            Image(systemName: "doc.text").font(.system(size: 17)).foregroundStyle(Theme.Palette.muted)
                            (Text("Diyetisyenin notu. ").fontWeight(.semibold).foregroundStyle(Theme.Palette.fg) + Text(note).foregroundStyle(Theme.Palette.muted)).font(Theme.Typo.secondary)
                        }
                        .padding(.top, Theme.Space.x4)
                    }
                }
                .padding(Theme.Space.card).sofraCard()

                if !recipe.ingredients.isEmpty {
                    SectionTitle("Malzemeler")
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: Theme.Space.x2), count: 3), spacing: Theme.Space.x5) {
                        ForEach(recipe.ingredients) { ing in
                            let on = used.contains(ing.id)
                            Button { withAnimation(Theme.Motion.settle) { if on { used.remove(ing.id) } else { used.insert(ing.id) } } } label: {
                                VStack(spacing: 6) {
                                    IngredientPlate(name: ing.name, used: on).padding(.bottom, 2)
                                    Text(ing.name).font(Theme.Typo.secondaryMedium).foregroundStyle(on ? Theme.Palette.muted : Theme.Palette.fg).multilineTextAlignment(.center).lineLimit(2)
                                    let a = ing.amount(times: times)
                                    if !a.isEmpty {
                                        Text(a).font(Theme.Typo.captionMedium).foregroundStyle(on ? Theme.Palette.muted : Theme.Palette.fg)
                                            .padding(.horizontal, 10).frame(height: Theme.Size.pill).background(Theme.Palette.ctl, in: Capsule())
                                    }
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(ing.name) \(ing.amount(times: times))").accessibilityAddTraits(on ? .isSelected : [])
                        }
                    }
                    .padding(.top, Theme.Space.x2)
                    Text("Hazırladığın malzemeye dokun, tabağı boşalır.").font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
                        .frame(maxWidth: .infinity).padding(.top, Theme.Space.x4)
                }

                if !recipe.stepList.isEmpty {
                    SectionTitle("Yapılışı")
                    VStack(spacing: 0) {
                        ForEach(Array(recipe.stepList.enumerated()), id: \.offset) { i, t in
                            let on = done.contains(i)
                            Button { withAnimation(Theme.Motion.quick) { if on { done.remove(i) } else { done.insert(i) } } } label: {
                                HStack(alignment: .top, spacing: Theme.Space.x3) {
                                    Text("\(i + 1)").font(Theme.Typo.captionMedium.weight(.semibold)).foregroundStyle(on ? Theme.Palette.muted : Theme.Palette.fg)
                                        .frame(width: 28, height: 28)
                                        .background(on ? Color.clear : Theme.Palette.ctl, in: Circle())
                                        .overlay(Circle().strokeBorder(on ? Theme.Palette.faint : .clear, lineWidth: 1.5))
                                    Text(t).font(Theme.Typo.body).foregroundStyle(on ? Theme.Palette.muted : Theme.Palette.fg)
                                        .frame(maxWidth: .infinity, alignment: .leading).fixedSize(horizontal: false, vertical: true).padding(.top, 2)
                                }
                                .padding(.vertical, Theme.Space.x3).contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, Theme.Space.card).padding(.vertical, Theme.Space.x1).sofraCard()
                }
            }
            .padding(.horizontal, Theme.Space.page).padding(.bottom, Theme.Space.x8)
        }
        .background(Theme.Palette.bg.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if !recipe.stepList.isEmpty {
                Button("Pişirmeye başla") { cooking = true }.buttonStyle(PrimaryButton())
                    .padding(.horizontal, Theme.Space.page).padding(.vertical, Theme.Space.x3)
                    .background(Theme.Palette.bg.opacity(0.94))
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Palette.bg, for: .navigationBar)
        .fullScreenCover(isPresented: $cooking) { CookView(recipe: recipe, times: times) }
    }
}

// MARK: - Pişirirken

/// Adım adım, büyük yazı; adımın malzemeleri tabakta. Ekran kapanmaz.
struct CookView: View {
    var recipe: Recipe
    var times: Double
    @State private var i = 0
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let steps = recipe.stepList, last = i == steps.count - 1
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Button { dismiss() } label: { Image(systemName: "xmark").font(.system(size: 15, weight: .semibold)).frame(width: 40, height: 40).background(Theme.Palette.card, in: Circle()) }
                    .foregroundStyle(Theme.Palette.fg).accessibilityLabel("Kapat")
                Spacer()
                Text("\(recipe.name), \(Recipe.frac(times)) tarif").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                Spacer()
                Color.clear.frame(width: 40, height: 40)
            }
            .padding(.bottom, Theme.Space.x5)
            HStack(spacing: 4) { ForEach(steps.indices, id: \.self) { k in Capsule().fill(k <= i ? Theme.Palette.fg : Theme.Palette.track).frame(height: 4) } }
                .padding(.horizontal, Theme.Space.x1).accessibilityHidden(true)
            Text("\(i + 1). adım, \(steps.count) adımdan").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted).padding(.top, Theme.Space.x8).padding(.bottom, Theme.Space.x2)
            Text(steps[i]).font(.system(.title, weight: .semibold)).foregroundStyle(Theme.Palette.fg).fixedSize(horizontal: false, vertical: true)
                .id(i).transition(.opacity)
            let ings = recipe.ingredients(in: steps[i])
            if !ings.isEmpty {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: Theme.Space.x2), count: 3), spacing: Theme.Space.x5) {
                    ForEach(ings) { ing in
                        VStack(spacing: 6) {
                            IngredientPlate(name: ing.name)
                            Text(ing.name).font(Theme.Typo.secondaryMedium).foregroundStyle(Theme.Palette.fg).multilineTextAlignment(.center)
                            let a = ing.amount(times: times)
                            if !a.isEmpty { Text(a).font(Theme.Typo.captionMedium).padding(.horizontal, 10).frame(height: Theme.Size.pill).background(Theme.Palette.ctl, in: Capsule()) }
                        }
                    }
                }
                .padding(.top, Theme.Space.x6)
            }
            Spacer()
            HStack(spacing: Theme.Space.x2) {
                Button { withAnimation(Theme.Motion.quick) { i = max(0, i - 1) } } label: { Image(systemName: "chevron.left").font(.system(size: 17, weight: .semibold)).frame(width: 52, height: 52) }
                    .foregroundStyle(i == 0 ? Theme.Palette.faint : Theme.Palette.fg)
                    .background(Theme.Palette.ctl, in: RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
                    .disabled(i == 0).accessibilityLabel("Önceki adım")
                Button(last ? "Bitti" : "Sonraki adım") { if last { dismiss() } else { withAnimation(Theme.Motion.quick) { i += 1 } } }.buttonStyle(PrimaryButton())
            }
            .padding(.bottom, Theme.Space.x4)
        }
        .padding(.horizontal, Theme.Space.page).padding(.top, Theme.Space.x4)
        .background(Theme.Palette.bg.ignoresSafeArea())
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
        .sensoryFeedback(.selection, trigger: i)
    }
}
