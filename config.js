// Online connection: the Cloudflare Worker that stores the shared records.
// No login: the report's full link carries a secret code (?k=...) that the
// server checks. Leave apiUrl empty to keep records on this device only.
window.REPORT_CONFIG = {
  apiUrl: "https://klever-reports-api.ewkena2.workers.dev",
  dept: "purchasing",
  label: "Daily Purchasing & Materials Report",
};
