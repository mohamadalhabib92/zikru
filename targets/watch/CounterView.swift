import SwiftUI

/// Fond #181818, accent crème #F7F4EE. L’arabe est grand, vocalisé, de droite à gauche.
private enum Ink {
  static let bg = Color(red: 0x18 / 255, green: 0x18 / 255, blue: 0x18 / 255)
  static let cream = Color(red: 0xF7 / 255, green: 0xF4 / 255, blue: 0xEE / 255)
}

struct CounterView: View {
  @ObservedObject var model: CounterModel
  @Environment(\.isLuminanceReduced) private var dim
  @Environment(\.scenePhase) private var phase
  @State private var crown: Double = 0
  @State private var crownAt: Double = 0

  var body: some View {
    let z = model.active()
    let n = z.map { model.shown($0) } ?? 0
    let goal = z?.goal ?? 0
    ZStack(alignment: .topTrailing) {
      Button {
        model.add(1)
      } label: {
        VStack(spacing: dim ? 2 : 6) {
          if let z {
            Text(z.ar)
              .font(.system(size: dim ? 22 : 28))
              .multilineTextAlignment(.center)
              .lineLimit(dim ? 2 : 4)
              .minimumScaleFactor(0.4)
              .environment(\.layoutDirection, .rightToLeft)
              .foregroundStyle(Ink.cream)
              .frame(maxWidth: .infinity)
            if !dim && !z.label.isEmpty && z.label != z.ar {
              Text(z.label)
                .font(.caption2)
                .foregroundStyle(Ink.cream.opacity(0.72))
                .lineLimit(1)
            }
          } else {
            Text(model.copy.empty)
              .font(.caption)
              .multilineTextAlignment(.center)
              .foregroundStyle(Ink.cream)
          }
          Text("\(n)")
            .font(.system(size: dim ? 40 : 52, weight: .light, design: .rounded))
            .monospacedDigit()
            .minimumScaleFactor(0.5)
            .foregroundStyle(Ink.cream)
          if goal > 0 {
            Text(goalText(n, goal))
              .font(.caption.monospacedDigit())
              .foregroundStyle(n > 0 && n % goal == 0 ? Ink.cream : Ink.cream.opacity(0.7))
          }
          if !dim {
            Text(model.copy.hint)
              .font(.system(size: 10))
              .foregroundStyle(Ink.cream.opacity(0.55))
              .multilineTextAlignment(.center)
          }
        }
        .padding(.horizontal, 4)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .accessibilityLabel(model.copy.countLabel(n, goal: max(goal, n)))

      if !dim {
        Button {
          model.picker = true
        } label: {
          Image(systemName: "list.bullet")
            .font(.body)
            .foregroundStyle(Ink.cream)
            .padding(8)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(model.copy.list)
      }
    }
    .background(Ink.bg)
    .digitalCrownRotation($crown, from: 0, through: 100_000, by: 1, sensitivity: .medium, isContinuous: false, isHapticFeedbackEnabled: false)
    .onChange(of: crown) { _, value in
      let steps = Int(value.rounded()) - Int(crownAt.rounded())
      if steps > 0 { model.add(steps) }
      crownAt = value
      if value > 50_000 {
        crown = 0
        crownAt = 0
      }
    }
    .onChange(of: phase) { _, next in model.scene(next) }
    .sheet(isPresented: $model.picker) { PickerSheet(model: model) }
  }

  private func goalText(_ n: Int, _ goal: Int) -> String {
    let word = model.copy.goal
    return "\(n) / \(goal) · \(word)"
  }
}

private struct PickerSheet: View {
  @ObservedObject var model: CounterModel

  var body: some View {
    let copy = model.copy
    List {
      if model.catalog?.composition.isEmpty == false {
        Picker(copy.list, selection: Binding(get: { model.listKind }, set: { model.chooseList($0) })) {
          Text(copy.today).tag("today")
          Text(copy.composition).tag("composition")
        }
        .pickerStyle(.segmented)
      }
      ForEach(model.zikrs()) { z in
        Button {
          model.choose(z.id)
        } label: {
          VStack(alignment: .trailing, spacing: 2) {
            Text(z.ar)
              .font(.title3)
              .multilineTextAlignment(.trailing)
              .lineLimit(2)
              .minimumScaleFactor(0.5)
              .environment(\.layoutDirection, .rightToLeft)
              .frame(maxWidth: .infinity, alignment: .trailing)
            HStack {
              Text(z.label).font(.caption2).lineLimit(1)
              Spacer()
              Text("\(model.shown(z))\(z.goal > 0 ? " / \(z.goal)" : "")")
                .font(.caption.monospacedDigit())
            }
            .foregroundStyle(.secondary)
          }
        }
        .listRowBackground(z.id == model.activeId ? Color(red: 0xF7 / 255, green: 0xF4 / 255, blue: 0xEE / 255).opacity(0.16) : Color.clear)
      }
    }
    .background(Color(red: 0x18 / 255, green: 0x18 / 255, blue: 0x18 / 255))
    .navigationTitle(copy.list)
  }
}
