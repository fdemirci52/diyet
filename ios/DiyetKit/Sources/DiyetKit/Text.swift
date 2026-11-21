import Foundation

/// Türkçe metin yardımcıları (web: fold, num, num1).
public enum TR {
    static let locale = Locale(identifier: "tr_TR")

    /// Arama ve eşleştirme için: küçük harf, Türkçe harfler ASCII'ye, harf ve rakam dışı tek boşluk.
    public static func fold(_ s: String) -> String {
        let map: [Character: Character] = ["ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u"]
        let low = s.lowercased(with: locale)
        var out = "", space = false
        for ch in low {
            let c = map[ch] ?? ch
            if c.isASCII && (c.isLetter || c.isNumber) { if space && !out.isEmpty { out.append(" ") }; out.append(c); space = false }
            else { space = true }
        }
        return out
    }

    /// Ondalıklı sayı, Türkçe virgülle: 82,3. `digits` sabit basamak sayısı.
    public static func num(_ n: Double, digits: Int = 0) -> String {
        let f = NumberFormatter(); f.locale = locale; f.numberStyle = .decimal
        f.minimumFractionDigits = digits; f.maximumFractionDigits = digits
        return f.string(from: NSNumber(value: n)) ?? String(n)
    }

    /// Baş harfi büyük (Türkçe i/İ).
    public static func cap(_ s: String) -> String {
        guard let f = s.first else { return s }
        return String(f).uppercased(with: locale) + s.dropFirst()
    }
}
