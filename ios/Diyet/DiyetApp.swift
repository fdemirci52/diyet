import SwiftUI
import DiyetKit

@main
struct DiyetApp: App {
    @State private var store = Store()
    var body: some Scene {
        WindowGroup { TodayView().environment(store) }
    }
}
