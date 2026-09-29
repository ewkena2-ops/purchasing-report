# Daily Purchasing & Materials Report

Klever Küche's daily purchasing report for the purchasing officer, submitted to operations and finance by 5:30 PM.

**Live:** https://ewkena2-ops.github.io/purchasing-report/

## Sections

1. **Purchase requests & bank status**: the approver is set by amount (below / from the approval limit); a cheque issued without confirmed funds or approval is flagged
2. **Cheques delivered**: supplier confirmation, materials delivery date, documents to finance within 24 hours
3. **Materials received / in transit**: late arrivals, defects, storekeeper confirmation
4. **Supplier credit & outstanding balances**: opening, new credit, payments, closing, next due and overdue, calculated from the Credit & payments ledger (oldest credit is paid first)
5. **Cost variance & overrun alerts**: contract value against purchase cost; overruns without a written explanation are flagged
6. **Missing data / outstanding BOMs**
7. **Defective materials & supplier issues**
8. **Cash requirements for tomorrow**, with a 7-day forecast (cash requests + supplier payments due)
9. **Daily summary**: the written summary, plus a suggested summary built from the day's data
10. **Compliance checklist**: checked automatically; "Mark as sent" records the time against the deadline

## Using it

- Pick the **date** at the top. **Data sheet** has one tab per part. Type rows, or **Import Excel / CSV**. **Export Excel** makes a backup.
- **Settings** holds the names, deadline, bank, approval limit and currency.
- **Download PDF** makes the day's report (about 3 pages).

## Login and access

Records are shared online through a small Cloudflare server (Worker + D1 database, free plan). Everyone signs in with email and password. One account works on every department page the person has access to.

| Access | Can do |
|---|---|
| Owner | Everything, plus **Team & access**: add people, change access, reset forgotten passwords |
| Enters data | Add and edit records and settings, see the report, make PDFs |
| View only | See the report and records, make PDFs; cannot change anything |

**Adding people:** there is no self sign-up. The owner opens **Data sheet → Team & access**, types the person's name, a login (e.g. `sara@klever.local`, it does not need to be a real email) and a password, picks the access level and taps *Give access*. Then they send the person the link, login and password. A forgotten password is reset there with *Set password*. Someone who already has a login from another department is added without a password.

The server is shared with the Commercial report (code in the commercial-report repo, `server/`). To use the page on one device only (no login), leave `apiUrl` empty in `config.js`.

Amharic text in PDFs uses the bundled Abyssinica SIL font (`fonts/`, SIL Open Font License).
