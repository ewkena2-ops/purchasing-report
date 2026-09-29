// Online connection: the Cloudflare Worker that stores the shared records.
// Access (owner, enters data, view only) is checked by the server. Leave apiUrl
// empty to keep records on this device only.
window.REPORT_CONFIG = {
  apiUrl: "https://klever-reports-api.ewkena2.workers.dev",
  dept: "purchasing",
  label: "Daily Purchasing & Materials Report",
};
