import ExpoModulesCore
import WatchConnectivity

/// File locale des messages montre, reçus même si le JavaScript n’est pas encore prêt.
final class WatchLink: NSObject, WCSessionDelegate {
  static let shared = WatchLink()

  var onPayload: ((String) -> Void)?
  private var pending: [String] = []
  private var context: [String: Any]?
  private var transfers: [[String: Any]] = []
  private var started = false
  private let lock = NSLock()

  func start() {
    guard !started else { return }
    started = true
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func takePending() -> [String] {
    lock.lock()
    let copy = pending
    pending = []
    lock.unlock()
    return copy
  }

  func pushContext(_ json: String) {
    guard let dict = Self.dictionary(json) else { return }
    guard WCSession.isSupported(), WCSession.default.activationState == .activated else {
      context = dict
      return
    }
    do {
      try WCSession.default.updateApplicationContext(dict)
      context = nil
    } catch {
      context = dict
    }
  }

  func transfer(_ json: String) {
    guard let dict = Self.dictionary(json) else { return }
    guard WCSession.isSupported(), WCSession.default.activationState == .activated else {
      transfers.append(dict)
      return
    }
    WCSession.default.transferUserInfo(dict)
  }

  private func flushQueued() {
    guard WCSession.default.activationState == .activated else { return }
    if let dict = context {
      do {
        try WCSession.default.updateApplicationContext(dict)
        context = nil
      } catch {
        // on réessaiera au prochain envoi
      }
    }
    for dict in transfers {
      WCSession.default.transferUserInfo(dict)
    }
    transfers.removeAll()
  }

  private func deliver(_ dict: [String: Any]) {
    guard let json = Self.json(dict) else { return }
    lock.lock()
    // nil est un état normal : le JS n’écoute pas encore, on met le message de côté.
    if let callback = onPayload {
      lock.unlock()
      DispatchQueue.main.async { callback(json) }
    } else {
      pending.append(json)
      if pending.count > 40 { pending.removeFirst(pending.count - 40) }
      lock.unlock()
    }
  }

  private static func dictionary(_ json: String) -> [String: Any]? {
    guard let data = json.data(using: .utf8),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          JSONSerialization.isValidJSONObject(obj) else { return nil }
    return obj
  }

  private static func json(_ dict: [String: Any]) -> String? {
    guard JSONSerialization.isValidJSONObject(dict),
          let data = try? JSONSerialization.data(withJSONObject: dict),
          let text = String(data: data, encoding: .utf8) else { return nil }
    return text
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    DispatchQueue.main.async { self.flushQueued() }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    deliver(userInfo)
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    deliver(applicationContext)
  }
}

public class ZikruWatchAppDelegate: ExpoAppDelegateSubscriber {
  @MainActor
  public func subscriberDidRegister() {
    WatchLink.shared.start()
  }
}

public class ZikruWatchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ZikruWatch")
    Events("onPayload")

    OnCreate {
      WatchLink.shared.start()
    }

    OnStartObserving {
      WatchLink.shared.onPayload = { [weak self] json in
        self?.sendEvent("onPayload", ["json": json])
      }
    }

    OnStopObserving {
      WatchLink.shared.onPayload = nil
    }

    Function("supported") { () -> Bool in
      WCSession.isSupported()
    }

    Function("takePending") { () -> [String] in
      WatchLink.shared.takePending()
    }

    Function("pushContext") { (json: String) in
      WatchLink.shared.pushContext(json)
    }

    Function("transferSessions") { (json: String) in
      WatchLink.shared.transfer(json)
    }
  }
}
