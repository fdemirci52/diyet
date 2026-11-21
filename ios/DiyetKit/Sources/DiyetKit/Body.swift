import Foundation

/// Bir vücut analizi ölçümü (Tanita MC-780MA kâğıdı ya da elle). Kayıtta `S.scans` dizisinde, tarihe göre.
/// Bütün alanlar isteğe bağlı: kâğıtta okunamayan değer yok sayılır. kg ve oranlar kâğıttaki gibi.
public struct Scan: Codable, Equatable, Sendable, Identifiable {
    /// Bölgesel satır: ad, kas kg, yağ kg ("Gövde", "Sağ kol", …).
    public struct Region: Codable, Equatable, Sendable { public var n: String; public var kas: Double; public var yag: Double
        public init(_ n: String, _ kas: Double, _ yag: Double) { self.n = n; self.kas = kas; self.yag = yag } }

    public var d: String
    public var kg: Double?
    public var fat: Double?        // yağ kg
    public var fatPct: Double?     // yağ oranı %
    public var muscle: Double?     // kas kg
    public var lean: Double?       // yağsız kütle kg
    public var water: Double?      // sıvı kg
    public var waterPct: Double?
    public var protein: Double?
    public var mineral: Double?
    public var visceral: Double?   // iç yağlanma
    public var waist: Double?      // bel cm
    public var height: Double?     // boy cm
    public var bmr: Double?        // bazal metabolizma kcal
    public var metaAge: Double?
    public var seg: [Region]?
    /// Cihazın kâğıda bastığı aralıklar: "fatPct": [14, 23], "waterPct": [55, 66], "visceral": [1, 13].
    public var rng: [String: [Double]]?
    /// Ölçüm saati ("14:41") ve kaynak ("Tanita MC-780MA").
    public var at: String?
    public var src: String?

    public var id: String { d }

    public init(d: String) { self.d = d }

    /// Gövde yağı: bölgesel tablonun gövde satırı.
    public var trunkFat: Double? { seg?.first { TR.fold($0.n).hasPrefix("govde") }?.yag }
    /// Kemik ve diğer: yağsız kütle − kas.
    public var bone: Double? { lean.flatMap { l in muscle.map { l - $0 } } }
    public var waistToHeight: Double? { waist.flatMap { w in height.map { w / $0 } } }
}

/// Ben ekranının anlattığı hikâye: değişim sözle, kırmızı-yeşil ve yüzde yok.
public enum BodyStory {
    static func r1(_ x: Double) -> Double { (x * 10).rounded() / 10 }

    /// "0,5 kg az", "1 cm fazla", "aynı".
    public static func word(_ d: Double, unit: String, digits: Int = 1) -> String {
        if abs(d) < (digits == 0 ? 0.5 : 0.05) { return "aynı" }
        return "\(TR.num(abs(d), digits: digits)) \(unit) \(d < 0 ? "az" : "fazla")"
    }

    /// Tartıdaki farkın parçaları: yağ, su ve kalanı (kas, kemik, mide içeriği…).
    public struct Split: Equatable, Sendable {
        public var total: Double, fat: Double, water: Double, other: Double
        public var parts: [(name: String, d: Double)] { [("Yağ", fat), ("Su", water), ("Diğer", other)] }
        public static func == (a: Split, b: Split) -> Bool { a.total == b.total && a.fat == b.fat && a.water == b.water && a.other == b.other }
    }

    public static func split(_ a: Scan, since p: Scan) -> Split? {
        guard let k1 = a.kg, let k0 = p.kg, let f1 = a.fat, let f0 = p.fat, let w1 = a.water, let w0 = p.water else { return nil }
        let t = r1(k1 - k0), f = r1(f1 - f0), w = r1(w1 - w0)
        return Split(total: t, fat: f, water: w, other: r1(t - f - w))
    }

    /// Farkı kısaca açıklayan cümle; kilo artmış ama yağ azalmışsa önce onu söyler.
    public static func why(_ s: Split, muscle: Double?) -> String {
        if s.total > 0 && s.fat < 0 {
            return "Yağ \(word(s.fat, unit: "kg")) oldu; tartıdaki artış sudan ve diğerlerinden geliyor. Vücuttaki su haftadan haftaya 1-2 kg oynayabilir."
        }
        var t = "İlk haftalarda tartıdaki düşüşün çoğu su olur; yağ ayrı sayılır."
        if let m = muscle, m < -0.05, s.water < 0 {
            t += " Kas da \(word(m, unit: "kg")) görünüyor: tartı kası suyuyla birlikte ölçer ve aynı hafta su \(word(s.water, unit: "kg")) oldu."
        }
        return t
    }
}

extension DiyetState {
    /// Vücut analizi ölçümleri, eskiden yeniye.
    public var scans: [Scan] {
        get {
            guard let a = raw["scans"], let d = try? JSONEncoder().encode(a), let s = try? JSONDecoder().decode([Scan].self, from: d) else { return [] }
            return s.sorted { $0.d < $1.d }
        }
        set {
            let s = newValue.sorted { $0.d < $1.d }
            if let d = try? JSONEncoder().encode(s), let j = try? JSONDecoder().decode(JSON.self, from: d) { raw["scans"] = j }
        }
    }
}
