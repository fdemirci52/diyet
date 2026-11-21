import Foundation

/// 'YYYY-MM-DD' gün anahtarları, cihazın yerel takviminde (web: key, parse, addDays).
public enum DayKey {
    static let cal: Calendar = { var c = Calendar(identifier: .gregorian); c.firstWeekday = 2; return c }()

    public static func key(_ d: Date) -> String {
        let c = cal.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }
    public static func date(_ k: String) -> Date? {
        let p = k.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3, k.count == 10 else { return nil }
        return cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
    }
    public static func add(_ k: String, _ n: Int) -> String { key(cal.date(byAdding: .day, value: n, to: date(k)!)!) }
    public static var today: String { key(Date()) }
    /// Pazartesiden başlayan hafta.
    public static func week(of k: String) -> [String] {
        let wd = cal.component(.weekday, from: date(k)!), off = (wd + 5) % 7
        return (0..<7).map { add(k, $0 - off) }
    }
    public static func isWeekend(_ k: String) -> Bool { [1, 7].contains(cal.component(.weekday, from: date(k)!)) }
}
