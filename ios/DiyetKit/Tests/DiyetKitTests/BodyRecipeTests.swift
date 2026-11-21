import XCTest
@testable import DiyetKit

final class BodyRecipeTests: XCTestCase {
    func scan(_ d: String, kg: Double, fat: Double, water: Double, muscle: Double, trunk: Double) -> Scan {
        var s = Scan(d: d); s.kg = kg; s.fat = fat; s.water = water; s.muscle = muscle; s.seg = [.init("Gövde", 36, trunk)]; return s
    }

    func testSplitSaysFatAndWaterApart() throws {
        let a = scan("2026-11-13", kg: 83.9, fat: 12.2, water: 50.9, muscle: 68.2, trunk: 7.2)
        let b = scan("2026-11-20", kg: 82.3, fat: 11.6, water: 50.0, muscle: 67.2, trunk: 6.7)
        let s = try XCTUnwrap(BodyStory.split(b, since: a))
        XCTAssertEqual(s.total, -1.6); XCTAssertEqual(s.fat, -0.6); XCTAssertEqual(s.water, -0.9); XCTAssertEqual(s.other, -0.1)
        XCTAssertEqual(BodyStory.word(b.trunkFat! - a.trunkFat!, unit: "kg"), "0,5 kg az")
        XCTAssertEqual(BodyStory.word(85 - 86, unit: "cm", digits: 0), "1 cm az")
        XCTAssertEqual(BodyStory.word(0.02, unit: "kg"), "aynı")
        XCTAssertTrue(BodyStory.why(s, muscle: -1.0).contains("Kas da 1,0 kg az"))
    }

    func testHardWeekLeadsWithFat() throws {
        let a = scan("2026-11-13", kg: 96.4, fat: 30.1, water: 47.6, muscle: 62.4, trunk: 17.8)
        let b = scan("2026-11-20", kg: 96.8, fat: 29.7, water: 48.3, muscle: 63.1, trunk: 17.5)
        let s = try XCTUnwrap(BodyStory.split(b, since: a))
        XCTAssertTrue(BodyStory.why(s, muscle: 0.7).hasPrefix("Yağ 0,4 kg az"))
    }

    func testScansRoundTripInState() {
        var st = DiyetState()
        var s = Scan(d: "2026-11-20"); s.kg = 82.3; s.rng = ["fatPct": [14, 23]]
        st.scans = [s, Scan(d: "2026-11-13")]
        XCTAssertEqual(st.scans.map(\.d), ["2026-11-13", "2026-11-20"])
        XCTAssertEqual(st.scans.last?.kg, 82.3)
        XCTAssertEqual(st.raw["weights"]?.array?.count, 0)   // öteki alanlara dokunulmaz
    }

    func testIngredientParsing() {
        let r = Recipe(name: "Patlıcan musakka", serve: "8 yemek kaşığı", ings: ["2 adet domates", "500 gram kıyma", "Soğan", "Yarım limon", "1 su bardağı nohut", "1 yk zeytinyağı"],
                       steps: "Patlıcanları alacalı soy, 10 dk tuzlu suda beklet. Küçük doğrayıp 200 °C fırında 15 dk pişir. Soğan ve kıymayı kavur, domatesleri ekle.")
        let i = r.ingredients
        XCTAssertEqual(i[0].name, "Domates"); XCTAssertEqual(i[0].amount(), "2 adet"); XCTAssertEqual(i[0].amount(times: 0.5), "1 adet")
        XCTAssertEqual(i[1].name, "Kıyma"); XCTAssertEqual(i[1].amount(times: 2), "1.000 g")
        XCTAssertEqual(i[2].amount(), ""); XCTAssertEqual(i[3].amount(), "½ adet"); XCTAssertEqual(i[3].name, "Limon")
        XCTAssertEqual(i[4].amount(), "1 su bardağı"); XCTAssertEqual(i[5].unit, "yemek kaşığı")
        XCTAssertEqual(r.stepList.count, 3)
        XCTAssertEqual(r.ingredients(in: r.stepList[2]).map(\.name), ["Domates", "Kıyma", "Soğan"])
        XCTAssertTrue(r.matches("8 yk patlıcan musakka")); XCTAssertFalse(r.matches("4 ızgara köfte"))
    }
}
