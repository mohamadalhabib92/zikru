import ExpoModulesCore
import WatchConnectivity

/// Une seule session pour l’app. Le module Expo peut être recréé ; le délégué, non.
final class ZikruWatchBridge: NSObject, WCSessionDelegate {
  static let shared = ZikruWatchBridge()
  var onClick: ((String) -> Void)?
  private var pending: String?
  private var lastComplicationPayload: String?
  private var lastComplicationAt: Date?

  func start() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    if session.activationState != .activated {
      session.activate()
    }
  }

  func push(_ json: String) {
    pending = json
    start()
    sendPending()
  }

  func status() -> [String: Any] {
    guard WCSession.isSupported() else { return ["supported": false] }
    let session = WCSession.default
    return [
      "supported": true,
      "paired": session.isPaired,
      "installed": session.isWatchAppInstalled,
      "reachable": session.isReachable,
    ]
  }

  private func sendPending() {
    guard let json = pending, WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated else { return }
    let payload = ["snapshot": json]
    do {
      try session.updateApplicationContext(payload)
    } catch {
      // Contexte refusé tant que la session n’est pas prête : on réessaie à l’activation.
    }
    guard session.isPaired else { return }
    let same = lastComplicationPayload == json
    let recent = lastComplicationAt.map { Date().timeIntervalSince($0) < 900 } ?? false
    // Budget quotidien des complications : on renvoie si le relevé change, pas à chaque ouverture.
    if same && recent { return }
    session.transferCurrentComplicationUserInfo(payload)
    lastComplicationPayload = json
    lastComplicationAt = Date()
  }

  private func emit(_ body: [String: Any]) {
    let raw = (body["clicks"] as? String) ?? (body["click"] as? String)
    guard let raw, !raw.isEmpty else { return }
    DispatchQueue.main.async { self.onClick?(raw) }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    if activationState == .activated { sendPending() }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    emit(message)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
    emit(message)
    replyHandler(["ok": true])
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    emit(userInfo)
  }
}

public class ZikruWatchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ZikruWatch")
    Events("clicks")

    OnCreate {
      ZikruWatchBridge.shared.onClick = { json in
        self.sendEvent("clicks", ["json": json])
      }
      ZikruWatchBridge.shared.start()
    }

    Function("activate") {
      ZikruWatchBridge.shared.start()
    }

    Function("status") { () -> [String: Any] in
      ZikruWatchBridge.shared.status()
    }

    Function("push") { (json: String) in
      ZikruWatchBridge.shared.push(json)
    }
  }
}
