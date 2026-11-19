import SwiftUI

// Asistan ekranının parçaları: üst çubuk, mesajlar (kullanıcı balonlu, cevap balonsuz düz metin),
// cevabın önerdiği yiyecekler tabak sırası olarak, değişiklik onay kartı, yazı kutusu ve geçmiş sayfası.

// MARK: - Model

struct ChatAction: Equatable {
    enum State: Equatable { case pending, done, declined }
    /// Yapılacak değişiklikler, satır satır ("Su hedefi: 10 → 12 bardak").
    var lines: [String]
    /// Program kalemi ya da kalori görünürlüğü değişiyorsa diyetisyen uyarısı.
    var warning: String = ""
    var state: State = .pending
}

struct ChatMessage: Identifiable, Equatable {
    enum Role: Equatable { case user, assistant }
    var id = UUID()
    var role: Role
    var text: String
    /// Cevabın önerdiği yiyecekler; metnin altında tabak sırası olarak görünür.
    var foods: [FoodTileModel] = []
    var action: ChatAction? = nil
    /// Cevap hâlâ geliyor.
    var streaming = false
}

// MARK: - Üst çubuk

/// Geçmiş, sohbet başlığı, yeni sohbet. Sayfanın tepesinde sabit durur.
struct ChatTopBar: View {
    var title: String
    var onHistory: () -> Void
    var onNew: () -> Void

    var body: some View {
        HStack(spacing: Theme.Space.x2) {
            button("clock.arrow.circlepath", "Geçmiş", onHistory)
            Text(title).font(Theme.Typo.bodyStrong).foregroundStyle(Theme.Palette.fg).lineLimit(1).frame(maxWidth: .infinity)
            button("square.and.pencil", "Yeni sohbet", onNew)
        }
        .padding(.horizontal, Theme.Space.page).padding(.vertical, Theme.Space.x2)
        .background(Theme.Palette.bg)
    }
    private func button(_ symbol: String, _ label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 17, weight: .medium)).foregroundStyle(Theme.Palette.fg)
                .frame(width: Theme.Size.tap, height: Theme.Size.tap).background(Theme.Palette.ctl, in: Circle())
        }
        .buttonStyle(PressScale(0.92)).accessibilityLabel(label)
    }
}

// MARK: - Mesajlar

/// Cevap metni: `**kalın**` ve `- ` ile başlayan maddeler. Balon yok.
struct AssistantText: View {
    var text: String

    private struct Block: Identifiable { var id: Int; var bullet: Bool; var text: AttributedString }
    private var blocks: [Block] {
        text.split(separator: "\n", omittingEmptySubsequences: true).enumerated().map { i, raw in
            let line = raw.trimmingCharacters(in: .whitespaces)
            let bullet = line.hasPrefix("- ")
            let body = bullet ? String(line.dropFirst(2)) : line
            let a = (try? AttributedString(markdown: body, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(body)
            return Block(id: i, bullet: bullet, text: a)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            ForEach(blocks) { b in
                HStack(alignment: .firstTextBaseline, spacing: Theme.Space.x2) {
                    if b.bullet { Circle().fill(Theme.Palette.faint).frame(width: 5, height: 5).alignmentGuide(.firstTextBaseline) { $0[.bottom] + 5 } }
                    Text(b.text).font(Theme.Typo.body).foregroundStyle(Theme.Palette.fg).lineSpacing(3)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.leading, b.bullet ? Theme.Space.x1 : 0)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .textSelection(.enabled)
    }
}

/// Bir mesaj. Kullanıcınınki sağda, kontrol zemininde; cevap solda düz metin, altında yiyecekler, onay kartı ve kopyala.
struct ChatMessageView: View {
    var message: ChatMessage
    var onApply: () -> Void = {}
    var onDecline: () -> Void = {}
    var onCopy: () -> Void = {}

    @State private var copied = false

    var body: some View {
        switch message.role {
        case .user:
            Text(message.text).font(Theme.Typo.body).foregroundStyle(Theme.Palette.fg)
                .padding(.horizontal, Theme.Space.x4).padding(.vertical, 10)
                .background(Theme.Palette.card, in: RoundedRectangle(cornerRadius: Theme.Radius.panel, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.panel, style: .continuous).strokeBorder(Theme.Palette.line, lineWidth: 1))
                .frame(maxWidth: .infinity, alignment: .trailing).padding(.leading, Theme.Space.x8 + Theme.Space.x4)
        case .assistant:
            VStack(alignment: .leading, spacing: Theme.Space.x3) {
                if message.text.isEmpty && message.streaming {
                    Text("Yazıyor").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                } else {
                    AssistantText(text: message.text)
                }
                if !message.foods.isEmpty && !message.streaming { foods }
                if let a = message.action, !message.streaming { ChatActionCard(action: a, onApply: onApply, onDecline: onDecline) }
                if !message.streaming {
                    Button { onCopy(); copied = true } label: {
                        Label(copied ? "Kopyalandı" : "Kopyala", systemImage: copied ? "checkmark" : "doc.on.doc")
                            .font(Theme.Typo.captionMedium).foregroundStyle(Theme.Palette.muted)
                            .frame(minHeight: Theme.Size.tap).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain).padding(.top, -Theme.Space.x2)
                    .sensoryFeedback(.success, trigger: copied)
                }
            }
            .padding(.horizontal, Theme.Space.x1)
        }
    }

    private var foods: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: Theme.Space.x1) {
                ForEach(message.foods) { f in
                    VStack(spacing: Theme.Space.x1) {
                        PlateView(icon: f.icon, size: Theme.Size.plateSide)
                        Text(f.name).font(Theme.Typo.captionMedium).foregroundStyle(Theme.Palette.fg).multilineTextAlignment(.center)
                            .lineLimit(2).padding(.top, Theme.Space.x1)
                        Text([f.amount, f.caption].compactMap { $0 }.joined(separator: "\n")).font(Theme.Typo.caption).monospacedDigit()
                            .foregroundStyle(Theme.Palette.muted).multilineTextAlignment(.center)
                    }
                    .frame(width: 104)
                    .accessibilityElement(children: .ignore).accessibilityLabel("\(f.amount) \(f.name)")
                }
            }
            .padding(.horizontal, Theme.Space.x2).padding(.vertical, Theme.Space.x3)
        }
        .sofraCard()
    }
}

// MARK: - Onay kartı

/// Asistan hiçbir şeyi kendisi değiştirmez; değişiklik bu kartta onaylanır. Tek ana düğme "Uygula".
struct ChatActionCard: View {
    var action: ChatAction
    var onApply: () -> Void
    var onDecline: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x3) {
            Text(action.state == .done ? "Uygulandı" : action.state == .declined ? "Vazgeçildi" : "Değişiklik önerisi")
                .font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted)
            VStack(alignment: .leading, spacing: Theme.Space.x1) {
                ForEach(action.lines, id: \.self) { l in
                    Text(l).font(Theme.Typo.bodyMedium).foregroundStyle(action.state == .declined ? Theme.Palette.muted : Theme.Palette.fg)
                        .strikethrough(action.state == .declined).fixedSize(horizontal: false, vertical: true)
                }
            }
            if !action.warning.isEmpty && action.state == .pending {
                Text(action.warning).font(Theme.Typo.caption).foregroundStyle(Theme.Palette.muted).fixedSize(horizontal: false, vertical: true)
            }
            if action.state == .pending {
                HStack(spacing: Theme.Space.x2) {
                    Button("Uygula", action: onApply).buttonStyle(PrimaryButton())
                    Button("Vazgeç", action: onDecline).font(Theme.Typo.body).foregroundStyle(Theme.Palette.muted)
                        .padding(.horizontal, Theme.Space.x4).frame(minHeight: Theme.Size.button)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Space.card)
        .sofraCard()
    }
}

// MARK: - Boş sohbet

/// Yeni sohbetin açılışı: kısa bir satır ve dokununca gönderilen örnek sorular.
struct ChatEmptyState: View {
    var prompts: [String]
    var onPick: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x4) {
            VStack(alignment: .leading, spacing: Theme.Space.x1) {
                Text("Asistan").font(Theme.Typo.title).foregroundStyle(Theme.Palette.fg)
                Text("Programını ve bugünkü kaydını biliyor. Sor ya da bir değişiklik iste.").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, Theme.Space.x1)
            RowsCard {
                ForEach(prompts, id: \.self) { p in
                    Button { onPick(p) } label: {
                        HStack {
                            Text(p).font(Theme.Typo.body).foregroundStyle(Theme.Palette.fg).multilineTextAlignment(.leading)
                            Spacer(minLength: Theme.Space.x2)
                            Image(systemName: "arrow.up.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Palette.faint)
                        }
                        .frame(minHeight: 52).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

// MARK: - Yazı kutusu

/// Yazı kutusu: büyüyen alan ve tek düğme. Cevap gelirken düğme durdurur.
struct ChatComposer: View {
    @Binding var text: String
    var busy: Bool
    var focus: FocusState<Bool>.Binding
    var onSend: () -> Void
    var onStop: () -> Void

    private var canSend: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        HStack(alignment: .bottom, spacing: Theme.Space.x2) {
            TextField("Bir şey sor", text: $text, axis: .vertical)
                .lineLimit(1...5).focused(focus)
                .font(Theme.Typo.body).foregroundStyle(Theme.Palette.fg)
                .padding(.horizontal, Theme.Space.x4).padding(.vertical, 13)
                .frame(minHeight: Theme.Size.button)
                .background(Theme.Palette.card, in: RoundedRectangle(cornerRadius: Theme.Radius.panel, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.panel, style: .continuous).strokeBorder(Theme.Palette.track, lineWidth: 1))
            Button { busy ? onStop() : onSend() } label: {
                Image(systemName: busy ? "stop.fill" : "arrow.up").font(.system(size: busy ? 15 : 17, weight: .semibold))
                    .foregroundStyle(busy || canSend ? Theme.Palette.bg : Theme.Palette.muted)
                    .frame(width: Theme.Size.button, height: Theme.Size.button)
                    .background(busy || canSend ? Theme.Palette.fg : Theme.Palette.ctl, in: Circle())
            }
            .buttonStyle(PressScale(0.92))
            .disabled(!busy && !canSend)
            .accessibilityLabel(busy ? "Durdur" : "Gönder")
        }
        .padding(.horizontal, Theme.Space.page).padding(.top, Theme.Space.x2).padding(.bottom, Theme.Space.x2)
        .background(Theme.Palette.bg)
    }
}

// MARK: - Geçmiş

struct ChatSummary: Identifiable, Equatable { var id: String; var title: String; var group: String; var count: Int }

/// Geçmiş sohbetler, son kullanılana göre gruplu. Silme satırı basılı tutunca çıkar.
struct ChatHistorySheet: View {
    var chats: [ChatSummary]
    var current: String?
    var onOpen: (String) -> Void
    var onDelete: (String) -> Void

    private var groups: [(String, [ChatSummary])] {
        var order: [String] = [], map: [String: [ChatSummary]] = [:]
        for c in chats { if map[c.group] == nil { order.append(c.group) }; map[c.group, default: []].append(c) }
        return order.map { ($0, map[$0]!) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("Geçmiş").font(Theme.Typo.heading).foregroundStyle(Theme.Palette.fg).padding(.horizontal, Theme.Space.x1).padding(.top, Theme.Space.x6)
                if chats.isEmpty {
                    Text("Henüz kayıtlı sohbet yok.").font(Theme.Typo.secondary).foregroundStyle(Theme.Palette.muted).padding(.horizontal, Theme.Space.x1).padding(.top, Theme.Space.x2)
                }
                ForEach(groups, id: \.0) { g in
                    SectionTitle(g.0)
                    VStack(spacing: 0) {
                        ForEach(g.1) { c in
                            Button { onOpen(c.id) } label: {
                                HStack(spacing: Theme.Space.x3) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(c.title).font(c.id == current ? Theme.Typo.bodyStrong : Theme.Typo.body).foregroundStyle(Theme.Palette.fg).lineLimit(1)
                                        Text("\(c.count) mesaj").font(Theme.Typo.caption).monospacedDigit().foregroundStyle(Theme.Palette.muted)
                                    }
                                    Spacer(minLength: Theme.Space.x2)
                                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Palette.faint)
                                }
                                .frame(minHeight: 60).contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .contextMenu { Button("Sil", systemImage: "trash", role: .destructive) { onDelete(c.id) } }
                        }
                    }
                    .padding(.horizontal, Theme.Space.card).padding(.vertical, Theme.Space.x1)
                    .background(Theme.Palette.ctl, in: RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
                }
            }
            .padding(.horizontal, Theme.Space.page).padding(.bottom, Theme.Space.x8)
        }
        .background(Theme.Palette.sheet)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.panel)
    }
}
