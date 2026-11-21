import Foundation
import Observation
import DiyetKit

/// Uygulamanın durumu. Kayıtlar Application Support/diyet-v1.json içinde, web'deki diyet-v1 ile aynı biçimde.
/// Bulut eşitlemesi (vekilin /v1/sync ucu) sonraki adımda buraya bağlanacak.
@Observable @MainActor
final class Store {
    let plan: Plan
    private(set) var state: DiyetState
    private let file: URL

    init() {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        file = dir.appendingPathComponent("diyet-v1.json")
        plan = try! Plan.load(Data(contentsOf: Bundle.main.url(forResource: "plan", withExtension: "json")!))
        state = (try? Data(contentsOf: file)).flatMap { try? JSONDecoder().decode(JSON.self, from: $0) }.map { DiyetState(raw: $0) } ?? DiyetState()
    }

    func update(_ k: String, _ f: (inout Day) -> Void) {
        state.update(k, f)
        try? Data(state.raw.text().utf8).write(to: file, options: .atomic)
    }
}
