# Creates a UI test target in Expo's generated project; no generated files are committed.
require 'xcodeproj'
require 'pathname'

root = Pathname.new(__dir__).parent
project_path = root.join('apps/native/ios/EnPassant.xcodeproj')
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |target| target.name == 'EnPassant' }
raise 'Run native:ios to generate the iOS app before testing.' unless app
name = 'NativeUITests'
target = project.targets.find { |item| item.name == name } || project.new_target(:ui_test_bundle, name, :ios, '16.4')
target.add_dependency(app) unless target.dependencies.any? { |dependency| dependency.target == app }
target.build_configurations.each do |configuration|
  configuration.build_settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => 'io.enpassant.native.uitests',
    'TEST_TARGET_NAME' => app.name,
    'SWIFT_VERSION' => '5.0',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'CODE_SIGNING_ALLOWED' => 'NO',
    'TARGETED_DEVICE_FAMILY' => '1,2',
  })
end
unless target.source_build_phase.files.any?
  file = project.main_group.new_file('../tests/ios/NativeUITests.swift')
  target.source_build_phase.add_file_reference(file)
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.configure_with_targets(app, target, launch_target: true)
scheme.test_action.build_configuration = 'Release'
scheme.save_as(project_path, name)
