import SwiftUI
import WatchKit

final class WatchAppDelegate: NSObject, WKApplicationDelegate {
  func applicationDidFinishLaunching() {
    WatchModel.shared.activate()
  }
}

@main
struct ZikruWatchApp: App {
  @WKApplicationDelegateAdaptor(WatchAppDelegate.self) var delegate

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(WatchModel.shared)
    }
  }
}

struct RootView: View {
  var body: some View {
    TabView {
      PrayerPage()
      TasbihPage()
    }
    .tabViewStyle(.verticalPage)
  }
}

struct PrayerPage: View {
  @EnvironmentObject private var model: WatchModel

  var body: some View {
    TimelineView(.periodic(from: .now, by: 1)) { ctx in
      let now = ctx.date
      ScrollView {
        VStack(alignment: .leading, spacing: 6) {
          if let snap = model.snapshot, let day = snap.day(at: now) {
            Text("Prières")
              .font(.caption2)
              .foregroundStyle(Color.zikruGold)
            if let next = snap.next(after: now) {
              Text(snap.label(next.key))
                .font(.title3.bold())
              Text(snap.ar[next.key] ?? "")
                .font(.title3)
                .frame(maxWidth: .infinity, alignment: .trailing)
              Text(countdownLabel(until: next.at, now: now))
                .font(.title2.monospacedDigit())
                .foregroundStyle(Color.zikruGold)
            } else {
              Text("Horaires à rafraîchir")
                .font(.headline)
              Text("Ouvrez Zikru sur l’iPhone.")
                .font(.caption2)
            }
            Text(snap.place)
              .font(.caption2)
              .foregroundStyle(.secondary)
            ForEach(day.prayers) { p in
              HStack {
                Text(snap.label(p.key))
                Spacer()
                Text(hhmm(p.at)).monospacedDigit()
              }
              .font(.caption)
              .foregroundStyle(p.at < now ? .secondary : .primary)
            }
            Text("Signal court : Jarih, CC BY-SA 3.0. Pas la voix complète.")
              .font(.system(size: 9))
              .foregroundStyle(.secondary)
          } else {
            Text("Zikru")
              .font(.headline)
              .foregroundStyle(Color.zikruGold)
            Text("Ouvrez Zikru sur l’iPhone pour envoyer les horaires.")
              .font(.caption)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
  }
}

struct TasbihPage: View {
  @EnvironmentObject private var model: WatchModel

  var body: some View {
    VStack(spacing: 4) {
      if let item = model.dhikr {
        Text("Tasbih")
          .font(.caption2)
          .foregroundStyle(Color.zikruGold)
        Text(item.ar)
          .font(.title3)
          .multilineTextAlignment(.center)
          .minimumScaleFactor(0.5)
          .frame(maxWidth: .infinity)
        if !item.tr.isEmpty {
          Text(item.tr)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
        Text("\(model.count)")
          .font(.system(size: 44, weight: .semibold, design: .rounded))
          .monospacedDigit()
        Text("Objectif \(item.target)")
          .font(.caption2)
        if item.example {
          Text("Exemple")
            .font(.caption2)
            .foregroundStyle(Color.zikruGold)
        }
        Button(model.reached ? "Objectif atteint" : "Touchez pour compter") {
          model.tap()
        }
        .buttonStyle(.borderedProminent)
        .tint(Color.zikruGreen)
        HStack {
          Button("Autre") { model.nextDhikr() }
          Button("Zéro") { model.reset() }
        }
        .font(.caption2)
        .buttonStyle(.bordered)
      } else {
        Text("Tasbih")
          .font(.headline)
        Text("Les formules arrivent avec les horaires, depuis l’iPhone.")
          .font(.caption)
      }
    }
  }
}

extension Color {
  static let zikruGreen = Color(red: 15 / 255, green: 61 / 255, blue: 48 / 255)
  static let zikruGold = Color(red: 217 / 255, green: 182 / 255, blue: 92 / 255)
}
