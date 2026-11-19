import SwiftUI

@main
struct ZikruWatchApp: App {
  @StateObject private var model = CounterModel()

  var body: some Scene {
    WindowGroup {
      CounterView(model: model)
        .onOpenURL { _ in model.quickStart() }
    }
  }
}
