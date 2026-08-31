import { act, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import * as mockReact from 'react';

import { DailyEnergyCheckIn } from '../../src/ui/plan/daily-energy-check-in';

const mockScrollTo = jest.fn();

jest.mock('react-native', () => {
  return {
    Modal: ({ children, visible }: { children: ReactNode; visible: boolean }) => visible ? mockReact.createElement(mockReact.Fragment, null, children) : null,
    Pressable: 'Pressable',
    ScrollView: mockReact.forwardRef(({ children }: { children: ReactNode }, ref) => {
      mockReact.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
      return mockReact.createElement(mockReact.Fragment, null, children);
    }),
    Platform: {
      OS: 'ios',
      select: <T,>(values: { ios?: T; native?: T; default?: T }) => values.ios ?? values.native ?? values.default,
    },
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: 'Text',
    View: 'View',
  };
});

describe('DailyEnergyCheckIn', () => {
  test('scrolls its initial 75-percent selection into view after opening', async () => {
    await act(async () => {
      render(
        <DailyEnergyCheckIn
          onRequestClose={() => {}}
          onSave={async () => {}}
          visible
        />,
      );
    });

    await waitFor(() => expect(mockScrollTo).toHaveBeenCalledWith({ animated: false, y: 616 }));
  });
});
