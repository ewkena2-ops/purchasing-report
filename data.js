/*
 * DAILY PURCHASING & MATERIALS REPORT — DATA FILE
 * ------------------------------------------------------------------
 * Enter records on the page: click "Data sheet". Records are saved on the
 * device you type them on. To publish them for everyone, use
 * "Download data.js" in the Data sheet and upload that file here.
 *
 * Dates are "YYYY-MM-DD". Amounts are plain numbers (no commas).
 */
window.REPORT_DATA = {
  sample: false,
  company: {
    name: "Klever Küche",
    currency: "ETB",
    locale: "en-US",
    preparedBy: "Getachew (Purchasing Officer)",
    submittedTo: "Liu (Operations) & Betty (Finance)",
    deadline: "17:30",
    bank: "ZamZam Bank",
    approverLow: "Betty",
    approverHigh: "Kidan",
    approvalLimit: 50000,
    storekeeper: "Yordanos",
  },

  // approval: Pending | Approved | Rejected. status: Waiting for cash | Ordered | Cancelled
  requests: [],

  // cheques handed to suppliers
  cheques: [],

  // status: In transit | In store | Delayed
  materials: [],

  // terms: COD | 7 days | 14 days | 30 days | 45 days | 60 days
  suppliers: [],

  // type: Credit taken | Payment made
  ledger: [],

  // contract value, purchase cost and BOM status per job
  jobs: [],

  // status: Open | Replacement pending | Refund pending | Resolved
  issues: [],

  // status: Needed | Paid | Cancelled
  cashNeeds: [],

  // one row per day
  summaries: [],

  // when the report was sent (filled by the "Mark as sent" button)
  sent: [],
};
