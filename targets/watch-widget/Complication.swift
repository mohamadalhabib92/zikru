import WidgetKit
import SwiftUI

/// Même groupe que l’app montre. La complication ne fait aucun réseau : elle lit l’instantané local.
enum WatchBox {
  static let groupId = "group.com.vibecode.zikru-76mpdv.watch"
  static let snapshotKey = "zikru.watch.snapshot"
  static let widgetKind = "ZikruProgress"
}

private enum Ink {
  // #181818, accent crème #F7F4EE
  static let bg = Color(red: 0x18 / 255, green: 0x18 / 255, blue: 0x18 / 255)
  static let cream = Color(red: 0xF7 / 255, green: 0xF4 / 255, blue: 0xEE / 255)
}

struct ProgressSnap {
  var count: Int
  var goal: Int
  var done: Int
  var total: Int
  var lang: String
  var title: String

  static let empty = ProgressSnap(count: 0, goal: 33, done: 0, total: 0, lang: "fr", title: "Zikru")

  var en: Bool { lang == "en" }
  var action: String { en ? "Count" : "Compter" }
  var line: String {
    if goal > 0 { return "\(count)/\(goal)" }
    return "\(count)"
  }
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> SimpleEntry { SimpleEntry(date: Date(), snap: .empty) }

  func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
    completion(SimpleEntry(date: Date(), snap: load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
    // Pas de réveil périodique : l’app montre demande un rafraîchissement, au plus toutes les quelques secondes.
    completion(Timeline(entries: [SimpleEntry(date: Date(), snap: load())], policy: .never))
  }

  private func load() -> ProgressSnap {
    guard let data = UserDefaults(suiteName: WatchBox.groupId)?.data(forKey: WatchBox.snapshotKey),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return .empty }
    func num(_ key: String) -> Int {
      if let n = obj[key] as? Int { return n }
      if let n = obj[key] as? NSNumber { return n.intValue }
      return 0
    }
    return ProgressSnap(count: num("count"), goal: num("goal"), done: num("done"), total: num("total"), lang: (obj["lang"] as? String) == "en" ? "en" : "fr", title: (obj["title"] as? String) ?? "Zikru")
  }
}

struct SimpleEntry: TimelineEntry {
  let date: Date
  let snap: ProgressSnap
}

struct ComplicationView: View {
  @Environment(\.widgetFamily) private var family
  var entry: SimpleEntry

  var body: some View {
    let snap = entry.snap
    let link = URL(string: "zikru-watch://count")!
    Group {
      switch family {
      case .accessoryCircular:
        VStack(spacing: 0) {
          Text(snap.line).font(.system(.body, design: .rounded).monospacedDigit()).widgetAccentable()
          if snap.total > 0 { Text("\(snap.done)/\(snap.total)").font(.caption2) }
        }
      case .accessoryRectangular:
        VStack(alignment: .leading, spacing: 1) {
          Text(snap.title).font(.caption2).lineLimit(1)
          Text(snap.line).font(.title3.monospacedDigit()).widgetAccentable()
          Text(snap.action).font(.caption2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      case .accessoryInline:
        Text("\(snap.title) \(snap.line)")
      case .accessoryCorner:
        Text(snap.line).widgetAccentable()
      default:
        Text(snap.line).widgetAccentable()
      }
    }
    .foregroundStyle(Ink.cream)
    .widgetURL(link)
    .containerBackground(Ink.bg, for: .widget)
  }
}

struct ZikruProgress: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: WatchBox.widgetKind, provider: Provider()) { entry in
      ComplicationView(entry: entry)
    }
    .configurationDisplayName("Zikru")
    .description("Progression du jour · Today's progress")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
  }
}

@main
struct ZikruWatchWidgets: WidgetBundle {
  var body: some Widget { ZikruProgress() }
}
