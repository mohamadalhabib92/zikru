import Foundation

/// Même forme que `src/lib/watch-snapshot.ts` (schéma 1). Ne pas reformuler l’arabe.
enum SnapshotStore {
  static let group = "group.com.vibecode.zikru-76mpdv"
  static let key = "zikru.watch.snapshot"

  static func save(_ json: String) {
    let box = UserDefaults(suiteName: group) ?? .standard
    box.set(json, forKey: key)
  }

  static func loadJSON() -> String? {
    let box = UserDefaults(suiteName: group) ?? .standard
    return box.string(forKey: key)
  }
}

struct PrayerStamp: Identifiable {
  var key: String
  var at: Date
  var id: String { "\(key)-\(Int(at.timeIntervalSince1970))" }
}

struct DayBlock {
  var start: Date
  var prayers: [PrayerStamp]
}

struct DhikrItem: Identifiable {
  var id: String
  var ar: String
  var tr: String
  var target: Int
  var source: String
  var example: Bool
}

struct Snapshot {
  var place: String
  var names: [String: String]
  var ar: [String: String]
  var days: [DayBlock]
  var dhikrs: [DhikrItem]
  var cues: Set<String>
  var staleAfter: Date
  var updatedAt: Date

  func day(at now: Date) -> DayBlock? {
    for (i, day) in days.enumerated() {
      let end = i + 1 < days.count ? days[i + 1].start : staleAfter
      if now >= day.start && now < end { return day }
    }
    return nil
  }

  func next(after now: Date) -> PrayerStamp? {
    for day in days {
      if let hit = day.prayers.first(where: { $0.at > now }) { return hit }
    }
    return nil
  }

  func label(_ key: String) -> String { names[key] ?? key }
}

enum SnapshotDecode {
  static func parse(_ json: String) -> Snapshot? {
    guard let data = json.data(using: .utf8),
          let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          (raw["v"] as? Int) == 1 || (raw["v"] as? NSNumber)?.intValue == 1,
          let place = raw["placeLabel"] as? String,
          let names = raw["names"] as? [String: String],
          let ar = raw["ar"] as? [String: String],
          let dayRows = raw["days"] as? [[String: Any]],
          !dayRows.isEmpty
    else { return nil }

    var days: [DayBlock] = []
    for row in dayRows {
      guard let startMs = (row["start"] as? NSNumber)?.doubleValue,
            let prayers = row["prayers"] as? [[String: Any]]
      else { return nil }
      let stamps: [PrayerStamp] = prayers.compactMap { p in
        guard let key = p["key"] as? String, let at = (p["at"] as? NSNumber)?.doubleValue else { return nil }
        return PrayerStamp(key: key, at: Date(timeIntervalSince1970: at / 1000))
      }
      if stamps.count != 6 { return nil }
      days.append(DayBlock(start: Date(timeIntervalSince1970: startMs / 1000), prayers: stamps))
    }

    var dhikrs: [DhikrItem] = []
    if let rows = raw["dhikrs"] as? [[String: Any]] {
      for row in rows {
        guard let id = row["id"] as? String, let arabic = row["ar"] as? String, !arabic.isEmpty else { continue }
        let target = (row["target"] as? NSNumber)?.intValue ?? 33
        dhikrs.append(DhikrItem(
          id: id,
          ar: arabic,
          tr: row["tr"] as? String ?? "",
          target: max(1, target),
          source: row["source"] as? String ?? "",
          example: (row["example"] as? Bool) ?? false
        ))
      }
    }

    var cues = Set<String>()
    if let list = raw["cues"] as? [String] { cues = Set(list) }
    let staleMs = (raw["staleAfter"] as? NSNumber)?.doubleValue ?? (days.last.map { $0.start.timeIntervalSince1970 * 1000 + 86_400_000 } ?? 0)
    let updatedMs = (raw["updatedAt"] as? NSNumber)?.doubleValue ?? Date().timeIntervalSince1970 * 1000
    return Snapshot(
      place: place,
      names: names,
      ar: ar,
      days: days,
      dhikrs: dhikrs,
      cues: cues,
      staleAfter: Date(timeIntervalSince1970: staleMs / 1000),
      updatedAt: Date(timeIntervalSince1970: updatedMs / 1000)
    )
  }
}

func hhmm(_ date: Date) -> String {
  let f = DateFormatter()
  f.locale = Locale(identifier: "fr_FR")
  f.dateFormat = "HH:mm"
  return f.string(from: date)
}

func countdownLabel(until date: Date, now: Date) -> String {
  let s = max(0, Int(date.timeIntervalSince(now)))
  let h = s / 3600
  let m = (s % 3600) / 60
  let sec = s % 60
  if h > 0 { return String(format: "%d h %02d", h, m) }
  return String(format: "%d:%02d", m, sec)
}
