import ExpoModulesCore
import ImageIO
import PDFKit
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
            let b = observation.boundingBox
            // box : x, y, largeur, hauteur normalisées (origine en bas à gauche), pour regrouper les morceaux d’une même ligne.
            return ["text": candidate.string, "confidence": Double(candidate.confidence), "box": [Double(b.minX), Double(b.minY), Double(b.width), Double(b.height)]] as [String: Any]
          }
          promise.resolve(["lines": lines])
        } catch {
          promise.reject("ERR_ZIKRU_OCR", error.localizedDescription)
        }
      }
    }

    /// PDF (PDFKit, sur l’appareil) : texte de chaque page tel qu’il est encodé dans le fichier ("" pour une page scannée).
    AsyncFunction("pdfPages") { (uri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        guard let url = URL(string: uri), let doc = PDFDocument(url: url) else {
          promise.reject("ERR_ZIKRU_PDF", "PDF illisible")
          return
        }
        if doc.isLocked {
          promise.reject("ERR_ZIKRU_PDF_LOCKED", "PDF protégé par un mot de passe")
          return
        }
        var pages: [String] = []
        for i in 0..<doc.pageCount {
          pages.append(doc.page(at: i)?.string ?? "")
        }
        promise.resolve(["pages": pages])
      }
    }

    /// Rendu d’une page PDF en PNG (dossier temporaire) : aperçu de la source et OCR des pages scannées.
    AsyncFunction("pdfRender") { (uri: String, index: Int, maxSide: Double, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        guard let url = URL(string: uri), let doc = PDFDocument(url: url), let page = doc.page(at: index) else {
          promise.reject("ERR_ZIKRU_PDF", "Page PDF illisible")
          return
        }
        let bounds = page.bounds(for: .mediaBox)
        let longest = max(bounds.width, bounds.height)
        let scale = longest > 0 ? CGFloat(maxSide) / longest : 1
        let size = CGSize(width: max(1, bounds.width * scale), height: max(1, bounds.height * scale))
        let image = page.thumbnail(of: size, for: .mediaBox)
        guard let data = image.pngData() else {
          promise.reject("ERR_ZIKRU_PDF_RENDER", "Rendu de page impossible")
          return
        }
        let out = FileManager.default.temporaryDirectory.appendingPathComponent("zikru-pdf-\(index)-\(UUID().uuidString).png")
        do {
          try data.write(to: out)
          promise.resolve(out.absoluteString)
        } catch {
          promise.reject("ERR_ZIKRU_PDF_RENDER", error.localizedDescription)
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
