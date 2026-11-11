import Foundation
import SwiftUI
import WatchConnectivity
import WatchKit
import WidgetKit

/// Même groupe que `targets/watch/expo-target.config.js` : `group.` + identifiant iOS + `.watch`.
enum WatchBox {
  static let groupId = "group.com.vibecode.zikru-76mpdv.watch"
  static let snapshotKey = "zikru.watch.snapshot"
  static let widgetKind = "ZikruProgress"
  static let stateKey = "zikru.watch.state.v1"
}

struct WatchZikr: Codable, Identifiable, Equatable {
  var id: String
  var ar: String
  var label: String
  var round: Int
  var goal: Int
  var alias: String?
}

struct PhoneSnap: Codable, Equatable {
  var id: String
  var zikrId: String
  var count: Int
  var round: Int
  var goal: Int
  var at: Double
}

struct Catalog: Codable, Equatable {
  var lang: String
  var today: [WatchZikr]
  var composition: [WatchZikr]
  var compositionTitle: String
  var prefer: String
  var activeId: String
  var phone: PhoneSnap
  var applied: [String: Int]
  var epochs: [String: Int]
}

struct LocalSession: Codable, Equatable {
  var id: String
  var zikrId: String
  var alias: String?
  var count: Int
  var round: Int
  var goal: Int
  var at: Double
  var open: Bool
}

struct ProgressSnap: Codable {
  var count: Int
  var goal: Int
  var done: Int
  var total: Int
  var lang: String
  var title: String
}

private struct Disk: Codable {
  var sessions: [LocalSession]
  var list: String
  var activeId: String
  var userPicked: Bool
  var seenEpoch: [String: Int]
  var catalog: Catalog?
}

/// Compteur hors-ligne. La règle de vibration est la même que `hapticFor` dans src/lib/watch-sync.ts.
@MainActor
final class CounterModel: ObservableObject {
  @Published var picker = false
  @Published private(set) var catalog: Catalog?
  @Published private(set) var sessions: [LocalSession] = []
  @Published var listKind = "today"
  @Published var activeId = "subhanallah"

  private var userPicked = false
  private var seenEpoch: [String: Int] = [:]
  private var sendItem: DispatchWorkItem?
  private var widgetItem: DispatchWorkItem?
  private var lastWidget = Date.distantPast
  private let defaults = UserDefaults.standard

  init() {
    load()
    if catalog == nil { activeId = fallback().first?.id ?? activeId }
    PhoneLink.shared.bind(self)
    PhoneLink.shared.start()
    writeSnapshot()
    flushSend()
  }

  var lang: String { catalog?.lang == "en" ? "en" : "fr" }
  var copy: WatchCopy { WatchCopy(en: lang == "en") }

  func zikrs() -> [WatchZikr] {
    if listKind == "composition", let list = catalog?.composition, !list.isEmpty { return list }
    if let today = catalog?.today, !today.isEmpty { return today }
    return fallback()
  }

  func active() -> WatchZikr? {
    let list = zikrs()
    return list.first { $0.id == activeId } ?? list.first
  }

  func shown(_ z: WatchZikr) -> Int {
    phoneCount(z) + (sessions.first { $0.open && $0.zikrId == z.id }?.count ?? 0)
  }

  func chooseList(_ kind: String) {
    listKind = kind == "composition" ? "composition" : "today"
    userPicked = true
    if active() == nil { activeId = zikrs().first?.id ?? activeId }
    persist()
    writeSnapshot()
  }

  func choose(_ id: String) {
    activeId = id
    userPicked = true
    picker = false
    persist()
    writeSnapshot()
  }

  func quickStart() {
    picker = false
    if let catalog {
      listKind = catalog.prefer == "composition" && !catalog.composition.isEmpty ? "composition" : "today"
      if zikrs().contains(where: { $0.id == catalog.activeId || $0.alias == catalog.activeId }) {
        activeId = zikrs().first { $0.id == catalog.activeId || $0.alias == catalog.activeId }?.id ?? catalog.activeId
      }
    }
    persist()
    writeSnapshot()
  }

  /// Toucher ou couronne. La couronne ne compte que vers l’avant : on ne défait pas un zikr.
  func add(_ n: Int) {
    let steps = min(500, max(0, n))
    guard steps > 0, let z = active() else { return }
    var session = openSession(z)
    let prev = session.count
    session.count += steps
    session.at = Date().timeIntervalSince1970 * 1000
    replace(session)
    play(hapticKind(prev: prev, next: session.count, round: z.round, goal: z.goal), steps: steps)
    persist()
    writeSnapshot()
    let goal = hapticKind(prev: prev, next: session.count, round: z.round, goal: z.goal) == "goal"
    scheduleSend(soon: goal)
    scheduleWidget(now: goal)
  }

  func ingest(_ raw: [String: Any]) {
    let kind = raw["kind"] as? String
    if kind == "catalog" || raw["today"] != nil {
      if let next = parseCatalog(raw) { apply(next) }
    }
    if kind == "sessions" || raw["sessions"] != nil {
      applyPhone(parseSessions(raw["sessions"]))
    }
  }

  func flushSend() {
    let owned = sessions.filter { $0.count > 0 }
    guard !owned.isEmpty else { return }
    let payload: [String: Any] = ["v": 1, "kind": "sessions", "sessions": owned.map(sessionDict)]
    PhoneLink.shared.send(payload)
  }

  func scene(_ phase: ScenePhase) {
    if phase != .active { flushSend() }
  }

  // MARK: - privé

  private func phoneCount(_ z: WatchZikr) -> Int {
    guard let phone = catalog?.phone else { return 0 }
    if phone.zikrId == z.id || phone.zikrId == z.alias { return max(0, phone.count) }
    return 0
  }

  private func openSession(_ z: WatchZikr) -> LocalSession {
    if let found = sessions.first(where: { $0.open && $0.zikrId == z.id }) { return found }
    let created = LocalSession(id: UUID().uuidString, zikrId: z.id, alias: z.alias, count: 0, round: z.round, goal: z.goal, at: Date().timeIntervalSince1970 * 1000, open: true)
    sessions.append(created)
    return created
  }

  private func replace(_ session: LocalSession) {
    if let i = sessions.firstIndex(where: { $0.id == session.id }) { sessions[i] = session }
    else { sessions.append(session) }
  }

  private func apply(_ next: Catalog) {
    let follow = !userPicked || next.activeId != catalog?.activeId || next.prefer != catalog?.prefer
    catalog = next
    noteEpochs(next.epochs)
    if follow {
      listKind = next.prefer == "composition" && !next.composition.isEmpty ? "composition" : "today"
      if let match = zikrs().first(where: { $0.id == next.activeId || $0.alias == next.activeId }) { activeId = match.id }
      else if active() == nil { activeId = zikrs().first?.id ?? activeId }
    }
    persist()
    writeSnapshot()
    scheduleWidget(now: false)
  }

  private func applyPhone(_ list: [PhoneSnap]) {
    guard var current = catalog else { return }
    for phone in list {
      if phone.id == current.phone.id {
        if phone.count > current.phone.count { current.phone.count = phone.count }
        if phone.at > current.phone.at { current.phone.at = phone.at }
      } else if phone.at >= current.phone.at {
        current.phone = phone
      }
    }
    catalog = current
    persist()
    writeSnapshot()
  }

  private func noteEpochs(_ epochs: [String: Int]) {
    var archived = false
    for (zikr, epoch) in epochs where epoch > (seenEpoch[zikr] ?? 0) {
      seenEpoch[zikr] = epoch
      for i in sessions.indices where sessions[i].open && (sessions[i].zikrId == zikr || sessions[i].alias == zikr) {
        sessions[i].open = false
        archived = true
      }
    }
    if archived { scheduleSend(soon: true) }
  }

  private func scheduleSend(soon: Bool) {
    sendItem?.cancel()
    let item = DispatchWorkItem { [weak self] in self?.flushSend() }
    sendItem = item
    DispatchQueue.main.asyncAfter(deadline: .now() + (soon ? 0.25 : 2), execute: item)
  }

  private func scheduleWidget(now: Bool) {
    if now || Date().timeIntervalSince(lastWidget) > 4 {
      lastWidget = Date()
      WidgetCenter.shared.reloadTimelines(ofKind: WatchBox.widgetKind)
      return
    }
    widgetItem?.cancel()
    let item = DispatchWorkItem { [weak self] in
      guard let self else { return }
      self.lastWidget = Date()
      WidgetCenter.shared.reloadTimelines(ofKind: WatchBox.widgetKind)
    }
    widgetItem = item
    DispatchQueue.main.asyncAfter(deadline: .now() + 4, execute: item)
  }

  private func writeSnapshot() {
    let list = zikrs()
    let current = active()
    let count = current.map(shown) ?? 0
    let done = list.filter { $0.goal > 0 && shown($0) >= $0.goal }.count
    let snap = ProgressSnap(count: count, goal: current?.goal ?? 0, done: done, total: list.count, lang: lang, title: current?.label ?? "Zikru")
    guard let data = try? JSONEncoder().encode(snap) else { return }
    UserDefaults(suiteName: WatchBox.groupId)?.set(data, forKey: WatchBox.snapshotKey)
  }

  private func persist() {
    let disk = Disk(sessions: sessions, list: listKind, activeId: activeId, userPicked: userPicked, seenEpoch: seenEpoch, catalog: catalog)
    if let data = try? JSONEncoder().encode(disk) { defaults.set(data, forKey: WatchBox.stateKey) }
  }

  private func load() {
    guard let data = defaults.data(forKey: WatchBox.stateKey),
          let disk = try? JSONDecoder().decode(Disk.self, from: data) else { return }
    sessions = disk.sessions
    listKind = disk.list
    activeId = disk.activeId
    userPicked = disk.userPicked
    seenEpoch = disk.seenEpoch
    catalog = disk.catalog
  }

  private func sessionDict(_ s: LocalSession) -> [String: Any] {
    var o: [String: Any] = [
      "id": s.id,
      "zikrId": s.zikrId,
      "count": s.count,
      "round": s.round,
      "goal": s.goal,
      "at": s.at,
      "origin": "watch",
    ]
    if let alias = s.alias { o["alias"] = alias }
    return o
  }
}

/// Textes d’interface seulement. Le zikr lui-même reste en arabe vocalisé.
struct WatchCopy {
  var en: Bool
  var today: String { en ? "Today" : "Aujourd’hui" }
  var composition: String { en ? "Composition" : "Composition" }
  var count: String { en ? "Count" : "Compter" }
  var list: String { en ? "Choose" : "Choisir" }
  var hint: String { en ? "Tap or turn the crown" : "Touchez ou tournez la couronne" }
  var empty: String { en ? "Open Zikru on iPhone" : "Ouvrez Zikru sur l’iPhone" }
  var goal: String { en ? "Goal" : "Objectif" }
  func countLabel(_ n: Int, goal: Int) -> String {
    en ? "Count, \(n) of \(goal)" : "Compter, \(n) sur \(goal)"
  }
}

private func roundFor(_ goal: Int) -> Int {
  if goal == 33 || goal == 99 || goal == 100 { return goal }
  if goal > 100 { return 33 }
  if goal > 0 { return goal }
  return 33
}

private func hapticKind(prev: Int, next: Int, round: Int, goal: Int) -> String {
  if next <= prev { return "tap" }
  func hit(_ step: Int) -> Bool { step > 0 && prev / step < next / step }
  if hit(goal) { return "goal" }
  if round != goal && hit(round) { return "round" }
  return "tap"
}

private func play(_ kind: String, steps: Int) {
  let device = WKInterfaceDevice.current()
  switch kind {
  case "goal": device.play(.notification)
  case "round": device.play(.success)
  default:
    // Une rafale de couronne : un seul clic, pour la batterie. Un toucher : un clic.
    if steps > 3 { device.play(.click) }
    else { for _ in 0..<max(1, steps) { device.play(.click) } }
  }
}

private func fallback() -> [WatchZikr] {
  // Mêmes identifiants que le contenu approuvé du téléphone, pour que la première synchro fusionne.
  let rows: [(String, String, String, Int)] = [
    ("subhanallah", "سُبْحَانَ ٱللَّٰهِ", "Subḥāna-llāh", 33),
    ("alhamdulillah", "ٱلْحَمْدُ لِلَّٰهِ", "Al-ḥamdu li-llāh", 33),
    ("allahuakbar", "ٱللَّٰهُ أَكْبَرُ", "Allāhu akbar", 33),
    ("tahlil", "لَا إِلَٰهَ إِلَّا ٱللَّٰهُ", "Lā ilāha illa-llāh", 1),
    ("istighfar", "أَسْتَغْفِرُ ٱللَّٰهَ", "Astaghfiru-llāh", 3),
  ]
  return rows.map { WatchZikr(id: $0.0, ar: $0.1, label: $0.2, round: roundFor($0.3), goal: $0.3, alias: nil) }
}

private func intVal(_ any: Any?) -> Int? {
  if let n = any as? Int { return n }
  if let n = any as? NSNumber { return n.intValue }
  if let n = any as? Double { return Int(n) }
  return nil
}

private func parseZikrs(_ any: Any?) -> [WatchZikr] {
  guard let rows = any as? [[String: Any]] else { return [] }
  return rows.compactMap { row in
    guard let id = row["id"] as? String, let ar = row["ar"] as? String, !id.isEmpty, !ar.isEmpty else { return nil }
    let goal = intVal(row["goal"]) ?? 0
    return WatchZikr(id: id, ar: ar, label: (row["label"] as? String) ?? ar, round: intVal(row["round"]) ?? roundFor(goal), goal: goal, alias: row["alias"] as? String)
  }
}

private func parseCatalog(_ raw: [String: Any]) -> Catalog? {
  guard let phone = raw["phone"] as? [String: Any],
        let id = phone["id"] as? String,
        let zikrId = phone["zikrId"] as? String else { return nil }
  var applied: [String: Int] = [:]
  if let map = raw["applied"] as? [String: Any] {
    for (key, value) in map { if let n = intVal(value) { applied[key] = n } }
  }
  var epochs: [String: Int] = [:]
  if let map = raw["epochs"] as? [String: Any] {
    for (key, value) in map { if let n = intVal(value) { epochs[key] = n } }
  }
  let snap = PhoneSnap(id: id, zikrId: zikrId, count: intVal(phone["count"]) ?? 0, round: intVal(phone["round"]) ?? 33, goal: intVal(phone["goal"]) ?? 0, at: (phone["at"] as? NSNumber)?.doubleValue ?? Double(intVal(phone["at"]) ?? 0))
  return Catalog(
    lang: (raw["lang"] as? String) == "en" ? "en" : "fr",
    today: parseZikrs(raw["today"]),
    composition: parseZikrs(raw["composition"]),
    compositionTitle: (raw["compositionTitle"] as? String) ?? "",
    prefer: (raw["prefer"] as? String) == "composition" ? "composition" : "today",
    activeId: (raw["activeId"] as? String) ?? "",
    phone: snap,
    applied: applied,
    epochs: epochs
  )
}

private func parseSessions(_ any: Any?) -> [PhoneSnap] {
  guard let rows = any as? [[String: Any]] else { return [] }
  return rows.compactMap { row in
    guard (row["origin"] as? String) == "phone", let id = row["id"] as? String, let zikrId = row["zikrId"] as? String else { return nil }
    return PhoneSnap(id: id, zikrId: zikrId, count: intVal(row["count"]) ?? 0, round: intVal(row["round"]) ?? 33, goal: intVal(row["goal"]) ?? 0, at: (row["at"] as? NSNumber)?.doubleValue ?? Double(intVal(row["at"]) ?? 0))
  }
}

final class PhoneLink: NSObject, WCSessionDelegate {
  static let shared = PhoneLink()
  private weak var model: CounterModel?
  private var started = false
  private var queued: [String: Any]?

  func bind(_ model: CounterModel) { self.model = model }

  func start() {
    guard !started else { return }
    started = true
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func send(_ payload: [String: Any]) {
    guard WCSession.isSupported(), WCSession.default.activationState == .activated else {
      queued = payload
      return
    }
    WCSession.default.transferUserInfo(payload)
    try? WCSession.default.updateApplicationContext(payload)
    queued = nil
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    guard activationState == .activated, let payload = queued else { return }
    DispatchQueue.main.async { self.send(payload) }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    DispatchQueue.main.async { self.model?.ingest(applicationContext) }
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    DispatchQueue.main.async { self.model?.ingest(userInfo) }
  }
}
