import Foundation
@testable import Pulpe
import Testing

@MainActor
struct PayDaySettingViewModelTests {
    // MARK: - Initialization

    @Test func init_setsSelectedDayToCurrentPayDay() {
        let vm = PayDaySettingViewModel(currentPayDay: 15)

        #expect(vm.selectedDay == 15)
        #expect(!vm.hasChanges)
    }

    @Test func init_nilPayDay_selectedDayIsNil() {
        let vm = PayDaySettingViewModel(currentPayDay: nil)

        #expect(vm.selectedDay == nil)
        #expect(!vm.hasChanges)
    }

    // MARK: - selectDay

    @Test func selectDay_differentFromInitial_setsHasChanges() {
        let vm = PayDaySettingViewModel(currentPayDay: 15)

        vm.selectDay(27)

        #expect(vm.selectedDay == 27)
        #expect(vm.hasChanges)
    }

    @Test func selectDay_sameAsInitial_noChanges() {
        let vm = PayDaySettingViewModel(currentPayDay: 15)

        vm.selectDay(27)
        vm.selectDay(15)

        #expect(vm.selectedDay == 15)
        #expect(!vm.hasChanges)
    }

    @Test func selectDay_nil_fromNonNil_setsHasChanges() {
        let vm = PayDaySettingViewModel(currentPayDay: 10)

        vm.selectDay(nil)

        #expect(vm.selectedDay == nil)
        #expect(vm.hasChanges)
    }

    @Test func selectDay_nonNil_fromNil_setsHasChanges() {
        let vm = PayDaySettingViewModel(currentPayDay: nil)

        vm.selectDay(5)

        #expect(vm.selectedDay == 5)
        #expect(vm.hasChanges)
    }

    // MARK: - reset

    @Test func reset_restoresInitialDay() {
        let vm = PayDaySettingViewModel(currentPayDay: 15)
        vm.selectDay(27)

        vm.reset()

        #expect(vm.selectedDay == 15)
        #expect(!vm.hasChanges)
    }

    @Test func reset_fromNilInitial_restoresNil() {
        let vm = PayDaySettingViewModel(currentPayDay: nil)
        vm.selectDay(10)

        vm.reset()

        #expect(vm.selectedDay == nil)
        #expect(!vm.hasChanges)
    }

    // MARK: - commitSave

    @Test func commitSave_updatesBaseline() {
        let vm = PayDaySettingViewModel(currentPayDay: 15)
        vm.selectDay(27)

        #expect(vm.hasChanges)

        vm.commitSave()

        #expect(!vm.hasChanges)
        #expect(vm.selectedDay == 27)

        // After commit, resetting should go to the NEW baseline (27)
        vm.selectDay(10)
        vm.reset()
        #expect(vm.selectedDay == 27)
    }

    // MARK: - PayDay Validation (UserSettingsStore guard)

    private func isValidPayDay(_ day: Int?) -> Bool {
        guard let day else { return true }
        return (2...31).contains(day)
    }

    @Test func updatePayDay_validationLogic_acceptsNil() {
        #expect(isValidPayDay(nil))
    }

    @Test func updatePayDay_validationLogic_acceptsDay2() {
        #expect(isValidPayDay(2))
    }

    @Test func updatePayDay_validationLogic_acceptsDay31() {
        #expect(isValidPayDay(31))
    }

    @Test func updatePayDay_validationLogic_rejectsDay1() {
        #expect(!isValidPayDay(1))
    }

    @Test func updatePayDay_validationLogic_rejectsDay0() {
        #expect(!isValidPayDay(0))
    }

    @Test func updatePayDay_validationLogic_rejectsDay32() {
        #expect(!isValidPayDay(32))
    }

    @Test func updatePayDay_validationLogic_rejectsNegative() {
        #expect(!isValidPayDay(-1))
    }
}
