import Foundation
import UserNotifications
import WatchConnectivity
import WatchKit
import WidgetKit

final class WatchModel: NSObject, ObservableObject, WCSessionDelegate {
  static let shared = WatchModel()

  @Published var snapshot: Snapshot?
  @Published var dhikrIndex = 0
  @Published var count = 0
  @Published var reached = false

  private let outboxKey = "zikru.watch.outbox"
  private let countKey = "zikru.watch.count"
  private let indexKey = "zikru.watch.dhikrIndex"
  private var flushing = false

  private override init() {
    super.init()
    count = UserDefaults.standard.integer(forKey: countKey)
    dhikrIndex = UserDefaults.standard.integer(forKey: indexKey)
    if let json = SnapshotStore.loadJSON(), let snap = SnapshotDecode.parse(json) {
      snapshot = snap
    }
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
    UNAsk()
  }

  var dhikr: DhikrItem? {
    guard let list = snapshot?.dhikrs, !list.isEmpty else { return nil }
    return list[min(dhikrIndex, list.count - 1)]
  }

  func tap() {
    guard let item = dhikr else { return }
    count += 1
    let done = item.target > 0 && count % item.target == 0
    reached = done
    WKInterfaceDevice.current().play(done ? .success : .click)
    persistCount()
    enqueue(item)
  }

  func reset() {
    count = 0
    reached = false
    persistCount()
    WKInterfaceDevice.current().play(.click)
  }

  func nextDhikr() {
    guard let n = snapshot?.dhikrs.count, n > 1 else { return }
    dhikrIndex = (dhikrIndex + 1) % n
    count = 0
    reached = false
    UserDefaults.standard.set(dhikrIndex, forKey: indexKey)
    persistCount()
  }

  private func persistCount() {
    UserDefaults.standard.set(count, forKey: countKey)
  }

  private func enqueue(_ item: DhikrItem) {
    var box = loadOutbox()
    box.append([
      "id": UUID().uuidString,
      "dhikrId": item.id,
      "delta": 1,
      "target": item.target,
      "at": Date().timeIntervalSince1970 * 1000,
    ])
    saveOutbox(box)
    flush()
  }

  private func loadOutbox() -> [[String: Any]] {
    guard let data = UserDefaults.standard.data(forKey: outboxKey),
          let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else { return [] }
    return arr
  }

  private func saveOutbox(_ box: [[String: Any]]) {
    if let data = try? JSONSerialization.data(withJSONObject: box) {
      UserDefaults.standard.set(data, forKey: outboxKey)
    }
  }

  private func drop(ids: Set<String>) {
    let left = loadOutbox().filter { item in
      guard let id = item["id"] as? String else { return true }
      return !ids.contains(id)
    }
    saveOutbox(left)
  }

  private func flush() {
    guard WCSession.isSupported(), !flushing else { return }
    let session = WCSession.default
    guard session.activationState == .activated else { return }
    let box = loadOutbox()
    guard !box.isEmpty,
          let data = try? JSONSerialization.data(withJSONObject: box),
          let text = String(data: data, encoding: .utf8)
    else { return }
    let ids = Set(box.compactMap { $0["id"] as? String })
    let payload = ["clicks": text]
    flushing = true
    if session.isReachable {
      session.sendMessage(payload, replyHandler: { [weak self] _ in
        self?.drop(ids: ids)
        self?.flushing = false
      }, errorHandler: { [weak self] _ in
        session.transferUserInfo(payload)
        self?.drop(ids: ids)
        self?.flushing = false
      })
    } else {
      session.transferUserInfo(payload)
      drop(ids: ids)
      flushing = false
    }
  }

  private func adopt(_ json: String) {
    SnapshotStore.save(json)
    guard let snap = SnapshotDecode.parse(json) else { return }
    DispatchQueue.main.async {
      let previous = self.dhikr?.id
      self.snapshot = snap
      let list = snap.dhikrs
      if !list.isEmpty {
        if previous == nil || !list.contains(where: { $0.id == previous }) {
          self.dhikrIndex = 0
          self.count = 0
          UserDefaults.standard.set(0, forKey: self.indexKey)
          self.persistCount()
        } else if let idx = list.firstIndex(where: { $0.id == previous }) {
          self.dhikrIndex = idx
        }
      }
      WidgetCenter.shared.reloadAllTimelines()
      scheduleCues(snap)
    }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    if activationState == .activated {
      if let json = session.receivedApplicationContext["snapshot"] as? String { adopt(json) }
      flush()
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    if let json = applicationContext["snapshot"] as? String { adopt(json) }
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    if let json = userInfo["snapshot"] as? String { adopt(json) }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    if session.isReachable { flush() }
  }
}

private func UNAsk() {
  UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
}

private func scheduleCues(_ snap: Snapshot) {
  let center = UNUserNotificationCenter.current()
  center.getPendingNotificationRequests { pending in
    let old = pending.map(\.identifier).filter { $0.hasPrefix("zikru-adhan-") }
    center.removePendingNotificationRequests(withIdentifiers: old)
    let now = Date()
    let soundName = "adhan_cue.wav"
    let hasCue = Bundle.main.url(forResource: "adhan_cue", withExtension: "wav") != nil
    for day in snap.days {
      for prayer in day.prayers where snap.cues.contains(prayer.key) && prayer.at > now {
        let content = UNMutableNotificationContent()
        content.title = snap.names[prayer.key] ?? prayer.key
        content.body = "C’est l’heure."
        content.sound = hasCue ? UNNotificationSound(named: UNNotificationSoundName(soundName)) : .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, prayer.at.timeIntervalSince(now)), repeats: false)
        let id = "zikru-adhan-\(prayer.key)-\(Int(prayer.at.timeIntervalSince1970))"
        center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
      }
    }
  }
}
