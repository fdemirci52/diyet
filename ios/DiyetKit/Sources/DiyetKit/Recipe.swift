import Foundation

/// Diyetisyenin tarifi (plan.recipes). Fotoğraftan aktarmada tarif sayfasından gelir.
/// k: kâğıtta yazan kalori (yoksa 0), serve: bir öğünlük miktar ("8 yemek kaşığı"), ings: malzemeler miktarıyla,
/// steps: yapılışı düz metin.
public struct Recipe: Codable, Hashable, Sendable, Identifiable {
    public var name: String
    public var k: Double
    public var serve: String
    public var ings: [String]
    public var steps: String
    public var id: String { TR.fold(name) }

    public init(name: String, k: Double = 0, serve: String = "", ings: [String], steps: String) {
        self.name = name; self.k = k; self.serve = serve; self.ings = ings; self.steps = steps
    }
    enum CodingKeys: String, CodingKey { case name, k, serve, ings, steps }
    public init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        k = try c.decodeIfPresent(Double.self, forKey: .k) ?? 0
        serve = try c.decodeIfPresent(String.self, forKey: .serve) ?? ""
        ings = try c.decodeIfPresent([String].self, forKey: .ings) ?? []
        steps = try c.decodeIfPresent(String.self, forKey: .steps) ?? ""
    }

    /// Malzeme: miktar ve ad ayrı; miktar tarifin katıyla ölçeklenir.
    public struct Ingredient: Equatable, Sendable, Identifiable {
        public var name: String
        public var qty: Double?
        public var unit: String
        public var id: String { TR.fold(name) }

        /// "2 adet", "1 su bardağı", "½ adet"; miktarı yoksa boş.
        public func amount(times q: Double = 1) -> String {
            guard let v = qty else { return unit }
            let x = v * q
            let s = unit == "g" || unit == "ml" ? TR.num(x.rounded()) : Recipe.frac(x)
            return unit.isEmpty ? s : "\(s) \(unit)"
        }
    }

    static let units: [(String, String)] = [
        ("su bardağı", "su bardağı"), ("çay bardağı", "çay bardağı"), ("yemek kaşığı", "yemek kaşığı"), ("tatlı kaşığı", "tatlı kaşığı"),
        ("çay kaşığı", "çay kaşığı"), ("gram", "g"), ("gr", "g"), ("g", "g"), ("kg", "kg"), ("ml", "ml"), ("litre", "litre"), ("adet", "adet"),
        ("yk", "yemek kaşığı"), ("tk", "tatlı kaşığı"), ("çk", "çay kaşığı"), ("kase", "kase"), ("dilim", "dilim"), ("demet", "demet"),
        ("tutam", "tutam"), ("avuç", "avuç"), ("paket", "paket"), ("kutu", "kutu"), ("diş", "diş"), ("sap", "sap"), ("çubuk", "çubuk"),
    ]

    public static func frac(_ x: Double) -> String {
        let v = (x * 4).rounded() / 4, w = Int(v), f = v - Double(w)
        let fs = f == 0.25 ? "¼" : f == 0.5 ? "½" : f == 0.75 ? "¾" : ""
        return w == 0 ? (fs.isEmpty ? "0" : fs) : "\(w)\(fs)"
    }

    /// "2 adet domates" → 2, adet, Domates · "Yarım limon" → 0,5, adet, Limon · "Tuz" → nil, "", Tuz.
    public static func parse(_ s: String) -> Ingredient {
        var rest = s.trimmingCharacters(in: .whitespaces), qty: Double?
        let low = rest.lowercased(with: TR.locale)
        if low.hasPrefix("yarım ") { qty = 0.5; rest = String(rest.dropFirst(6)) }
        else {
            var num = ""
            for ch in rest { if ch.isNumber || ch == "," || ch == "." || "½¼¾/".contains(ch) { num.append(ch) } else { break } }
            if !num.isEmpty {
                let fr: [Character: Double] = ["½": 0.5, "¼": 0.25, "¾": 0.75]
                var v = 0.0, digits = ""
                for ch in num { if let f = fr[ch] { v += f } else { digits.append(ch) } }
                if digits.contains("/") { let p = digits.split(separator: "/").compactMap { Double($0) }; if p.count == 2, p[1] != 0 { v += p[0] / p[1] } }
                else if let d = Double(digits.replacingOccurrences(of: ",", with: ".")) { v += d }
                qty = v; rest = String(rest.dropFirst(num.count)).trimmingCharacters(in: .whitespaces)
            }
        }
        var unit = ""
        if qty != nil {
            let l = rest.lowercased(with: TR.locale)
            for (u, norm) in units where l == u || l.hasPrefix(u + " ") { unit = norm; rest = String(rest.dropFirst(u.count)).trimmingCharacters(in: .whitespaces); break }
            if unit.isEmpty { unit = "adet" }
        }
        return Ingredient(name: TR.cap(rest), qty: qty, unit: unit)
    }

    public var ingredients: [Ingredient] { ings.map(Recipe.parse) }

    /// Yapılış cümlelere bölünür; her cümle bir adım.
    public var stepList: [String] {
        var out: [String] = [], cur = ""
        let chars = Array(steps)
        for (i, ch) in chars.enumerated() {
            cur.append(ch)
            if ".!?".contains(ch), i + 1 < chars.count, chars[i + 1] == " ", !(chars.indices.contains(i - 1) && chars[i - 1].isNumber) {
                let t = cur.trimmingCharacters(in: .whitespaces); if !t.isEmpty { out.append(t) }; cur = ""
            }
        }
        let t = cur.trimmingCharacters(in: .whitespaces); if !t.isEmpty { out.append(t) }
        return out
    }

    /// Adımda geçen malzemeler: adın ilk sözcüğünün kökü adımda geçiyorsa.
    public func ingredients(in step: String) -> [Ingredient] {
        let f = TR.fold(step)
        return ingredients.filter { ing in
            guard let w = TR.fold(ing.name).split(separator: " ").first else { return false }
            let stem = String(w.prefix(max(4, w.count - 2)))
            return f.contains(stem)
        }
    }

    /// Programdaki bir ana yemek ya da kalem adı bu tarife mi ait: tarif adının sözcüklerinin hepsi geçiyorsa.
    public func matches(_ dish: String) -> Bool {
        let d = TR.fold(dish), words = TR.fold(name).split(separator: " ").map { String($0.prefix(max(4, $0.count - 2))) }
        return !words.isEmpty && words.allSatisfy { d.contains($0) }
    }
}
