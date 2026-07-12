// OAuth client ID must be set via the VITE_GOOGLE_CLIENT_ID environment variable.
// Add it to your .env.local file — see frontend/.env.example for the full list.
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID as string ??
  '84339563670-eupsvjokv07qpa1vnvl3lltfmjdlrl3i.apps.googleusercontent.com';

export const PRODUCT_ICON_CHOICES = [
  '🥐', '🍞', '🥖', '🧁', '🍰', '🎂',
  '🍪', '🥨', '🥯', '🧇', '🍩', '🥞',
  '🍫', '🍮', '🥧', '🍯'
];
