import SwiftUI
import WidgetKit

/// Complication : prochaine prière lue dans le relevé déposé par l’app montre.
/// Le texte arabe et les libellés viennent de l’iPhone (`watch-snapshot.ts`).

private let group = "group.com.vibecode.zikru-76mpdv"
private let key = "zikru.watch.snapshot"

private struct Face {
  var title: String
  var time: String
  var stale: Bool
}

private func loadFace(now: Date) -> Face {
  guard let json = (UserDefaults(suiteName: group) ?? .standard).string(forKey: key),
        let data = json.data(using: .utf8),
        let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let names = raw["names"] as? [String: String],
        let dayRows = raw["days"] as? [[String: Any]]
  else { return Face(title: "Zikru", time: "iPhone", stale: true) }

  var upcoming: [(String, Date)] = []
  for row in dayRows {
    guard let prayers = row["prayers"] as? [[String: Any]] else { continue }
    for p in prayers {
      guard let k = p["key"] as? String, let ms = (p["at"] as? NSNumber)?.doubleValue else { continue }
      let at = Date(timeIntervalSince1970: ms / 1000)
      if at > now { upcoming.append((k, at)) }
    }
  }
  guard let next = upcoming.min(by: { $0.1 < $1.1 }) else {
    return Face(title: "Zikru", time: "iPhone", stale: true)
  }
  let f = DateFormatter()
  f.locale = Locale(identifier: "fr_FR")
  f.dateFormat = "HH:mm"
  return Face(title: names[next.0] ?? next.0, time: f.string(from: next.1), stale: false)
}

private struct Entry: TimelineEntry {
  var date: Date
  var face: Face
}

private struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry {
    Entry(date: Date(), face: Face(title: "Dhuhr", time: "12:30", stale: false))
  }

  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    let now = Date()
    completion(Entry(date: now, face: loadFace(now: now)))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    let now = Date()
    var entries = [Entry(date: now, face: loadFace(now: now))]
    if let json = (UserDefaults(suiteName: group) ?? .standard).string(forKey: key),
       let data = json.data(using: .utf8),
       let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
       let dayRows = raw["days"] as? [[String: Any]] {
      var dates: [Date] = []
      for row in dayRows {
        guard let prayers = row["prayers"] as? [[String: Any]] else { continue }
        for p in prayers {
          guard let ms = (p["at"] as? NSNumber)?.doubleValue else { continue }
          let at = Date(timeIntervalSince1970: ms / 1000)
          if at > now { dates.append(at) }
        }
      }
      for at in dates.prefix(16) {
        entries.append(Entry(date: at, face: loadFace(now: at)))
      }
    }
    let refresh = entries.dropFirst().first?.date ?? now.addingTimeInterval(30 * 60)
    completion(Timeline(entries: entries, policy: .after(refresh)))
  }
}

private struct FaceView: View {
  @Environment(\.widgetFamily) private var family
  var entry: Entry

  var body: some View {
    switch family {
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 2) {
        Text(entry.face.stale ? "Ouvrir l’iPhone" : "Prochaine")
          .font(.caption2)
        Text(entry.face.title)
          .font(.headline)
        Text(entry.face.time)
          .font(.caption.monospacedDigit())
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    case .accessoryInline:
      Text(entry.face.stale ? "Zikru" : "\(entry.face.title) \(entry.face.time)")
    default:
      VStack(spacing: 0) {
        Text(short(entry.face.title))
          .font(.caption2)
        Text(entry.face.time)
          .font(.headline.monospacedDigit())
          .minimumScaleFactor(0.6)
      }
    }
  }

  private func short(_ s: String) -> String {
    if s.count <= 6 { return s }
    return String(s.prefix(5))
  }
}

private struct NextPrayerWidget: Widget {
  let kind = "ZikruNextPrayer"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      FaceView(entry: entry)
        .containerBackground(.fill.tertiary, for: .widget)
    }
    .configurationDisplayName("Prochaine prière")
    .description("Heure calculée sur l’iPhone, même réglage que Zikru.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
  }
}

@main
struct ZikruWatchWidgets: WidgetBundle {
  var body: some Widget {
    NextPrayerWidget()
  }
}
