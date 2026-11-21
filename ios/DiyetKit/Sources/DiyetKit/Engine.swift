import Foundation

// Web motorunun (app.js) birebir karşılığı: ana yemek dağıtımı, günün kalemleri, yenen değer, besin grupları,
// denge, uyum puanı ve telafi. Davranış ios/scripts/engine-golden.mjs'in ürettiği cevaplarla sınanır
// (EngineGoldenTests); app.js'te motor değişirse betik yeniden çalıştırılır ve bu dosya ona uydurulur.
// JavaScript'le aynı sonuç için: yuvarlama Math.round gibi (jsRound), sıralama kararlı, nesne sırası korunur.

/// Math.round: yarımda yukarı (−2,5 → −2).
@inlinable func jsRound(_ x: Double) -> Double { (x + 0.5).rounded(.down) }
@inlinable func r1(_ x: Double) -> Double { jsRound(x * 10) / 10 }

/// Kararlı sıralama (JavaScript'in Array.sort'u gibi).
extension Array {
    func stableSorted(by less: (Element, Element) -> Bool) -> [Element] {
        enumerated().sorted { a, b in less(a.element, b.element) || (!less(b.element, a.element) && a.offset < b.offset) }.map(\.element)
    }
}

/// Kütüphanedeki gıda (foods.js ve kullanıcının S.foods'u): bir porsiyonun değeri.
public struct Food: Codable, Equatable, Sendable {
    public var n: String
    public var u: String?
    public var k: Double
    public var p: Double
    public var a: [String]?
    public var i: String?
    public init(n: String, u: String? = nil, k: Double, p: Double, a: [String]? = nil, i: String? = nil) { self.n = n; self.u = u; self.k = k; self.p = p; self.a = a; self.i = i }
}

/// Günün bir kalemi, plandaki değerleriyle. Ana yemek de kimliği "ana" olan bir kalemdir.
public struct PlanItem: Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var chip: String?
    public var meta: String?
    public var k: Double
    public var p: Double
    public var opts: [String]
    public var subs: [String]
    public var sugg: [String]
    public var optional: Bool
    public var grp: String?
    /// Ana yemekse: hangi yemek (mains kimliği) ve kota grubu.
    public var main: String?
    public var g: String?
}

/// Bir kalemin kaydı (days[k].items['öğün.kalem']).
public struct ItemState: Equatable, Sendable {
    public var raw: JSON
    public init(_ raw: JSON) { self.raw = raw }
    public var s: String { raw["s"]?.string ?? "" }
    public var isSkip: Bool { s == "skip" }
    public var isSwap: Bool { s == "swap" }
    public var k: Double? { raw["k"]?.double }
    public var p: Double? { raw["p"]?.double }
    public var q: Double { (raw["q"]?.double).flatMap { $0 != 0 ? $0 : nil } ?? 1 }
    public var o: Int? { raw["o"]?.int }
    public var alt: Bool { raw["alt"]?.truthy ?? false }
    public var pl: Bool { raw["pl"]?.truthy ?? false }
    public var srcName: String? { raw["src"]?["n"]?.string }
    public var hasSrc: Bool { raw["src"]?.truthy ?? false }
    /// base || sub (JavaScript'teki gibi boş metin yok sayılır).
    public var text: String { [raw["base"]?.string, raw["sub"]?.string].compactMap { $0 }.first { !$0.isEmpty } ?? (raw["sub"]?.string ?? "") }
}

/// Plan dışı kayıt (days[k].extras).
public struct Extra: Equatable, Sendable {
    public var raw: JSON
    public var meal: String { raw["meal"]?.string ?? "" }
    public var name: String { raw["name"]?.string ?? "" }
    public var id: String { raw["id"]?.string ?? "" }
    public var k: Double { raw["k"]?.double ?? 0 }
    public var p: Double { raw["p"]?.double ?? 0 }
    public var adj: Bool { raw["adj"]?.truthy ?? false }
    public var pl: Bool { raw["pl"]?.truthy ?? false }
}

/// Telafi ayarları (plan.tune).
public struct Tune: Sendable {
    public struct Add: Sendable { public var at: [String]; public var name: String; public var g: Double?; public var k: Double; public var p: Double; public var max: Double? }
    public struct Cut: Sendable { public var item: String; public var name: String; public var k: Double; public var p: Double }
    public var protein: [Add] = []
    public var carb: Add?
    public var snack: Add?
    public var cuts: [Cut] = []

    init(_ j: JSON?) {
        func add(_ x: JSON?) -> Add? {
            guard let x, let name = x["name"]?.string else { return nil }
            let at: [String] = x["at"]?.string.map { [$0] } ?? (x["at"]?.array ?? []).compactMap(\.string)
            return Add(at: at, name: name, g: x["g"]?.double, k: x["k"]?.double ?? 0, p: x["p"]?.double ?? 0, max: x["max"]?.double)
        }
        protein = (j?["protein"]?.array ?? []).compactMap(add)
        carb = add(j?["carb"]); snack = add(j?["snack"])
        cuts = (j?["cuts"]?.array ?? []).compactMap { c in c["item"]?.string.map { Cut(item: $0, name: c["name"]?.string ?? "", k: c["k"]?.double ?? 0, p: c["p"]?.double ?? 0) } }
    }
}

// MARK: - Besin grupları ve tahmin

public enum Groups {
    /// Diyetisyenin değişim listesindeki gruplar, öncelik sırasıyla. Noktalı kök tam sözcük ya da kısa ekli olmalı.
    static let table: [(String, [String])] = [
        ("prot", "protein whey quark skyr peynir lor. cokelek kasar tulum hellim yumurta omlet menemen et. kiyma kofte tavu hindi balik ton. somon levrek hamsi uskumru sardalya bonfile antrikot bifte kurubaklagil fasulye nohut mercimek barbunya borulce bakla."),
        ("fat", "cekirde ceviz badem findi avokado zeytin yag. tereyag tahin fistik"),
        ("carb", "ekme yulaf bulgur makarna pirinc pilav patates lavas galeta leblebi bazlama simit kraker"),
        ("dairy", "yogurt ayran kefir caci sut."),
        ("fruit", "meyve elma portakal mandalina muz. cilek kayisi kivi kavun karpuz uzum armut kiraz seftali incir hurma nar."),
        ("veg", "salata sogus domates yesillik sebze roka marul maydanoz biber kabak brokoli ispanak mantar havuc semizotu"),
    ].map { ($0.0, $0.1.split(separator: " ").map(String.init)) }
    static let order = table.map(\.0)
    static let suffixes = ["li", "lu", "i", "u", "e", "a"]

    static func hit(_ w: String, _ kw: String) -> Bool {
        guard kw.hasSuffix(".") else { return w.hasPrefix(kw) }
        let stem = String(kw.dropLast())
        guard w.hasPrefix(stem) else { return false }
        let rest = String(w.dropFirst(stem.count))
        return rest.isEmpty || suffixes.contains(rest)
    }

    /// Metindeki besin grupları (web: grpsIn).
    public static func of(_ t: String) -> [String] {
        let w = TR.fold(t).split(separator: " ", omittingEmptySubsequences: false).map(String.init)
        var hits = Set<String>()
        for (i, x) in w.enumerated() {
            if x.isEmpty || x.hasSuffix("siz") || x.hasSuffix("suz") { continue }
            if i + 1 < w.count, w[i + 1].hasPrefix("cekirde") { continue }
            if let g = table.first(where: { $0.1.contains { hit(x, $0) } }) { hits.insert(g.0) }
        }
        return order.filter(hits.contains)
    }

    /// Bir değişimin yaklaşık kcal ve proteini (web: STD).
    static let std: [String: (Double, Double)] = ["prot": (80, 6), "carb": (70, 2.5), "dairy": (60, 4), "fat": (45, 0.5), "fruit": (70, 1), "veg": (30, 1)]
}

/// Kalem adının başındaki miktar (web: parseAmt): "2 dilim tam buğday ekmeği" → 2, dilim, "Tam buğday ekmeği".
public struct Amount: Equatable, Sendable {
    public var a: Double, b: Double, u: String, rest: String
    static let units = ["su bardağı", "çay bardağı", "yemek kaşığı", "tatlı kaşığı", "çay kaşığı", "avuç içi", "küçük kase", "gr", "g", "kg", "ml", "yk", "tk", "çk", "dilim", "adet", "bardak", "fincan", "kase", "avuç", "porsiyon", "kutu", "ölçü", "ölçek", "tane", "paket", "kepçe"]
    static let re = try! NSRegularExpression(pattern: "^(\\d+(?:[.,]\\d+)?|[½¼¾]|yarım)(?:\\s*[-–]\\s*(\\d+(?:[.,]\\d+)?))?\\s+(?:(\(units.joined(separator: "|")))\\s+)?(.+)$", options: [.caseInsensitive])

    public static func parse(_ t: String) -> Amount? {
        let ns = t as NSString
        guard let m = re.firstMatch(in: t, range: NSRange(location: 0, length: ns.length)) else { return nil }
        func g(_ i: Int) -> String? { let r = m.range(at: i); return r.location == NSNotFound ? nil : ns.substring(with: r) }
        guard let rest = g(4), !rest.contains("+") else { return nil }
        func n(_ s: String) -> Double {
            switch s.lowercased(with: TR.locale) { case "½": return 0.5; case "¼": return 0.25; case "¾": return 0.75; case "yarım": return 0.5
            default: return Double(s.replacingOccurrences(of: ",", with: ".")) ?? .nan }
        }
        return Amount(a: n(g(1)!), b: g(2).map(n) ?? 0, u: (g(3) ?? "").lowercased(with: TR.locale), rest: TR.cap(rest))
    }
}

// MARK: - Motor

/// Plan, kayıt ve kütüphane üzerinden bütün hesaplar. Değer türü: kayıt değişince yenisi kurulur.
public struct Engine {
    public let plan: Plan
    public let state: DiyetState
    public let library: [Food]
    public let today: String
    public let tune: Tune
    /// Kota gruplarının sırası: mains'te ilk görüldükleri sıra (planın groups nesnesinin sırası).
    let groupOrder: [String]
    let mainMeals: [Plan.Meal]
    let timed: [Plan.Meal]
    let foodsByKey: [String: Food]

    public init(plan: Plan, state: DiyetState, library: [Food], today: String = DayKey.today) {
        self.plan = plan; self.state = state; self.library = library; self.today = today
        tune = Tune(plan.tune)
        var seen: [String] = []
        for m in plan.mains where !seen.contains(m.g) { seen.append(m.g) }
        for g in plan.groups.keys.sorted() where !seen.contains(g) { seen.append(g) }
        groupOrder = seen
        mainMeals = plan.meals.filter(\.main)
        timed = plan.meals.filter { ($0.time ?? "").isEmpty == false }
        var f: [String: Food] = [:]
        for (k, v) in state.raw["foods"]?.object ?? [:] {
            if let n = v["n"]?.string { f[k] = Food(n: n, u: v["u"]?.string, k: v["k"]?.double ?? 0, p: v["p"]?.double ?? 0) }
        }
        foodsByKey = f
    }

    public var tuneOn: Bool { plan.prefs.tune }

    // MARK: Gün ve öğün

    func peek(_ k: String) -> Day { state.day(k) }
    func mainLock(_ k: String, _ meal: String) -> String? { peek(k).raw["main"]?[meal]?.string.flatMap { $0.isEmpty ? nil : $0 } }
    public func cycleIdx(_ k: String) -> Int { plan.cycleIndex(k) ?? 0 }
    func dayList(_ meal: Plan.Meal, _ k: String) -> [String] { meal.days.map { $0[cycleIdx(k)] } ?? meal.items }

    public func hasMain(_ meal: Plan.Meal, _ k: String) -> Bool { meal.main && (meal.days == nil || meal.days![cycleIdx(k)].contains("ana")) }
    public func mainById(_ id: String?) -> Plan.Main? { id.flatMap { i in plan.mains.first { $0.id == i } } }

    /// Haftanın geri kalanına kalan kotaya göre ana yemek dağıtılır (web: mainFor).
    public func mainFor(_ k: String, _ mealId: String) -> Plan.Main? {
        guard let meal = mainMeals.first(where: { $0.id == mealId }), hasMain(meal, k) else { return nil }
        if let own = mainLock(k, mealId) { return mainById(own) }
        let wk = DayKey.week(of: k)
        var pool: [String: Double] = [:]
        for g in groupOrder { pool[g] = Double(plan.groups[g]?.perWeek ?? 0) }
        for x in wk { if let m = mainById(mainLock(x, mealId)) { pool[m.g, default: 0] -= 1 } }
        let at = mainMeals.firstIndex { $0.id == mealId }!
        for i in 0..<7 {
            if mainLock(wk[i], mealId) != nil || !hasMain(meal, wk[i]) { continue }
            guard var m = mainById(plan.rota[mealId]?[i]) else { continue }
            var av = Set<String>()
            for (j, x) in mainMeals.enumerated() {
                let o = j < at ? mainFor(wk[i], x.id) : j > at ? mainById(mainLock(wk[i], x.id)) : nil
                if let o { av.insert(o.g) }
            }
            if (pool[m.g] ?? 0) <= 0 || av.contains(m.g) {
                let by: (String, String) -> Bool = { (pool[$1] ?? 0) < (pool[$0] ?? 0) }
                let left = groupOrder.filter { (pool[$0] ?? 0) > 0 }
                let g = left.filter { !av.contains($0) }.stableSorted(by: by).first ?? ((pool[m.g] ?? 0) <= 0 ? left.stableSorted(by: by).first : nil)
                if let g, let x = plan.mains.first(where: { $0.g == g }) { m = x }
            }
            pool[m.g, default: 0] -= 1
            if wk[i] == k { return m }
        }
        return nil
    }

    func item(_ id: String) -> PlanItem? {
        guard let x = plan.items[id] else { return nil }
        return PlanItem(id: id, name: x.name, chip: x.chip, meta: x.meta, k: x.k, p: x.p, opts: x.opts, subs: x.subs, sugg: x.sugg, optional: x.optional, grp: x.grp)
    }
    static func mainItem(_ m: Plan.Main) -> PlanItem {
        PlanItem(id: "ana", name: m.name, chip: m.chip, meta: m.meta, k: m.k, p: m.p, opts: [], subs: m.subs ?? [], sugg: [], optional: false, grp: nil, main: m.id, g: m.g)
    }

    /// Öğünün ikinci biçimi (ör. protein bar) o gün seçilebilir mi.
    public func modesOn(_ meal: Plan.Meal, _ k: String) -> Bool {
        guard meal.modes != nil else { return false }
        guard let ds = meal.days else { return true }
        return ds[cycleIdx(k)] == meal.items
    }

    /// O günün kalemleri (web: itemsOf).
    public func itemsOf(_ meal: Plan.Meal, _ k: String) -> [PlanItem] {
        if modesOn(meal, k), peek(k).raw["mode"]?[meal.id]?.double == 1 { return (meal.alt ?? []).compactMap(item) }
        let L = dayList(meal, k)
        if !hasMain(meal, k) { return L.filter { !(meal.main && $0 == "ana") }.compactMap(item) }
        guard let m = mainFor(k, meal.id) else { return L.filter { $0 != "ana" }.compactMap(item) }
        let drop = m.dropped
        return [Engine.mainItem(m)] + L.filter { $0 != "ana" && !drop.contains($0) }.compactMap(item)
    }

    public func timeOf(_ meal: Plan.Meal, _ k: String) -> String {
        guard let t = meal.time, !t.isEmpty else { return "" }
        if let d = meal.dtime, d.indices.contains(cycleIdx(k)), !d[cycleIdx(k)].isEmpty { return d[cycleIdx(k)] }
        return DayKey.isWeekend(k) ? (meal.wknd ?? t) : t
    }

    public func status(_ k: String, _ meal: Plan.Meal, _ it: PlanItem) -> ItemState? {
        peek(k).item(meal.id + "." + it.id).flatMap { $0.truthy ? ItemState($0) : nil }
    }
    public func extras(_ k: String) -> [Extra] { peek(k).extras.map { Extra(raw: $0) } }

    public struct MealStat: Equatable { public var total: Int, ok: Int, skip: Int; public var resolved: Bool { ok + skip == total } }
    public func mealStat(_ meal: Plan.Meal, _ k: String) -> MealStat {
        var s = MealStat(total: 0, ok: 0, skip: 0)
        for it in itemsOf(meal, k) where !it.optional {
            s.total += 1
            if let st = status(k, meal, it) { if st.isSkip { s.skip += 1 } else { s.ok += 1 } }
        }
        return s
    }

    public func planned(_ meal: Plan.Meal, _ k: String) -> Bool { extras(k).contains { $0.meal == meal.id && $0.pl } }

    // MARK: Yenen değer

    func libExact(_ t: String) -> Food? {
        let f = TR.fold(t)
        if let x = foodsByKey[f] { return x }
        return library.first { TR.fold($0.n) == f || ($0.a ?? []).contains { TR.fold($0) == f } }
    }

    static let splitRe = try! NSRegularExpression(pattern: "\\s*(?:[,+;&/]|\\s(?:ve|ile)\\s)\\s*", options: [.caseInsensitive])

    public struct Guess: Equatable { public var k: Double, p: Double; public var by: [String: Double] }
    /// Elle yazılmış yiyeceğin tahmini (web: guess).
    public func guess(_ t: String) -> Guess? {
        let ns = t as NSString
        var parts: [String] = [], last = 0
        for m in Engine.splitRe.matches(in: t, range: NSRange(location: 0, length: ns.length)) {
            parts.append(ns.substring(with: NSRange(location: last, length: m.range.location - last))); last = m.range.location + m.range.length
        }
        parts.append(ns.substring(from: last))
        var k = 0.0, p = 0.0, any = false, by: [String: Double] = [:]
        for part in parts where !part.trimmingCharacters(in: .whitespaces).isEmpty {
            if let f = libExact(part) { any = true; k += f.k; p += f.p; Engine.spread(&by, Groups.of(f.n), f.k); continue }
            let gs = Groups.of(part); if gs.isEmpty { continue }
            var n = 1.0
            if let pa = Amount.parse(part), gs.count == 1, ["prot", "carb"].contains(gs[0]), ["", "adet", "dilim", "tane"].contains(pa.u), pa.a.rounded() == pa.a, (1...4).contains(pa.a) { n = pa.a }
            for g in gs { any = true; let s = Groups.std[g]!; k += s.0 * n; p += s.1 * n; by[g, default: 0] += s.0 * n }
        }
        return any ? Guess(k: jsRound(k), p: r1(p), by: by) : nil
    }

    static func spread(_ by: inout [String: Double], _ gs: [String], _ k: Double) {
        let L = gs.isEmpty ? [""] : gs
        for g in L { by[g, default: 0] += k / Double(gs.isEmpty ? 1 : gs.count) }
    }

    public func grpOf(_ it: PlanItem) -> String {
        if let g = it.grp, !g.isEmpty { return g }
        return Groups.of(([it.chip ?? "", it.name] + it.opts).joined(separator: " ")).first ?? ""
    }

    func isAlt(_ it: PlanItem, _ s: ItemState) -> Bool { s.alt || it.subs.contains(s.text) }
    /// Kalemin yerine elle yazılmış bir şey mi (programın seçeneği, muadili ya da kütüphaneden değil).
    func isTxt(_ it: PlanItem, _ st: ItemState) -> Bool { st.isSwap && !st.alt && !st.hasSrc && !(it.subs + it.sugg).contains(st.text) }

    /// Yenen değer (web: ateOf).
    public func ateOf(_ it: PlanItem, _ st: ItemState?) -> (k: Double, p: Double) {
        guard let st, !st.isSkip else { return (0, 0) }
        if let k = st.k { return (k, st.p ?? it.p) }
        if isTxt(it, st), let g = guess(st.text) { return (jsRound(g.k * st.q), r1(g.p * st.q)) }
        return (it.k, it.p)
    }

    func ateBy(_ it: PlanItem, _ st: ItemState, _ a: (k: Double, p: Double), _ g: String) -> [String: Double] {
        var by: [String: Double] = [:]
        if st.isSkip || a.k == 0 { return by }
        if st.isSwap && st.hasSrc { Engine.spread(&by, Groups.of(st.srcName ?? ""), a.k) }
        else if isTxt(it, st) {
            if let x = guess(st.text), x.k != 0 { for (y, v) in x.by { by[y] = v * a.k / x.k } } else { by[g] = a.k }
        } else { by[g] = a.k }
        return by
    }

    // MARK: Denge ve puan

    public struct Open: Equatable { public var meal: String; public var item: PlanItem; public var key: String }
    public struct Balance: Equatable { public var gk = 0.0, gp = 0.0, tk = 0.0, tp = 0.0, ek = 0.0, ep = 0.0; public var open: [Open] = []; public var any = false }

    /// Günün planı ve yenenle farkı: gk/gp eksik (+) ya da fazla (−), tk/tp plan, ek/ep yenen (web: balance).
    public func balance(_ k: String) -> Balance {
        var b = Balance(), rk = 0.0, rp = 0.0
        for m in plan.meals { for it in itemsOf(m, k) where !it.optional {
            b.tk += it.k; b.tp += it.p
            guard let st = status(k, m, it) else { b.open.append(Open(meal: m.id, item: it, key: m.id + "." + it.id)); continue }
            b.any = true; rk += it.k; rp += it.p
            let a = ateOf(it, st); b.gk += it.k - a.k; b.gp += it.p - a.p
        } }
        for e in extras(k) { b.gk -= e.k; b.gp -= e.p; b.any = true }
        b.ek = rk - b.gk; b.ep = rp - b.gp
        return b
    }

    static let score = (meal: 0.5, kcal: 0.25, prot: 0.25, kOk: 0.1, kZero: 0.4, pOk: 0.9, pZero: 0.5, other: 0.75)
    static func clamp01(_ x: Double) -> Double { max(0, min(1, x)) }

    public func mealVal(_ m: Plan.Meal, _ k: String) -> Double? {
        if planned(m, k) { return nil }
        let ex = extras(k).contains { $0.meal == m.id && !$0.adj }
        var n = 0.0, v = 0.0
        for it in itemsOf(m, k) where !it.optional {
            guard let s = status(k, m, it) else { continue }
            n += 1
            v += s.isSkip ? (ex ? Engine.score.other : 0) : (s.isSwap && !isAlt(it, s)) ? Engine.score.other : 1
        }
        return n > 0 ? v / n : nil
    }

    public struct Score: Equatable { public var pct: Double, cover: Double, meal: Double, kcal: Double, prot: Double }
    /// Uyum puanı (web: dayScore): kaydı olan saatli öğünler üzerinden %50 öğün düzeni, %25 kalori, %25 protein.
    public func dayScore(_ k: String) -> Score? {
        guard let d = state.raw["days"]?[k] else { return nil }
        let items = d["items"]?.object ?? [:], ex = d["extras"]?.array ?? []
        if items.isEmpty && ex.isEmpty { return nil }
        let vals = timed.compactMap { mealVal($0, k) }
        if vals.isEmpty { return nil }
        let B = balance(k), meal = vals.reduce(0, +) / Double(vals.count), S = Engine.score
        let kcal = B.tk < 300 ? 1 : Engine.clamp01(1 - (abs(B.gk) / B.tk - S.kOk) / (S.kZero - S.kOk))
        let prot = B.tp < 5 ? 1 : Engine.clamp01((1 - max(0, B.gp) / B.tp - S.pZero) / (S.pOk - S.pZero))
        let pct = jsRound(100 * (S.meal * meal + S.kcal * kcal + S.prot * prot))
        return Score(pct: pct, cover: Double(vals.count) / Double(timed.count), meal: meal, kcal: kcal, prot: prot)
    }
    /// Gün halkası: puan × kaydedilen öğün oranı.
    public func dayFill(_ k: String) -> Double { dayScore(k).map { jsRound($0.pct * $0.cover) } ?? 0 }

    public func quotaUsed(_ k: String, _ mealId: String, _ g: String) -> Int {
        DayKey.week(of: k).filter { mainById(mainLock($0, mealId))?.g == g }.count
    }

    // MARK: Telafi

    public struct Why: Equatable { public var meal: String; public var item: PlanItem; public var miss: Double; public var skip: Bool }
    public struct Ledger: Equatable { public var gk = 0.0, gp = 0.0, paid = 0.0; public var G: [String: Double] = [:]; public var why: [String: [Why]] = [:]
        /// why'a giren grupların sırası (JavaScript nesnesinin anahtar sırası).
        public var whyKeys: [String] = [] }
    static let adjGroup = ["x-prot": "prot", "x-ekmek": "carb", "x-ara": "fruit"]

    /// Kapanmış öğünlerin plana göre farkı ve besin grubu başına karşılanmamış kcal (web: ledger).
    public func ledger(_ k: String) -> Ledger {
        var L = Ledger()
        let ex = extras(k)
        let has: (Plan.Meal) -> Bool = { m in ex.contains { $0.meal == m.id } || itemsOf(m, k).contains { status(k, m, $0) != nil } }
        for (mi, m) in plan.meals.enumerated() {
            let its = itemsOf(m, k).filter { !$0.optional }, open = its.contains { status(k, m, $0) == nil }
            if open && !plan.meals[(mi + 1)...].contains(where: has) { continue }
            for it in its {
                guard let st = status(k, m, it) else { continue }
                let g = grpOf(it), a = ateOf(it, st), by = ateBy(it, st, a, g)
                L.gk += it.k - a.k; L.gp += it.p - a.p; L.G[g, default: 0] += it.k
                for (x, v) in by { L.G[x, default: 0] -= v }
                let miss = it.k - (by[g] ?? 0)
                if miss >= 20 { if L.why[g] == nil { L.whyKeys.append(g) }; L.why[g, default: []].append(Why(meal: m.id, item: it, miss: miss, skip: st.isSkip)) }
            }
            for e in ex where e.meal == m.id && !(e.adj && open) {
                L.gk -= e.k; L.gp -= e.p; if e.adj { L.paid += e.k }
                var by: [String: Double] = [:]
                Engine.spread(&by, e.adj ? [Engine.adjGroup[e.id] ?? ""] : Groups.of(e.name), e.k)
                for (x, v) in by { L.G[x, default: 0] -= v }
            }
        }
        return L
    }

    public struct Add: Equatable { public var meal: String, id: String, name: String; public var k: Double, p: Double; public var why: String; public var off: Bool; public var xi: Int }
    public struct Over: Equatable { public var name: String; public var k: Double, p: Double }
    public struct Adjust: Equatable { public var adds: [Add] = []; public var over: [String: Over] = [:]; public var why = ""; public var note = "" }

    static func jsNum(_ x: Double) -> String { x.rounded() == x ? String(Int(x)) : String(x) }

    /// Telafi: yalnızca gerçek eksiğe, aynı besin grubundan; fazlada kısma (web: adjust).
    public func adjust(_ k: String) -> Adjust {
        var out = Adjust()
        let b = balance(k)
        if k != today || !b.any || !tuneOn { return out }
        var meals: [Plan.Meal] = []
        for o in b.open { if let m = plan.meals.first(where: { $0.id == o.meal }), !meals.contains(where: { $0.id == m.id }), !(m.time ?? "").isEmpty { meals.append(m) } }
        if meals.isEmpty { return out }
        let L = ledger(k), ex = extras(k), no = peek(k).raw["noadj"]?.object ?? [:]
        var gk = L.gk, gp = L.gp

        func reason(_ gs: [String]) -> String {
            let xs = gs.filter { (L.G[$0] ?? 0) > 0 }.flatMap { L.why[$0] ?? [] }.stableSorted { $0.miss > $1.miss }
            var order: [String] = [], by: [String: [Why]] = [:]
            for x in xs { if by[x.meal] == nil { order.append(x.meal) }; by[x.meal, default: []].append(x) }
            return order.prefix(2).map { mid -> String in
                let m = plan.meals.first { $0.id == mid }!, s = mealStat(m, k), list = by[mid]!
                if s.skip == s.total { return "\(m.title) atlandı" }
                let names = list.prefix(2).map { lc($0.item.chip ?? $0.item.name) }.joined(separator: ", ")
                return "\(m.title): \(names) \(list.allSatisfy(\.skip) ? "atlandı" : "eksik")"
            }.joined(separator: " · ")
        }
        func mealAt(_ at: [String]) -> Plan.Meal? {
            for a in at {
                let m = a == "main" ? meals.first(where: \.main) : a == "first" ? meals.first : a == "last" ? meals.last : meals.first { $0.id == a }
                if let m { return m }
            }
            return nil
        }
        func add(_ meal: Plan.Meal, _ id: String, _ name: String, _ kk: Double, _ pp: Double, _ why: String) {
            if L.paid >= 250 { return }
            out.adds.append(Add(meal: meal.id, id: id, name: name, k: kk, p: pp, why: why, off: no[id]?.truthy ?? false, xi: -1)); gk -= kk; gp -= pp
        }
        func offer(_ x: Tune.Add, _ id: String, _ gap: Double, _ per: Double, _ why: String) -> Bool {
            guard let m = mealAt(x.at) else { return false }
            let n = x.max.map { Swift.min($0, Swift.max(1, jsRound(gap / per))) } ?? 1
            let name = x.name.replacingFirst("{n}", Engine.jsNum(n)).replacingFirst("{g}", Engine.jsNum(n * (x.g ?? 1)))
            add(m, id, name, x.k * n, x.p * n, why); return true
        }
        let num: (Double) -> String = { TR.num(jsRound($0)) }
        if (gp >= 8 || ((L.G["prot"] ?? 0) >= 70 && gp >= 4)) && gk > -100 {
            let r = reason(["prot"]), w = r.isEmpty ? "Bugün protein \(num(gp)) g eksik" : r
            for x in tune.protein { if offer(x, "x-prot", gp, x.p, w) { break } }
        }
        if let c = tune.carb, (L.G["carb"] ?? 0) >= 50, gk >= 60 { _ = offer(c, "x-ekmek", min(L.G["carb"] ?? 0, gk), c.k, reason(["carb"])) }
        if let s = tune.snack, gk >= 150 {
            var w = reason(["fat", "fruit", "dairy", "veg", ""])
            if w.isEmpty { w = reason(L.whyKeys) }
            if w.isEmpty { w = "Bugün \(num(gk)) kcal eksik" }
            _ = offer(s, "x-ara", gk, s.k, w)
        }
        for i in out.adds.indices { out.adds[i].xi = ex.firstIndex { $0.adj && $0.id == out.adds[i].id && $0.meal == out.adds[i].meal } ?? -1 }
        if gk <= -120 {
            var need = -gk, cut = 0.0
            for c in tune.cuts { for o in b.open {
                if o.item.id != c.item || need < 40 || cut >= 300 { continue }
                out.over[o.key] = Over(name: c.name, k: o.item.k - c.k, p: o.item.p - c.p); need -= c.k; cut += c.k
            } }
            if cut != 0 { out.why = "Fazlayı dengelemek için azaltıldı" }
            if need >= 150 { out.note = "Fazlanın kalanını telafi etmeye çalışma; yarın programa normal devam et." }
        }
        return out
    }

}

func lc(_ s: String) -> String { guard let f = s.first else { return s }; return String(f).lowercased(with: TR.locale) + s.dropFirst() }

extension String {
    func replacingFirst(_ a: String, _ b: String) -> String {
        guard let r = range(of: a) else { return self }
        return replacingCharacters(in: r, with: b)
    }
}
