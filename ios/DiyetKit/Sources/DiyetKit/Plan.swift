import Foundation

/// Diyetisyen programı (plan.js sözleşmesi, v: 1). Web uygulamasındaki planCheck'in eksik alanları doldurma
/// davranışına uyar: isteğe bağlı bölümler yoksa boş kabul edilir. Tipli karşılığı olmayan bölümler `JSON` kalır.
public struct Plan: Decodable, Sendable {
    public struct Item: Decodable, Sendable {
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

        enum CodingKeys: String, CodingKey { case name, chip, meta, k, p, opts, subs, sugg, optional, grp }
        public init(from d: Decoder) throws {
            let c = try d.container(keyedBy: CodingKeys.self)
            name = try c.decode(String.self, forKey: .name)
            chip = try c.decodeIfPresent(String.self, forKey: .chip)
            meta = try c.decodeIfPresent(String.self, forKey: .meta)
            k = try c.decodeIfPresent(Double.self, forKey: .k) ?? 0
            p = try c.decodeIfPresent(Double.self, forKey: .p) ?? 0
            opts = try c.decodeIfPresent([String].self, forKey: .opts) ?? []
            subs = try c.decodeIfPresent([String].self, forKey: .subs) ?? []
            sugg = try c.decodeIfPresent([String].self, forKey: .sugg) ?? []
            optional = try c.decodeIfPresent(Bool.self, forKey: .optional) ?? false
            grp = try c.decodeIfPresent(String.self, forKey: .grp)
        }
    }

    public struct Meal: Decodable, Sendable, Identifiable {
        public var id: String
        public var title: String
        public var time: String?
        public var wknd: String?
        public var items: [String]
        public var alt: [String]?
        public var days: [[String]]?
        public var main: Bool
        public var modes: [String]?
        /// Döngülü programda o güne özel saat ('' = hafta içi / hafta sonu saati).
        public var dtime: [String]?

        enum CodingKeys: String, CodingKey { case id, title, time, wknd, items, alt, days, main, modes, dtime }
        public init(from d: Decoder) throws {
            let c = try d.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            title = try c.decode(String.self, forKey: .title)
            time = try c.decodeIfPresent(String.self, forKey: .time)
            wknd = try c.decodeIfPresent(String.self, forKey: .wknd)
            items = try c.decodeIfPresent([String].self, forKey: .items) ?? []
            alt = try c.decodeIfPresent([String].self, forKey: .alt)
            days = try c.decodeIfPresent([[String]].self, forKey: .days)
            main = (try? c.decodeIfPresent(Bool.self, forKey: .main)) ?? false
            modes = try? c.decodeIfPresent([String].self, forKey: .modes)
            dtime = try? c.decodeIfPresent([String].self, forKey: .dtime)
        }
    }

    public struct Main: Decodable, Sendable {
        public var id, g, name: String; public var k, p: Double; public var chip, meta, ai: String?; public var subs: [String]?
        /// Bu yemek seçilince öğünden çıkan kalemler; eski noSalad = ["salata"].
        public var drop: [String]?; public var noSalad: Bool?
        public var dropped: [String] { drop ?? (noSalad == true ? ["salata"] : []) }
    }
    public struct Group: Decodable, Sendable { public var name: String; public var perWeek: Int }
    public struct Cycle: Decodable, Sendable { public var n: Int; public var start: String }
    public struct Dietitian: Decodable, Sendable { public var name = ""; public var phone = "" }
    public struct Prefs: Decodable, Sendable { public var kcal = true; public var tune = true }
    public struct Goal: Decodable, Sendable { public var kg: Double = 0; public var text = "" }

    public var v: Int
    public var id: String?
    public var date: String
    public var dietitian: Dietitian
    public var prefs: Prefs
    public var goal: Goal
    public var items: [String: Item]
    public var meals: [Meal]
    public var mains: [Main]
    public var groups: [String: Group]
    public var rota: [String: [String]]
    public var rules: [[String]]
    public var swaps: [[String]]
    public var cycle: Cycle?
    public var body: JSON?
    public var daily: JSON?
    public var training: JSON?
    public var tune: JSON?
    public var recipes: [Recipe]

    enum CodingKeys: String, CodingKey { case v, id, date, dietitian, prefs, goal, items, meals, mains, groups, rota, rules, swaps, cycle, body, daily, training, tune, recipes }
    public init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        v = try c.decode(Int.self, forKey: .v)
        guard v == 1 else { throw PlanError.invalid("Program biçimi tanınmadı.") }
        id = try c.decodeIfPresent(String.self, forKey: .id)
        date = try c.decodeIfPresent(String.self, forKey: .date) ?? ""
        dietitian = (try? c.decodeIfPresent(Dietitian.self, forKey: .dietitian)) ?? Dietitian()
        prefs = (try? c.decodeIfPresent(Prefs.self, forKey: .prefs)) ?? Prefs()
        goal = (try? c.decodeIfPresent(Goal.self, forKey: .goal)) ?? Goal()
        items = try c.decode([String: Item].self, forKey: .items)
        meals = try c.decode([Meal].self, forKey: .meals)
        mains = try c.decodeIfPresent([Main].self, forKey: .mains) ?? []
        groups = try c.decodeIfPresent([String: Group].self, forKey: .groups) ?? [:]
        rota = try c.decodeIfPresent([String: [String]].self, forKey: .rota) ?? [:]
        rules = try c.decodeIfPresent([[String]].self, forKey: .rules) ?? []
        swaps = try c.decodeIfPresent([[String]].self, forKey: .swaps) ?? []
        cycle = try c.decodeIfPresent(Cycle.self, forKey: .cycle)
        body = try c.decodeIfPresent(JSON.self, forKey: .body)
        daily = try c.decodeIfPresent(JSON.self, forKey: .daily)
        training = try c.decodeIfPresent(JSON.self, forKey: .training)
        tune = try c.decodeIfPresent(JSON.self, forKey: .tune)
        recipes = (try? c.decodeIfPresent([Recipe].self, forKey: .recipes)) ?? []
        if let e = check() { throw PlanError.invalid(e) }
    }

    /// web: planCheck. Kimlik bağlarını denetler; hata varsa açıklamasını döndürür.
    public func check() -> String? {
        if meals.isEmpty { return "Programda öğün yok." }
        if let c = cycle {
            if !(2...14).contains(c.n) || DayKey.date(c.start) == nil { return "Programın gün döngüsü tanınmadı." }
            for m in meals { if let ds = m.days, ds.count != c.n { return "\"\(m.title)\" öğününün günleri eksik." } }
        }
        for m in meals {
            for id in m.items + (m.alt ?? []) + (m.days ?? []).flatMap({ $0 }).filter({ !(m.main && $0 == "ana") }) where items[id] == nil {
                return "\"\(m.title)\" öğünündeki \"\(id)\" kalemi katalogda yok."
            }
            if m.main {
                if mains.isEmpty { return "Ana yemek listesi boş." }
                guard let r = rota[m.id], r.count == 7, r.allSatisfy({ id in mains.contains { $0.id == id } }) else { return "\"\(m.title)\" için haftalık dağılım eksik." }
            }
        }
        for x in mains where groups[x.g] == nil { return "\"\(x.name)\" ana yemeğinin kota grubu yok." }
        return nil
    }

    public static func load(_ data: Data) throws -> Plan { try JSONDecoder().decode(Plan.self, from: data) }

    /// Döngülü programda k gününün program günü (0'dan). Gün farkı takvim günüyle sayılır.
    public func cycleIndex(_ key: String) -> Int? {
        guard let c = cycle, let a = DayKey.date(c.start), let b = DayKey.date(key) else { return nil }
        let n = Calendar(identifier: .gregorian).dateComponents([.day], from: a, to: b).day ?? 0
        return ((n % c.n) + c.n) % c.n
    }

    /// web: itemsOf (ana yemek dağıtımı hariç): o günün kalem kimlikleri.
    public func itemIDs(_ meal: Meal, on key: String) -> [String] {
        if let ds = meal.days, let i = cycleIndex(key), i < ds.count { return ds[i] }
        return meal.items
    }
}

public enum PlanError: Error, LocalizedError {
    case invalid(String)
    public var errorDescription: String? { if case .invalid(let s) = self { return s }; return nil }
}
