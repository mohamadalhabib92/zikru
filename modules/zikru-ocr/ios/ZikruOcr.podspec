Pod::Spec.new do |s|
  s.name           = 'ZikruOcr'
  s.version        = '1.0.0'
  s.summary        = 'Reconnaissance de texte arabe sur l’appareil (Apple Vision) pour Zikru'
  s.description    = 'Module local Zikru : VNRecognizeTextRequest, aucune donnée envoyée.'
  s.license        = 'UNLICENSED'
  s.author         = 'Zikru'
  s.homepage       = 'https://mohamadalhabib92.github.io/zikru/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'Vision', 'PDFKit'
  s.source_files   = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
