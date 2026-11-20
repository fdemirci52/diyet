import XCTest
@testable import DiyetKit

final class ModelTests: XCTestCase {
    func planData() throws -> Data { try Data(contentsOf: Bundle.module.url(forResource: "plan", withExtension: "json")!) }

    func testDefaultPlanLoads() throws {
        let p = try Plan.load(try planData())
        XCTAssertEqual(p.v, 1)
        XCTAssertFalse(p.meals.isEmpty)
        XCTAssertNil(p.check())
        for m in p.meals { for id in m.items { XCTAssertNotNil(p.items[id]) } }
    }

    func testBrokenPlanIsRejected() throws {
        var o = try JSON.parse(String(decoding: try planData(), as: UTF8.self))
        var meals = o["meals"]!.array!; meals[0]["items"] = .array([.string("yok-boyle-kalem")]); o["meals"] = .array(meals)
        XCTAssertThrowsError(try Plan.load(Data(o.text().utf8)))
    }

    /// Web'in yazdığı kayıt iOS'ta okunup yazılınca tanınmayan alanlar kaybolmamalı.
    func testStateRoundTripKeepsUnknownFields() throws {
        let web = #"{"days":{"2026-11-18":{"items":{"kahvalti.peynir":{"s":"swap","sub":"1 yumurta","base":"1 yumurta","alt":1,"q":1,"k":75,"p":6.5},"kahvalti.ekmek":{"s":"done","o":1}},"main":{"ogle":"kofte"},"mode":{},"extras":[{"n":"Simit","k":280,"p":9,"src":{"n":"Simit","k":280,"p":9,"u":"1 adet"},"q":1}],"water":7,"coffee":1,"walk":true,"notes":{"ogle":"dışarıda"},"gelecek":{"x":[1,2]}}},"weights":[{"d":"2026-11-18","kg":92.4}],"foods":{"simit":{"n":"Simit","u":"1 adet","k":280,"p":9}},"supps":[{"id":"s1","n":"Omega 3","dose":"1 kapsül","at":"yat"}]}"#
        var s = DiyetState(raw: try JSON.parse(web))
        XCTAssertEqual(s.day("2026-11-18").water, 7)
        XCTAssertEqual(s.day("2026-11-18").status("kahvalti.peynir"), "swap")
        XCTAssertEqual(s.weights.first?.kg, 92.4)
        s.update("2026-11-18") { $0.water += 1 }
        XCTAssertEqual(s.day("2026-11-18").water, 8)
        var expect = try JSON.parse(web); expect["days"]?["2026-11-18"]?["water"] = .number(8)
        XCTAssertEqual(s.raw.text(), expect.text())
        XCTAssertEqual(s.day("2026-11-20").water, 0)
        XCTAssertFalse(s.dayKeys.contains("2026-11-20"))
    }

    func testDayKeys() {
        XCTAssertEqual(DayKey.add("2026-12-31", 1), "2027-01-01")
        XCTAssertEqual(DayKey.week(of: "2026-11-19").first, "2026-11-16")   // Perşembe → Pazartesi
        XCTAssertTrue(DayKey.isWeekend("2026-11-22"))
    }
}
