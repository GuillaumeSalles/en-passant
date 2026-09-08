import XCTest

final class NativeUITests: XCTestCase {
  private let app = XCUIApplication(bundleIdentifier: "io.enpassant.native")

  override func setUpWithError() throws {
    continueAfterFailure = false
    app.launch()
    XCTAssertTrue(app.buttons["New repertoire"].waitForExistence(timeout: 30))
  }

  private func tap(_ label: String) {
    let button = app.buttons[label].firstMatch
    XCTAssertTrue(button.waitForExistence(timeout: 10), "Missing button: \(label)")
    for _ in 0..<8 {
      if button.isHittable { break }
      app.swipeUp()
    }
    button.tap()
  }

  private func square(_ name: String) -> XCUIElement {
    app.descendants(matching: .any).matching(identifier: "square-\(name)").firstMatch
  }

  private func move(_ from: String, _ to: String) {
    let source = square(from)
    for _ in 0..<8 {
      if source.isHittable { break }
      app.swipeDown()
    }
    XCTAssertTrue(source.waitForExistence(timeout: 10))
    source.tap()
    square(to).tap()
  }

  func testCreateEditTrainAndPersistRepertoire() throws {
    let name = "Native E2E \(UUID().uuidString.prefix(8))"
    tap("New repertoire")
    let field = app.textFields["Name"]
    XCTAssertTrue(field.waitForExistence(timeout: 5))
    field.tap()
    field.typeText(name)
    tap("Save")
    XCTAssertTrue(square("e2").waitForExistence(timeout: 10))
    move("e2", "e4")
    XCTAssertTrue(square("e4").label.contains("wp"))
    move("e7", "e5")
    move("g1", "f3")
    XCTAssertTrue(square("f3").label.contains("wn"))

    tap("Edit comment")
    let comment = app.textViews["Comment"]
    XCTAssertTrue(comment.waitForExistence(timeout: 5))
    comment.tap()
    comment.typeText("Develop the knight")
    tap("Save")
    XCTAssertTrue(app.staticTexts["Develop the knight"].waitForExistence(timeout: 5))

    tap("Rename chapter")
    let chapterName = app.textFields["Name"]
    chapterName.tap()
    // Clearing through keyboard works with both software and hardware keyboards.
    let current = chapterName.value as? String ?? ""
    chapterName.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count))
    chapterName.typeText(name)
    tap("Save")
    tap("Train chapter")
    tap("Train line 1")
    move("e2", "e4")
    XCTAssertTrue(square("e5").label.contains("bp"))
    move("g1", "f3")
    XCTAssertTrue(app.staticTexts["Line complete · 0 mistakes"].waitForExistence(timeout: 5))
    tap("Back to lines")

    app.terminate()
    app.launch()
    XCTAssertTrue(app.buttons[name].waitForExistence(timeout: 30))
    tap(name)
    tap("2. Nf3")
    XCTAssertTrue(app.staticTexts["Develop the knight"].waitForExistence(timeout: 5))
  }
}
