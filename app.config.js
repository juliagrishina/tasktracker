module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    publicSupabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publicSupabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
});
