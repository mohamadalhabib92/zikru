Pod::Spec.new do |s|
  s.name           = 'ZikruMac'
  s.version        = '1.0.0'
  s.summary        = 'Détecte l’app iOS Zikru quand elle tourne sur un Mac'
  s.description    = 'Module local Zikru : ProcessInfo.isiOSAppOnMac, et Échap / Cmd+F.'
  s.license        = 'UNLICENSED'
  s.author         = 'Zikru'
  s.homepage       = 'https://mohamadalhabib92.github.io/zikru/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files   = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
