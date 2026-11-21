import SwiftUI
import DiyetKit

@main
struct DiyetApp: App {
    @State private var store = Store()
    var body: some Scene {
        WindowGroup {
            #if DEBUG
            // Motor DiyetKit'e taşınıp ekranlar gerçek veriye bağlanana kadar örnek veriyle çalışan kabuk.
            SofraGallery().environment(store)
            #else
            TodayView().environment(store)
            #endif
        }
    }
}
