import SwiftUI
import DiyetKit

/// İlk iskelet: bugünün öğünleri ve kalemleri, işaretleme ve su. Gerçek arayüz tasarım kararlarından sonra gelecek.
struct TodayView: View {
    @Environment(Store.self) private var store
    @State private var sel = DayKey.today

    var body: some View {
        let d = store.state.day(sel)
        NavigationStack {
            List {
                Section {
                    HStack {
                        Label("\(d.water) / 10 bardak", systemImage: "drop")
                        Spacer()
                        Button { store.update(sel) { $0.water -= 1 } } label: { Image(systemName: "minus.circle") }
                        Button { store.update(sel) { $0.water += 1 } } label: { Image(systemName: "plus.circle.fill") }
                    }
                    .buttonStyle(.borderless)
                    .sensoryFeedback(.increase, trigger: d.water)
                }
                ForEach(store.plan.meals) { m in
                    Section {
                        ForEach(store.plan.itemIDs(m, on: sel), id: \.self) { iid in
                            let id = "\(m.id).\(iid)", it = store.plan.items[iid]!, done = d.status(id) == "done"
                            Button {
                                store.update(sel) { $0.setItem(id, done ? nil : .object(["s": .string("done")])) }
                            } label: {
                                HStack {
                                    Image(systemName: done ? "checkmark.circle.fill" : "circle").foregroundStyle(done ? .primary : .secondary)
                                    VStack(alignment: .leading) {
                                        Text(it.opts.first ?? it.name)
                                        if let meta = it.meta { Text(meta).font(.footnote).foregroundStyle(.secondary) }
                                    }
                                }
                            }
                            .tint(.primary)
                            .sensoryFeedback(.selection, trigger: done)
                        }
                    } header: {
                        HStack { Text(m.title); Spacer(); Text((DayKey.isWeekend(sel) ? m.wknd : m.time) ?? "") }
                    }
                }
            }
            .navigationTitle(sel == DayKey.today ? "Bugün" : sel)
        }
    }
}
