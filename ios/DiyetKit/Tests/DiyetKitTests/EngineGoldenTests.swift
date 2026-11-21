import XCTest
@testable import DiyetKit

/// Swift motoru web motorunun (app.js) cevaplarıyla karşılaştırılır. Cevaplar ios/scripts/engine-golden.mjs ile üretilir:
/// iki program (varsayılan ve haftanın iki hafif günü olan 20 Kasım programı) × 15 rastgele kayıt, her biri 18 gün.
final class EngineGoldenTests: XCTestCase {
    func res(_ name: String, _ ext: String, _ dir: String? = nil) throws -> Data {
        try Data(contentsOf: XCTUnwrap(Bundle.module.url(forResource: name, withExtension: ext, subdirectory: dir)))
    }
    func library() throws -> [Food] { try JSONDecoder().decode([Food].self, from: res("foods", "json")) }

    func testDefaultPlan() throws { try check(plan: Plan.load(res("plan", "json")), golden: "default") }
    func testWeeklyPlanWithLightDays() throws { try check(plan: Plan.load(res("plan-weekly", "json")), golden: "weekly") }

    func near(_ a: Double?, _ b: JSON?) -> Bool {
        guard let b = b?.double else { return a == nil && (b == nil || b == .null) }
        guard let a else { return false }
        return abs((a * 1000).rounded() / 1000 - b) < 0.0015
    }

    func check(plan: Plan, golden: String) throws {
        let G = try JSON.parse(String(decoding: res(golden, "json", "golden"), as: UTF8.self)), lib = try library()
        let today = G["today"]!.string!
        var fails: [String] = []
        func fail(_ s: String) { if fails.count < 25 { fails.append(s) } }

        let eng0 = Engine(plan: plan, state: DiyetState(raw: try JSON.parse(#"{"days":{},"weights":[],"foods":{"simit":{"n":"Simit","u":"1 adet","k":280,"p":9},"ev yogurdu":{"n":"Ev yoğurdu","u":"1 kase","k":120,"p":7}}}"#)), library: lib, today: today)
        for u in G["unit"]!.array! {
            let t = u["t"]!.string!
            let gs = Groups.of(t), want = u["grps"]!.array!.compactMap(\.string)
            if gs != want { fail("grpsIn(\(t)) \(gs) ≠ \(want)") }
            let g = eng0.guess(t)
            if let w = u["guess"], w != .null {
                if g == nil || !near(g!.k, w["k"]) || !near(g!.p, w["p"]) { fail("guess(\(t)) \(String(describing: g)) ≠ \(w.text())") }
                for (key, v) in w["by"]!.object! where !near(g?.by[key], v) { fail("guess(\(t)).by[\(key)]") }
            } else if g != nil { fail("guess(\(t)) \(g!) ≠ null") }
            let a = Amount.parse(t)
            if let w = u["amt"], w != .null {
                if a == nil || !near(a!.a, w["a"]) || !near(a!.b, w["b"]) || a!.u != w["u"]!.string! || a!.rest != w["rest"]!.string! { fail("parseAmt(\(t)) \(String(describing: a)) ≠ \(w.text())") }
            } else if a != nil { fail("parseAmt(\(t)) \(a!) ≠ null") }
        }

        for c in G["cases"]!.array! {
            let seed = c["seed"]!.int!, E = Engine(plan: plan, state: DiyetState(raw: c["state"]!), library: lib, today: today), out = c["out"]!
            for (k, d) in out["days"]!.object!.sorted(by: { $0.key < $1.key }) {
                let at = "\(golden) #\(seed) \(k)"
                for (m, w) in zip(plan.meals, d["meals"]!.array!) {
                    let its = E.itemsOf(m, k)
                    if E.timeOf(m, k) != (w["time"]?.string ?? "") { fail("\(at) \(m.id) saat \(E.timeOf(m, k)) ≠ \(w["time"]?.text() ?? "")") }
                    let main = m.main && E.hasMain(m, k) ? E.mainFor(k, m.id)?.id : nil
                    if main != w["main"]?.string { fail("\(at) \(m.id) ana yemek \(main ?? "-") ≠ \(w["main"]!.text())") }
                    if E.modesOn(m, k) != (w["modes"] == .bool(true)) { fail("\(at) \(m.id) modes") }
                    let wi = w["items"]!.array!
                    if its.map(\.id) != wi.map({ $0.array![0].string! }) { fail("\(at) \(m.id) kalemler \(its.map(\.id)) ≠ \(wi.map { $0.array![0].string! })"); continue }
                    for (it, x) in zip(its, wi) where !near(it.k, x.array![1]) || !near(it.p, x.array![2]) || it.optional != (x.array![3] == .bool(true)) { fail("\(at) \(m.id).\(it.id) değer") }
                    let st = E.mealStat(m, k), ws = w["stat"]!.array!.compactMap(\.int)
                    if [st.total, st.ok, st.skip] != ws { fail("\(at) \(m.id) stat \([st.total, st.ok, st.skip]) ≠ \(ws)") }
                    if !near(E.mealVal(m, k), w["val"]) { fail("\(at) \(m.id) mealVal \(String(describing: E.mealVal(m, k))) ≠ \(w["val"]!.text())") }
                    for (it, x) in zip(its, w["ate"]!.array!) { let a = E.ateOf(it, E.status(k, m, it)); if !near(a.k, x.array![0]) || !near(a.p, x.array![1]) { fail("\(at) ateOf \(m.id).\(it.id) \(a) ≠ \(x.text())") } }
                }
                let b = E.balance(k), wb = d["bal"]!.array!
                for (i, v) in [b.gk, b.gp, b.tk, b.tp, b.ek, b.ep].enumerated() where !near(v, wb[i]) { fail("\(at) balance[\(i)] \(v) ≠ \(wb[i].text())") }
                if b.open.count != wb[6].int! || b.any != (wb[7] == .bool(true)) { fail("\(at) balance open/any") }
                let sc = E.dayScore(k)
                if let ws = d["score"]?.array {
                    if let sc { for (i, v) in [sc.pct, sc.cover, sc.meal, sc.kcal, sc.prot].enumerated() where !near(v, ws[i]) { fail("\(at) score[\(i)] \(v) ≠ \(ws[i].text())") } }
                    else { fail("\(at) score nil") }
                } else if sc != nil { fail("\(at) score \(sc!) ≠ null") }
                if !near(E.dayFill(k), d["fill"]) { fail("\(at) fill") }
                let L = E.ledger(k), wl = d["ledger"]!
                if !near(L.gk, wl["gk"]) || !near(L.gp, wl["gp"]) || !near(L.paid, wl["paid"]) { fail("\(at) ledger gk/gp/paid") }
                let wg = wl["G"]!.object!
                if Set(L.G.keys) != Set(wg.keys) { fail("\(at) ledger G anahtar \(L.G.keys.sorted()) ≠ \(wg.keys.sorted())") }
                for (g, v) in wg where !near(L.G[g], v) { fail("\(at) ledger G[\(g)] \(L.G[g] ?? .nan) ≠ \(v.text())") }
                let ww = wl["why"]!.object!
                for (g, xs) in ww {
                    let mine = (L.why[g] ?? []).map { "\($0.meal).\($0.item.id)/\(Int(($0.miss * 1000).rounded()))/\($0.skip)" }
                    let theirs = xs.array!.map { x in "\(x.array![0].string!).\(x.array![1].string!)/\(Int((x.array![2].double! * 1000).rounded()))/\(x.array![3] == .bool(true))" }
                    if mine != theirs { fail("\(at) ledger why[\(g)] \(mine) ≠ \(theirs)") }
                }
                if Set(L.why.keys) != Set(ww.keys) { fail("\(at) ledger why anahtarları") }
            }
            let A = E.adjust(today), wa = out["adjust"]!
            let mine = A.adds.map { "\($0.meal)|\($0.id)|\($0.name)|\($0.k)|\($0.p)|\($0.why)|\($0.off)|\($0.xi)" }
            let theirs = wa["adds"]!.array!.map { x -> String in let a = x.array!
                return "\(a[0].string!)|\(a[1].string!)|\(a[2].string!)|\(a[3].double!)|\(a[4].double!)|\(a[5].string!)|\(a[6] == .bool(true))|\(a[7].int!)" }
            if mine != theirs { fail("\(golden) #\(seed) adjust.adds\n  swift: \(mine)\n  web:   \(theirs)") }
            let wo = wa["over"]!.object!
            if Set(A.over.keys) != Set(wo.keys) { fail("\(golden) #\(seed) adjust.over \(A.over.keys.sorted()) ≠ \(wo.keys.sorted())") }
            for (key, v) in wo { let o = A.over[key]; if o?.name != v.array![0].string || !near(o?.k, v.array![1]) || !near(o?.p, v.array![2]) { fail("\(golden) #\(seed) over \(key)") } }
            if A.why != wa["why"]!.string! || A.note != wa["note"]!.string! { fail("\(golden) #\(seed) adjust why/note") }
        }
        XCTAssert(fails.isEmpty, "\n" + fails.joined(separator: "\n"))
    }
}
