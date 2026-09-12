import { act, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import * as mockReact from 'react';

import { DailyEnergyCheckIn } from '../../src/ui/plan/daily-energy-check-in';

const mockScrollTo = jest.fn();
let capturedOnLayout: ((event: unknown) => void) | undefined;

jest.mock('react-native', () => {
  return {
    Modal: ({ children, visible }: { children: ReactNode; visible: boolean }) => visible ? mockReact.createElement(mockReact.Fragment, null, children) : null,
    Pressable: 'Pressable',
    ScrollView: mockReact.forwardRef(({ children, onLayout }: { children: ReactNode; onLayout?: (event: unknown) => void }, ref) => {
      mockReact.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
      capturedOnLayout = onLayout;
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
  beforeEach(() => {
    mockScrollTo.mockClear();
    capturedOnLayout = undefined;
  });

  test('scrolls its initial 75-percent selection into view after the picker has laid out', async () => {
    await act(async () => {
      render(
        <DailyEnergyCheckIn
          onRequestClose={() => {}}
          onSave={async () => {}}
          visible
        />,
      );
      await Promise.resolve();
    });

    expect(mockScrollTo).not.toHaveBeenCalled();
    expect(capturedOnLayout).toEqual(expect.any(Function));

    await act(async () => {
      capturedOnLayout?.({});
    });

    await waitFor(() => expect(mockScrollTo).toHaveBeenCalledWith({ animated: false, y: 616 }));
  });
});
