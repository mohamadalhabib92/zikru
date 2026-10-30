import ExpoModulesCore
import ImageIO
import UIKit
import Vision

/// Reconnaissance de texte sur l’appareil (Apple Vision). Aucune image ni aucun texte n’est envoyé.
/// L’arabe (« ar-SA ») n’est proposé que par les versions récentes d’iOS : `supportedLanguages()` permet de le vérifier.
public class ZikruOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ZikruOcr")

    Function("supportedLanguages") { () -> [String] in
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.revision = VNRecognizeTextRequestRevision3
      return (try? request.supportedRecognitionLanguages()) ?? []
    }

    AsyncFunction("recognize") { (uri: String, languages: [String], promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        guard let url = URL(string: uri),
              let data = try? Data(contentsOf: url),
              let image = UIImage(data: data),
              let cgImage = image.cgImage else {
          promise.reject("ERR_ZIKRU_OCR_IMAGE", "Image illisible")
          return
        }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.revision = VNRecognizeTextRequestRevision3
        // Pas de « correction » linguistique : le texte reconnu doit rester celui de la photo.
        request.usesLanguageCorrection = false
        request.automaticallyDetectsLanguage = false
        request.recognitionLanguages = languages
        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: Self.orientation(image.imageOrientation), options: [:])
        do {
          try handler.perform([request])
          // Lignes de haut en bas (repère Vision : origine en bas à gauche).
          let observations = (request.results ?? []).sorted { $0.boundingBox.midY > $1.boundingBox.midY }
          let lines: [[String: Any]] = observations.compactMap { observation in
            guard let candidate = observation.topCandidates(1).first else { return nil }
            return ["text": candidate.string, "confidence": Double(candidate.confidence)]
          }
          promise.resolve(["lines": lines])
        } catch {
          promise.reject("ERR_ZIKRU_OCR", error.localizedDescription)
        }
      }
    }
  }

  private static func orientation(_ o: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch o {
    case .up: return .up
    case .upMirrored: return .upMirrored
    case .down: return .down
    case .downMirrored: return .downMirrored
    case .left: return .left
    case .leftMirrored: return .leftMirrored
    case .right: return .right
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
