import SwiftUI

// Program ekranının kartları: hedef, günlük program (öğünler tabak şeridiyle), gezinme satırları
// ve alt ekranların parçaları (muadil grubu, madde listesi, antrenman günü, seçim listesi).

// MARK: - Hedef

/// Hedef kilo ve cümlesi; altında iki gömme kutu (şu an, günlük plan).
struct GoalCard: View {
    struct Stat: Identifiable, Equatable { var title: String; var value: String; var unit: String = ""; var note: String; var id: String { title } }
    var value: String
    var unit: String = "kg"
    var text: String
    var stats: [Stat]

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x4) {
            VStack(alignment: .leading, spacing: 0) {
                Text("Hedef").font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
                HStack(alignment: .firstTextBaseline, spacing: 3) {
                    Text(value).font(Theme.Typo.title).monospacedDigit().foregroundStyle(Theme.Palette.fg)
                    Text(unit).font(Theme.Typo.secondaryMedium).foregroundStyle(Theme.Palette.muted)
                }
                if !text.isEmpty {
                    Text(text).font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted).fixedSize(horizontal: false, vertical: true).padding(.top, Theme.Space.x1)
                }
            }
            HStack(spacing: Theme.Space.x2) {
                ForEach(stats) { s in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(s.title).font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
                        HStack(alignment: .firstTextBaseline, spacing: 2) {
                            Text(s.value).font(Theme.Typo.heading).monospacedDigit()
                            if !s.unit.isEmpty { Text(s.unit).font(Theme.Typo.captionMedium).foregroundStyle(Theme.Palette.muted) }
                        }
                        .foregroundStyle(Theme.Palette.fg)
                        Text(s.note).font(Theme.Typo.caption).monospacedDigit().foregroundStyle(Theme.Palette.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Theme.Space.x3)
                    .background(Theme.Palette.ctl, in: RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
                }
            }
        }
        .padding(Theme.Space.card)
        .sofraCard()
    }
}

// MARK: - Günlük program

/// Diyetisyenin günü tek kartta: her öğün bir satır, kalemleri tabak şeridinde. Kayıt değil, programın kendisi.
struct PlanMealsCard: View {
    struct Meal: Identifiable, Equatable {
        var id: String
        var title: String
        var time: String
        /// Tabaklar; ana yemeği gün gün değişen öğünde ilk tabak boş kalır ve `note` bunu söyler.
        var plates: [FoodTileModel]
        var note: String = ""
    }
    var meals: [Meal]
    var onMeal: (String) -> Void = { _ in }

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(meals.enumerated()), id: \.element.id) { i, m in
                Button { onMeal(m.id) } label: {
                    VStack(alignment: .leading, spacing: Theme.Space.x2) {
                        HStack(alignment: .firstTextBaseline, spacing: Theme.Space.x2) {
                            Text(m.title).font(Theme.Typo.bodyStrong).foregroundStyle(Theme.Palette.fg)
                            Text(m.time).font(Theme.Typo.secondary).monospacedDigit().foregroundStyle(Theme.Palette.muted)
                            Spacer(minLength: Theme.Space.x2)
                            if !m.note.isEmpty { Text(m.note).font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted).lineLimit(1) }
                        }
                        HStack(spacing: 6) {
                            ForEach(m.plates.prefix(6)) { PlateView(icon: $0.icon, size: 44) }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, Theme.Space.x3)
                    .contentShape(Rectangle())
                }
                .buttonStyle(PressScale(0.98))
                .accessibilityLabel("\(m.title) \(m.time), " + m.plates.map(\.name).joined(separator: ", "))
                if i < meals.count - 1 { Rectangle().fill(Theme.Palette.track).frame(height: 1) }
            }
        }
        .padding(.horizontal, Theme.Space.card).padding(.vertical, Theme.Space.x1)
        .sofraCard()
    }
}

// MARK: - Gezinme satırı

/// Ayar ve alt ekran satırı: solda yuvarlak içinde sembol, ad ve açıklama, sağda ok.
struct NavRow: View {
    var symbol: String
    var title: String
    var subtitle: String = ""
    var body: some View {
        HStack(spacing: Theme.Space.x3) {
            Image(systemName: symbol).font(.system(size: 17, weight: .medium)).foregroundStyle(Theme.Palette.fg)
                .frame(width: 44, height: 44).background(Theme.Palette.ctl, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Theme.Typo.bodyMedium).foregroundStyle(Theme.Palette.fg)
                if !subtitle.isEmpty { Text(subtitle).font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted).lineLimit(1) }
            }
            Spacer(minLength: Theme.Space.x2)
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Palette.faint)
        }
        .frame(minHeight: 60)
        .contentShape(Rectangle())
    }
}

/// Satırları tek kartta toplar.
struct RowsCard<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(spacing: 0) { content() }
            .padding(.horizontal, Theme.Space.card).padding(.vertical, Theme.Space.x1)
            .sofraCard()
    }
}

// MARK: - Alt ekran iskeleti

/// Program'ın alt ekranları: sistem geri düğmesi, büyük başlık yerine sayfanın kendi başlığı ve açıklaması.
struct DetailPage<Content: View>: View {
    var title: String
    var lead: String = ""
    @ViewBuilder var content: () -> Content
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.x2) {
                VStack(alignment: .leading, spacing: Theme.Space.x1) {
                    Text(title).font(Theme.Typo.title).foregroundStyle(Theme.Palette.fg)
                    if !lead.isEmpty { Text(lead).font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted).fixedSize(horizontal: false, vertical: true) }
                }
                .padding(.horizontal, Theme.Space.x1).padding(.bottom, Theme.Space.x2)
                content()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Theme.Space.page).padding(.bottom, Theme.Space.x8)
        }
        .background(Theme.Palette.bg.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Palette.bg, for: .navigationBar)
    }
}

// MARK: - Muadiller

/// Bir değişim grubu: üstte programdaki kalem, altında yerine yenebilecekler tabak ızgarasında.
struct SwapGroupCard: View {
    struct Group: Identifiable, Equatable { var base: FoodTileModel; var alts: [FoodTileModel]; var id: String { base.id } }
    var group: Group

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x3) {
            HStack(spacing: Theme.Space.x3) {
                PlateView(icon: group.base.icon, size: Theme.Size.plateSide)
                VStack(alignment: .leading, spacing: Theme.Space.x1) {
                    Text(group.base.name).font(Theme.Typo.bodyStrong).foregroundStyle(Theme.Palette.fg)
                    AmountPill(text: group.base.amount)
                }
                Spacer(minLength: 0)
            }
            Text("Yerine").font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(minimum: 0), spacing: Theme.Space.x2, alignment: .top), count: 3), spacing: Theme.Space.x4) {
                ForEach(group.alts) { a in
                    VStack(spacing: Theme.Space.x1) {
                        PlateView(icon: a.icon, size: Theme.Size.plateSide)
                        Text(a.name).font(Theme.Typo.captionMedium).foregroundStyle(Theme.Palette.fg).multilineTextAlignment(.center).lineLimit(2, reservesSpace: true)
                            .padding(.top, Theme.Space.x1)
                        AmountPill(text: a.amount, dimmed: true)
                    }
                    .accessibilityElement(children: .ignore).accessibilityLabel("\(a.amount) \(a.name)")
                }
            }
        }
        .padding(Theme.Space.card)
        .sofraCard()
    }
}

// MARK: - Maddeler, antrenman, seçim

/// Kurallar gibi madde listesi: başlık ve isteğe bağlı açıklama.
struct ProseCard: View {
    struct Row: Identifiable, Equatable { var title: String; var note: String = ""; var id: String { title } }
    var rows: [Row]
    var body: some View {
        RowsCard {
            ForEach(Array(rows.enumerated()), id: \.element.id) { i, r in
                VStack(alignment: .leading, spacing: 2) {
                    Text(r.title).font(Theme.Typo.body).foregroundStyle(Theme.Palette.fg)
                    if !r.note.isEmpty { Text(r.note).font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted) }
                }
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading).padding(.vertical, Theme.Space.x1)
                if i < rows.count - 1 { Rectangle().fill(Theme.Palette.track).frame(height: 1) }
            }
        }
    }
}

/// Bir antrenman günü: öncesi, hareketler (ad ve set×tekrar), sonrası.
struct WorkoutCard: View {
    struct Workout: Identifiable, Equatable { var day: String; var name: String; var pre: String; var post: String; var moves: [LedgerCard.Row]; var id: String { day } }
    var workout: Workout
    var isToday = false

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            HStack(alignment: .firstTextBaseline, spacing: Theme.Space.x2) {
                if isToday { NowDot().alignmentGuide(.firstTextBaseline) { $0[.bottom] + 4 } }
                Text(workout.day).font(Theme.Typo.bodyStrong).foregroundStyle(Theme.Palette.fg)
                Text(workout.name).font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
            }
            note("Öncesi", workout.pre)
            VStack(spacing: 0) {
                ForEach(workout.moves) { m in
                    HStack {
                        Text(m.title).font(Theme.Typo.body).foregroundStyle(Theme.Palette.fg)
                        Spacer()
                        Text(m.value).font(Theme.Typo.secondaryMedium).monospacedDigit().foregroundStyle(Theme.Palette.muted)
                    }
                    .frame(minHeight: 40)
                }
            }
            note("Sonrası", workout.post)
        }
        .padding(Theme.Space.card)
        .sofraCard()
    }
    private func note(_ k: String, _ v: String) -> some View {
        (Text(k + "  ").font(Theme.Typo.captionMedium).foregroundStyle(Theme.Palette.fg) + Text(v).font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted))
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// Tek seçimli liste (Görünüm): seçili satırda onay işareti.
struct ChoiceCard: View {
    var options: [(id: String, title: String)]
    @Binding var selection: String
    var body: some View {
        RowsCard {
            ForEach(options, id: \.id) { o in
                Button { selection = o.id } label: {
                    HStack {
                        Text(o.title).font(Theme.Typo.body).foregroundStyle(Theme.Palette.fg)
                        Spacer()
                        if selection == o.id {
                            MarkShape().stroke(Theme.Palette.fg, style: StrokeStyle(lineWidth: 1.75, lineCap: .round, lineJoin: .round)).frame(width: 24, height: 24)
                        }
                    }
                    .frame(minHeight: 52).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selection == o.id ? .isSelected : [])
            }
        }
        .sensoryFeedback(.selection, trigger: selection)
    }
}
