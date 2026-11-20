// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "DiyetKit",
    defaultLocalization: "tr",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "DiyetKit", targets: ["DiyetKit"])],
    targets: [
        .target(name: "DiyetKit"),
        .testTarget(name: "DiyetKitTests", dependencies: ["DiyetKit"], resources: [.copy("plan.json")]),
    ]
)
