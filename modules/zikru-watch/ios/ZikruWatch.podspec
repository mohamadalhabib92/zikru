Pod::Spec.new do |s|
  s.name           = 'ZikruWatch'
  s.version        = '1.0.0'
  s.summary        = 'Pont WatchConnectivity entre l’iPhone Zikru et la montre'
  s.description    = 'Module local Zikru : envoie la liste de zikr et reçoit les séances. Aucun réseau.'
  s.license        = 'UNLICENSED'
  s.author         = 'Zikru'
  s.homepage       = 'https://mohamadalhabib92.github.io/zikru/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'WatchConnectivity'
  s.source_files   = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
