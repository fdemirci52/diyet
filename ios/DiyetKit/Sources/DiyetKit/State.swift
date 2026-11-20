import Foundation

/// Kullanıcının kayıtları: web'deki localStorage['diyet-v1'] ile aynı biçim
/// ({ days: { 'YYYY-MM-DD': gün }, weights, foods, supps, … }). Eşitlemede web ile birebir aynı belgeler
/// gider gelir; bu yüzden durum `JSON` olarak tutulur ve iOS'un tanımadığı alanlar olduğu gibi korunur.
public struct DiyetState: Equatable, Sendable {
    public var raw: JSON

    public init(raw: JSON = .object(["days": .object([:]), "weights": .array([])])) {
        var r = raw
        if r["days"]?.object == nil { r["days"] = .object([:]) }
        if r["weights"]?.array == nil { r["weights"] = .array([]) }
        self.raw = r
    }

    public var dayKeys: [String] { (raw["days"]?.object ?? [:]).keys.sorted() }

    /// web: peek. Kayıt yoksa boş gün döner, duruma yazılmaz.
    public func day(_ k: String) -> Day { raw["days"]?[k].map(Day.init) ?? Day() }

    /// web: day. Günü değiştirir ve geri yazar.
    public mutating func update(_ k: String, _ f: (inout Day) -> Void) {
        var d = day(k); f(&d)
        var days = raw["days"]?.object ?? [:]
        days[k] = d.raw; raw["days"] = .object(days)
    }

    public var weights: [(d: String, kg: Double)] {
        (raw["weights"]?.array ?? []).compactMap { w in w["d"]?.string.flatMap { d in w["kg"]?.double.map { (d, $0) } } }
    }
}

/// Bir günün kaydı. EMPTY: { items: {}, main: {}, mode: {}, extras: [], water: 0, coffee: 0, walk: false }.
public struct Day: Equatable, Sendable {
    public var raw: JSON
    public init(_ raw: JSON = .object(["items": .object([:]), "main": .object([:]), "mode": .object([:]), "extras": .array([]), "water": .number(0), "coffee": .number(0), "walk": .bool(false)])) { self.raw = raw }

    /// Kalem durumu, anahtar 'ogun.oge': { s: 'done' | 'skip' | 'swap', … }.
    public func item(_ id: String) -> JSON? { raw["items"]?[id] }
    public func status(_ id: String) -> String? { item(id)?["s"]?.string }
    public mutating func setItem(_ id: String, _ v: JSON?) {
        var o = raw["items"]?.object ?? [:]; o[id] = v; raw["items"] = .object(o)
    }

    public var water: Int {
        get { raw["water"]?.int ?? 0 }
        set { raw["water"] = .number(Double(max(0, newValue))) }
    }
    public var coffee: Int {
        get { raw["coffee"]?.int ?? 0 }
        set { raw["coffee"] = .number(Double(max(0, newValue))) }
    }
    public var walk: Bool { get { raw["walk"]?.truthy ?? false } set { raw["walk"] = .bool(newValue) } }
    public var gym: Bool { get { raw["gym"]?.truthy ?? false } set { raw["gym"] = .bool(newValue) } }
    public var extras: [JSON] { raw["extras"]?.array ?? [] }
}
