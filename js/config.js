/* WAITLIST_ENDPOINT: URL that accepts POST {"email","consent","website","source"} as JSON.
   While empty, the form says the waitlist is not open yet and stores nothing. */
window.SITE_CONFIG = {
  WAITLIST_ENDPOINT: 'https://api-production-8e01.up.railway.app/api/waitlist',
  POLL_ENDPOINT: 'https://api-production-8e01.up.railway.app/api/poll',
  BRAND: 'Limitward'
};
