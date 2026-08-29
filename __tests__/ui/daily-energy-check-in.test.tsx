import { act, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockScrollTo = jest.fn();

jest.mock('react-native', () => {
  const mockReact = require('react') as typeof import('react');
  return {
    Modal: ({ children, visible }: { children: ReactNode; visible: boolean }) => visible ? mockReact.createElement(mockReact.Fragment, null, children) : null,
    Pressable: 'Pressable',
    ScrollView: mockReact.forwardRef(({ children }: { children: ReactNode }, ref) => {
      mockReact.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
      return mockReact.createElement(mockReact.Fragment, null, children);
    }),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: 'Text',
    View: 'View',
  };
});

import { DailyEnergyCheckIn } from '../../src/ui/plan/daily-energy-check-in';

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
