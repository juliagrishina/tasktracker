import { act, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import * as mockReact from 'react';

import { DailyEnergyCheckIn } from '../../src/ui/plan/daily-energy-check-in';

const mockScrollTo = jest.fn();
const mockRequestAnimationFrame = jest.fn();
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
let capturedOnContentSizeChange: ((width: number, height: number) => void) | undefined;
let queuedAnimationFrame: FrameRequestCallback | undefined;

jest.mock('react-native', () => {
  return {
    Modal: ({ children, visible }: { children: ReactNode; visible: boolean }) => visible ? mockReact.createElement(mockReact.Fragment, null, children) : null,
    Pressable: 'Pressable',
    ScrollView: mockReact.forwardRef(({ children, onContentSizeChange }: {
      children: ReactNode;
      onContentSizeChange?: (width: number, height: number) => void;
    }, ref) => {
      mockReact.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
      capturedOnContentSizeChange = onContentSizeChange;
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
    mockRequestAnimationFrame.mockClear();
    capturedOnContentSizeChange = undefined;
    queuedAnimationFrame = undefined;
    mockRequestAnimationFrame.mockImplementation((callback: FrameRequestCallback) => {
      queuedAnimationFrame = callback;
      return 1;
    });
    globalThis.requestAnimationFrame = mockRequestAnimationFrame as typeof requestAnimationFrame;
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  });

  test('centres its stored 75-percent selection only after the picker content is ready', async () => {
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
    expect(capturedOnContentSizeChange).toEqual(expect.any(Function));

    await act(async () => {
      capturedOnContentSizeChange?.(320, 1008);
    });

    await waitFor(() => expect(mockScrollTo).toHaveBeenCalledWith({ animated: false, y: 616 }));
  });

  test('keeps a stored zero-percent value selected instead of replacing it with the default', async () => {
    const view = await render(
      <DailyEnergyCheckIn
        initialEnergyPercent={0}
        onRequestClose={() => {}}
        onSave={async () => {}}
        visible
      />,
    );

    expect(view.getByLabelText('Энергия 0%').props.accessibilityState).toEqual({ selected: true });
    expect(view.getByLabelText('Энергия 75%').props.accessibilityState).toEqual({ selected: false });
  });

  test('reapplies the initial wheel position on the frame after its content is laid out', async () => {
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

    await act(async () => {
      capturedOnContentSizeChange?.(320, 1008);
    });

    expect(mockRequestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(queuedAnimationFrame).toEqual(expect.any(Function));

    await act(async () => {
      queuedAnimationFrame?.(0);
    });

    expect(mockScrollTo).toHaveBeenCalledTimes(2);
    expect(mockScrollTo).toHaveBeenLastCalledWith({ animated: false, y: 616 });
  });

  test('centres a previously stored energy value with the same wheel geometry', async () => {
    await act(async () => {
      render(
        <DailyEnergyCheckIn
          initialEnergyPercent={40}
          onRequestClose={() => {}}
          onSave={async () => {}}
          visible
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      capturedOnContentSizeChange?.(320, 924);
    });

    expect(mockScrollTo).toHaveBeenCalledWith({ animated: false, y: 308 });
  });
});
