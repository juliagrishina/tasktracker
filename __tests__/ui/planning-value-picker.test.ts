import { getPickerInitialScrollIndex } from '../../src/ui/backlog/planning-value-picker';

describe('getPickerInitialScrollIndex', () => {
  test('opens with several values before the selected option', () => {
    expect(getPickerInitialScrollIndex(['08:50', '08:55', '09:00', '09:05', '09:10', '09:15', '09:20', '09:25', '09:30'], '09:20')).toBe(1);
  });
});
