export const designTokens = {
  color: {
    primary: '#0A84FF',
    primaryStrong: '#0873D6',
    primarySoft: '#EAF4FF',
    text: {
      primary: '#172033',
      secondary: '#727B89',
      tertiary: '#8A929E',
      inverse: '#FFFFFF',
    },
    surface: {
      canvas: '#F5F7FA',
      base: '#F7F8FB',
      raised: '#FFFFFF',
      subtle: '#F0F2F5',
      info: '#EAF5FF',
      cancelled: '#F0F1F3',
    },
    border: {
      subtle: '#E5E9EF',
      info: '#D8EAFF',
      warning: '#F3DC93',
    },
    feedback: {
      success: {
        base: '#31A866',
        surface: '#D9F7E2',
        foreground: '#176B3A',
      },
      warning: {
        surface: '#FFF3CF',
        foreground: '#6F5500',
        border: '#F3DC93',
      },
      danger: {
        foreground: '#D83931',
      },
    },
    meeting: {
      surface: '#E9EEF6',
      foreground: '#33435B',
      accent: '#7A91AF',
    },
    calendar: {
      progressTrack: '#DCE8F4',
    },
    navigation: {
      inactive: '#737B86',
      background: '#FAFAFC',
    },
    overlay: {
      scrim: 'rgba(23,32,51,0.3)',
    },
  },
  typography: {
    size: {
      micro: 11,
      meta: 12,
      label: 14,
      body: 16,
      sectionTitle: 18,
      screenTitle: 24,
      display: 28,
    },
    lineHeight: {
      micro: 14,
      meta: 16,
      label: 18,
      body: 22,
      sectionTitle: 23,
      screenTitle: 29,
      display: 34,
    },
    weight: {
      regular: '400',
      semibold: '600',
      bold: '700',
    },
    tracking: {
      title: -0.4,
    },
  },
  space: {
    2: 2,
    4: 4,
    6: 6,
    8: 8,
    10: 10,
    12: 12,
    16: 16,
    20: 20,
    24: 24,
    32: 32,
  },
  radius: {
    compact: 8,
    control: 10,
    row: 12,
    card: 18,
    sheet: 20,
    pill: 999,
  },
  size: {
    touchTargetMin: 44,
    tabBar: 60,
    floatingAction: 48,
    progressRing: 58,
    progressRingStroke: 7,
  },
  elevation: {
    card: {
      shadowColor: '#192538',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.035,
      shadowRadius: 9,
      elevation: 1,
    },
    floatingAction: {
      shadowColor: '#0A84FF',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 4,
    },
  },
  state: {
    pressedOpacity: 0.78,
    disabledOpacity: 0.55,
  },
} as const;
