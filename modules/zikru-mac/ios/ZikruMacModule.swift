import ExpoModulesCore
import UIKit

/// Vue transparente, première répondante seulement quand aucun champ de texte ne l’est.
/// Échap revient en arrière. Cmd+F ouvre la recherche. Les flèches et la barre d’espace restent au système.
final class MacKeyView: UIView {
  var onKey: ((String) -> Void)?

  override var canBecomeFirstResponder: Bool { true }

  override var keyCommands: [UIKeyCommand]? {
    let esc = UIKeyCommand(input: UIKeyCommand.inputEscape, modifierFlags: [], action: #selector(fireEsc))
    let find = UIKeyCommand(input: "f", modifierFlags: .command, action: #selector(fireFind))
    if #available(iOS 15.0, *) {
      esc.wantsPriorityOverSystemBehavior = true
      find.wantsPriorityOverSystemBehavior = true
    }
    return [esc, find]
  }

  @objc private func fireEsc() { onKey?("escape") }
  @objc private func fireFind() { onKey?("find") }
}

final class MacKeys {
  static let shared = MacKeys()
  var onKey: ((String) -> Void)?
  private var view: MacKeyView?
  private var observers: [NSObjectProtocol] = []

  func install() {
    guard #available(iOS 14.0, *), ProcessInfo.processInfo.isiOSAppOnMac else { return }
    DispatchQueue.main.async {
      guard self.view == nil, let window = self.keyWindow() else { return }
      let v = MacKeyView(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
      v.backgroundColor = .clear
      v.onKey = { [weak self] key in self?.onKey?(key) }
      window.addSubview(v)
      self.view = v
      v.becomeFirstResponder()
      let reclaim = NotificationCenter.default.addObserver(
        forName: UITextField.textDidEndEditingNotification,
        object: nil,
        queue: .main
      ) { [weak v] _ in
        v?.becomeFirstResponder()
      }
      let reclaim2 = NotificationCenter.default.addObserver(
        forName: UITextView.textDidEndEditingNotification,
        object: nil,
        queue: .main
      ) { [weak v] _ in
        v?.becomeFirstResponder()
      }
      self.observers = [reclaim, reclaim2]
    }
  }

  private func keyWindow() -> UIWindow? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
  }
}

public class ZikruMacModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ZikruMac")
    Events("onKey")

    OnCreate {
      MacKeys.shared.onKey = { [weak self] key in
        self?.sendEvent("onKey", ["key": key])
      }
    }

    Function("isIosAppOnMac") { () -> Bool in
      if #available(iOS 14.0, *) {
        return ProcessInfo.processInfo.isiOSAppOnMac
      }
      return false
    }

    Function("installKeys") {
      MacKeys.shared.install()
    }
  }
}
