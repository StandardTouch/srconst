# ---------------------------------------------------------------------------------------------------------
# Repair the permissions of ERPNext's STANDARD roles.  Paste into System Console (type: Python), press Execute.
#
# WHY: once a doctype has Custom DocPerm rows, they REPLACE its standard permission rules completely. Rows were
# created for the SRC roles (and System Manager) on ~390 standard doctypes, so every standard role (Accounts User,
# Sales User, Stock User, Desk User, ...) lost its default access to them.
#
# WHAT IT DOES: for each standard role it compares the permissions in force with ERPNext's defaults (the table at the
# bottom, taken from the apps' doctype definitions) and ADDS what is missing or too low. It never removes or lowers
# anything. It NEVER touches the SRC roles or any custom role: they are not in the table and are skipped even if you
# add them to ONLY_ROLES. Doctypes that do not exist on the site are skipped.
#
# HOW TO RUN (take a backup first):
#   1. Leave the DRY_RUN line as it is (True) and press Execute. It prints, per role, what would change and how
#      many enabled users hold that role (those are the people whose access changes).
#   2. Optional: list roles in ONLY_ROLES to repair a few at a time (empty list = all standard roles).
#   3. Change DRY_RUN to False, tick "Commit", press Execute. At most LIMIT rows are written per run (so the request
#      cannot time out); if rows remain it says so: just run it again, it continues where it stopped.
#   4. Clear the cache (user menu > Reload, or `bench --site <site> clear-cache`) and reload the browser.
# The output lists every row created and every value raised, so a change can be undone by hand.
# ---------------------------------------------------------------------------------------------------------

DRY_RUN = True
ONLY_ROLES = []
LIMIT = 300

# --- ERPNext default permissions: role | doctype | permission level | flags --------------------------------------
# flags: s=select r=read w=write c=create d=delete u=submit x=cancel a=amend p=report e=export i=import h=share
#        t=print m=email o=only the owner's documents
DATA = """Academics User|Department|0|rwcdpehtm
Accounts Manager|Account Closing Balance|0|rpetm
Accounts Manager|Accounting Dimension Filter|0|rwcdpehtm
Accounts Manager|Accounting Dimension|0|rwcdpehtm
Accounts Manager|Accounting Period|0|rwcdpehtm
Accounts Manager|Accounts Settings|0|rwchtm
Accounts Manager|Account|0|rwcdpeihtm
Accounts Manager|Advance Payment Ledger Entry|0|rpehtm
Accounts Manager|Asset Category|0|rwcdpeihtm
Accounts Manager|Asset Movement|0|rwcduxapehtm
Accounts Manager|Asset Value Adjustment|0|rwcduxapehtm
Accounts Manager|Auto Repeat|0|rwcdpehtm
Accounts Manager|Bank Account Subtype|0|rwcdpehtm
Accounts Manager|Bank Account Type|0|rwcdpehtm
Accounts Manager|Bank Account|0|rwcdpeihtm
Accounts Manager|Bank Guarantee|0|rwcduxpehtm
Accounts Manager|Bank Transaction|0|rwcduxpehtm
Accounts Manager|Budget|0|rwcduxapeihtm
Accounts Manager|Buying Settings|0|r
Accounts Manager|Chart of Accounts Importer|0|rwch
Accounts Manager|Cheque Print Template|0|rwcdpehtm
Accounts Manager|Company|0|rwcdpehtm
Accounts Manager|Contact|0|rwcphtm
Accounts Manager|Cost Center Allocation|0|rwcduxapehtm
Accounts Manager|Cost Center|0|rwcdphtm
Accounts Manager|Currency Exchange|0|rwcdphtm
Accounts Manager|Currency|0|r
Accounts Manager|Customer|0|rptm
Accounts Manager|DuckDB Sync|0|rwcdpehtm
Accounts Manager|Dunning Type|0|rwcdpehtm
Accounts Manager|Dunning|0|rwcduxpehtm
Accounts Manager|Exchange Rate Revaluation|0|rwcduxapehtm
Accounts Manager|Finance Book|0|rwcdpehtm
Accounts Manager|Fiscal Year|0|r
Accounts Manager|GL Entry|0|rpetm
Accounts Manager|Incoterm|0|rwcdpehtm
Accounts Manager|Item Tax Template|0|rwcdpehtm
Accounts Manager|Journal Entry Template|0|rwcdpehtm
Accounts Manager|Journal Entry|0|rwcduxapeihtm
Accounts Manager|Ledger Health Monitor|0|rwcdhtm
Accounts Manager|Ledger Merge|0|rwcpehtm
Accounts Manager|Lower Deduction Certificate|0|rwcdpehtm
Accounts Manager|Loyalty Point Entry|0|rpetm
Accounts Manager|Mode of Payment|0|rwcphtm
Accounts Manager|Monthly Distribution|0|rwcdphtm
Accounts Manager|Monthly Distribution|2|rp
Accounts Manager|POS Invoice|0|rwcduxaphtm
Accounts Manager|POS Invoice|1|rw
Accounts Manager|POS Profile|0|rwcdphtm
Accounts Manager|Party Link|0|rwcdpehtm
Accounts Manager|Party Type|0|rpehtm
Accounts Manager|Payment Entry|0|rwcduxapeihtm
Accounts Manager|Payment Gateway Account|0|rwcdpehtm
Accounts Manager|Payment Ledger Entry|0|rpehtm
Accounts Manager|Payment Order|0|rwcduxapehtm
Accounts Manager|Payment Reconciliation|0|rwcdh
Accounts Manager|Payment Request|0|rwcduxapehtm
Accounts Manager|Payment Terms Template|0|rwcdpehtm
Accounts Manager|Payment Term|0|rwcdpehtm
Accounts Manager|Period Closing Voucher|0|rwcduxaphtm
Accounts Manager|Pricing Rule|0|rwcdpeih
Accounts Manager|Process Deferred Accounting|0|rwcduxpehtm
Accounts Manager|Process Payment Reconciliation Log|0|rwcdpehtm
Accounts Manager|Process Payment Reconciliation|0|rwcduxah
Accounts Manager|Process Period Closing Voucher|0|rwcduxpehtm
Accounts Manager|Process Statement Of Accounts|0|rwcdpehtm
Accounts Manager|Process Subscription|0|rwcdupehtm
Accounts Manager|Promotional Scheme|0|rwcdpehtm
Accounts Manager|Purchase Invoice|0|rwcduxaphtm
Accounts Manager|Purchase Invoice|1|rw
Accounts Manager|Repost Item Valuation|0|rwcdupehtm
Accounts Manager|Repost Payment Ledger|0|rwcdupehtm
Accounts Manager|Repost Payment Ledger|1|rwpehtm
Accounts Manager|Sales Invoice|0|rwcduxaphtm
Accounts Manager|Sales Invoice|1|rw
Accounts Manager|Sales Taxes and Charges Template|0|rwcdphtm
Accounts Manager|Share Transfer|0|rwcduxpehtm
Accounts Manager|Share Type|0|rwcdpehtm
Accounts Manager|Shareholder|0|rwcdpehtm
Accounts Manager|Shipping Rule|0|rwcdpeihtm
Accounts Manager|South Africa VAT Settings|0|rwcdpehtm
Accounts Manager|Stock Ledger Entry|0|rpe
Accounts Manager|Subscription Plan|0|rwcdpehtm
Accounts Manager|Subscription Settings|0|rwcdhtm
Accounts Manager|Subscription|0|rwcdpehtm
Accounts Manager|Supplier|0|rptm
Accounts Manager|Tax Category|0|rwcdpehtm
Accounts Manager|Tax Rule|0|rwcdpehtm
Accounts Manager|Tax Withholding Category|0|rwcdpehtm
Accounts Manager|Terms and Conditions|0|rwcdphtm
Accounts Manager|Unreconcile Payment|0|srwcduh
Accounts User|Account Closing Balance|0|rpetm
Accounts User|Accounting Dimension Filter|0|rwcdpehtm
Accounts User|Accounting Period|0|rwcdpehtm
Accounts User|Account|0|rwcdpeihtm
Accounts User|Address|0|rwcphtm
Accounts User|Advance Payment Ledger Entry|0|rpehtm
Accounts User|Asset Activity|0|rdphm
Accounts User|Asset Category|0|rwcdpeihtm
Accounts User|Asset Depreciation Schedule|0|rwcduxapehtm
Accounts User|Asset Shift Allocation|0|rwcduxapehtm
Accounts User|Asset Shift Factor|0|rwcdpehtm
Accounts User|Asset Value Adjustment|0|rwcduxapehtm
Accounts User|Asset|0|rwcduxapeihtm
Accounts User|Auto Repeat|0|rwcdpehtm
Accounts User|Bank Account Subtype|0|rwcdpehtm
Accounts User|Bank Account Type|0|rwcdpehtm
Accounts User|Bank Account|0|rwcdpehtm
Accounts User|Bank Clearance|0|rwch
Accounts User|Bank Guarantee|0|rwcupehtm
Accounts User|Bank Transaction|0|rwcdupehtm
Accounts User|Brand|0|rptm
Accounts User|Buying Settings|0|r
Accounts User|Cheque Print Template|0|rpehtm
Accounts User|Company|0|rtm
Accounts User|Contact|0|rwcphtm
Accounts User|Cost Center Allocation|0|rwcduxapehtm
Accounts User|Cost Center|0|rptm
Accounts User|Coupon Code|0|rwcdpehtm
Accounts User|Currency Exchange Settings|0|rhtm
Accounts User|Currency Exchange|0|rptm
Accounts User|Currency|0|r
Accounts User|Customer Group|0|rphtm
Accounts User|Customer|0|rptm
Accounts User|Delivery Note|0|rp
Accounts User|Dunning|0|rwcdpehtm
Accounts User|Exchange Rate Revaluation|0|rwcduxapehtm
Accounts User|Finance Book|0|rpehtm
Accounts User|Fiscal Year|0|r
Accounts User|GL Entry|0|rpetm
Accounts User|Incoterm|0|r
Accounts User|Item Group|0|rptm
Accounts User|Item Tax Template|0|rpehtm
Accounts User|Item|0|r
Accounts User|Journal Entry Template|0|rwcdpehtm
Accounts User|Journal Entry|0|rwcduxaphtm
Accounts User|Ledger Health Monitor|0|rwcdhtm
Accounts User|Location|0|rwcdpehtm
Accounts User|Lower Deduction Certificate|0|rwcdpehtm
Accounts User|Loyalty Point Entry|0|rpetm
Accounts User|Mode of Payment|0|rp
Accounts User|POS Invoice|0|rwcuaphtm
Accounts User|POS Profile|0|rptm
Accounts User|POS Settings|0|rwhtm
Accounts User|Party Link|0|rwcdpehtm
Accounts User|Party Type|0|rpehtm
Accounts User|Payment Entry|0|rwcduxapeihtm
Accounts User|Payment Ledger Entry|0|rpehtm
Accounts User|Payment Order|0|rwcduxapehtm
Accounts User|Payment Reconciliation|0|rwcdh
Accounts User|Payment Request|0|rwcdpehtm
Accounts User|Payment Terms Template|0|rwcdpehtm
Accounts User|Payment Term|0|rwcdpehtm
Accounts User|Process Deferred Accounting|0|rwcdupehtm
Accounts User|Process Payment Reconciliation Log|0|rwcdpehtm
Accounts User|Process Payment Reconciliation|0|rwcduxah
Accounts User|Process Statement Of Accounts|0|rwcdpehtm
Accounts User|Process Subscription|0|rwcdupehtm
Accounts User|Promotional Scheme|0|rwcdpehtm
Accounts User|Purchase Invoice|0|rwcuxaphtm
Accounts User|Purchase Receipt|0|rp
Accounts User|Repost Payment Ledger|0|rwcpehtm
Accounts User|Sales Invoice|0|rwcuaphtm
Accounts User|Sales Order|0|rtm
Accounts User|Share Transfer|0|rwcdpehtm
Accounts User|Share Type|0|rwcdpehtm
Accounts User|Shareholder|0|rwcdpehtm
Accounts User|Shipping Rule|0|rptm
Accounts User|South Africa VAT Settings|0|rwcdpehtm
Accounts User|Subcontracting Receipt|0|rp
Accounts User|Subscription Plan|0|rwcdpehtm
Accounts User|Subscription Settings|0|rwcdhtm
Accounts User|Subscription|0|rwcdpehtm
Accounts User|Supplier Group|0|rphtm
Accounts User|Supplier|0|r
Accounts User|Tax Category|0|rpehtm
Accounts User|Tax Withholding Category|0|rwcdpehtm
Accounts User|Terms and Conditions|0|rpehtm
Accounts User|Territory|0|rphtm
Accounts User|Timesheet|0|rwcduxapm
Accounts User|Timesheet|1|rw
Accounts User|Unreconcile Payment|0|srwcduh
Accounts User|Warehouse Type|0|rpehtm
Accounts User|Warehouse|0|rptm
Administrator|Bisect Accounting Statements|0|rwcdhtm
Administrator|Bisect Nodes|0|rwcdpehtm
Administrator|Client Script|0|rwcdphtm
Administrator|Custom Field|0|rwcdphtm
Administrator|Dashboard Chart Source|0|rwcdpehtm
Administrator|DocType|0|rwcdphtm
Administrator|Domain|0|rwcpehtm
Administrator|Dunning Type|0|rwcdpehtm
Administrator|Homepage|0|rwcdhtm
Administrator|Module Def|0|srwcdphtm
Administrator|Onboarding Step|0|rwcdpehtm
Administrator|POS Closing Entry|0|rwcduxpehtm
Administrator|POS Invoice Merge Log|0|rwcduxpehtm
Administrator|POS Opening Entry|0|rwcduxpehtm
Administrator|Page|0|rwchtm
Administrator|Patch Log|0|rptm
Administrator|Property Setter|0|rwcdphtm
Administrator|RQ Job|0|rdpehtm
Administrator|Recorder|0|rpehtm
Administrator|Report|0|rwcdphtm
Administrator|Repost Accounting Ledger Settings|0|srwcdhtm
Administrator|Salutation|0|rwcdpehtm
Administrator|Transaction Log|0|rpehtm
Administrator|User Type|0|rwcpehtm
Administrator|Version|0|rd
Administrator|Website Theme|0|rwcdei
Agriculture Manager|Location|0|rwcdpehtm
Agriculture User|Location|0|rwpehtm
All|Address|0|rwceto
All|Communication|0|rdmo
All|Connected App|0|r
All|Contact|0|rwcdpo
All|Country|0|rptm
All|Event|0|rpehtm
All|File|0|rwcd
All|Gender|0|r
All|Language|0|r
All|Module Def|0|srp
All|Notification Log|0|rpehtm
All|Notification Settings|0|rwcpehtm
All|POS Invoice|1|r
All|Payment Terms Template|0|spehtm
All|Personal Data Download Request|0|ro
All|Print Heading|0|r
All|Request for Quotation|1|r
All|Sales Invoice|1|r
All|Salutation|0|r
All|Tag Link|0|rwcpehtm
All|Tag|0|rwcpehtm
All|ToDo|0|rwcdphtm
All|Token Cache|0|rdo
All|Video|0|rwcdpehtmo
All|Voice Call Settings|0|rwcdpehtm
All|Voice Call Settings|2|rpehtm
All|Website Settings|1|r
Auditor|Account Closing Balance|0|rpe
Auditor|Account|0|rptm
Auditor|Advance Payment Ledger Entry|0|rpehtm
Auditor|Company|0|s
Auditor|Cost Center|0|rpe
Auditor|Finance Book|0|rpehtm
Auditor|Fiscal Year|0|r
Auditor|GL Entry|0|rpe
Auditor|Journal Entry Template|0|rpehtm
Auditor|Journal Entry|0|rptm
Auditor|Loyalty Point Entry|0|rpetm
Auditor|Payment Ledger Entry|0|rpehtm
Auditor|Purchase Invoice|0|rptm
Auditor|South Africa VAT Settings|0|rpehtm
Blogger|Blog Category|0|rtm
Blogger|Blog Post|0|rwcphtm
Blogger|Blog Settings|0|rhtm
Blogger|Blogger|0|rwhtm
Customer|Customer Group|0|spehtm
Customer|Territory|0|spehtm
Dashboard Manager|Dashboard Chart|0|rwcdpehtm
Dashboard Manager|Dashboard|0|rwcdpehtm
Dashboard Manager|Number Card|0|rwcdpehtm
Delivery Manager|Delivery Note|0|rwcduxapehtm
Delivery Manager|Delivery Settings|0|rwcdhtm
Delivery Manager|Delivery Trip|0|rwcduxapehtm
Delivery Manager|Driver|0|rwpehtm
Delivery Manager|Serial and Batch Bundle|0|rwcduxpehtm
Delivery Manager|Vehicle|0|rwpehtm
Delivery User|Delivery Note|0|rwcduxapehtm
Delivery User|Delivery Trip|0|rwcduxapehtm
Delivery User|Driver|0|rpt
Delivery User|Serial and Batch Bundle|0|rwcduxpehtm
Delivery User|Vehicle|0|rpt
Desk User|Calendar View|0|r
Desk User|Custom HTML Block|0|rpehtm
Desk User|Custom HTML Block|0|rwcdpehtmo
Desk User|Dashboard Chart|0|rpehtm
Desk User|Dashboard Settings|0|rwpehtm
Desk User|Dashboard|0|rpehtm
Desk User|DocType Layout|0|r
Desk User|Document Follow|0|rwcdpehtm
Desk User|Email Template|0|r
Desk User|Energy Point Log|0|rp
Desk User|Event|0|rwcphtm
Desk User|Form Tour|0|r
Desk User|Google Calendar|0|rwcdpehtmo
Desk User|Google Contacts|0|rwcdo
Desk User|Item Group|0|spehtm
Desk User|Item|0|spehtm
Desk User|Kanban Board|0|r
Desk User|Kanban Board|0|rwcdo
Desk User|Lead|1|rp
Desk User|Letter Head|0|r
Desk User|List Filter|0|rwcdpehtm
Desk User|Marketing Campaign|0|s
Desk User|Module Onboarding|0|rpehtm
Desk User|Network Printer Settings|0|rpehtm
Desk User|Note|0|rpet
Desk User|Note|0|wcdhmo
Desk User|Note|1|r
Desk User|Number Card|0|rpehtm
Desk User|Onboarding Step|0|rpehtm
Desk User|Print Format|0|s
Desk User|Print Heading|0|r
Desk User|Project|1|rp
Desk User|Quality Action|0|rwcdpehtm
Desk User|Quality Feedback|0|rwcdpehtm
Desk User|Quality Goal|0|rwcdpehtm
Desk User|Quality Meeting|0|rwcdpehtm
Desk User|Quality Procedure|0|rwcdpehtm
Desk User|Quality Review|0|rwcdpehtm
Desk User|Reminder|0|rwcdo
Desk User|Report|0|rptm
Desk User|Service Level Agreement|0|r
Desk User|Submission Queue|0|ro
Desk User|User Group|0|r
Desk User|User|0|s
Desk User|Workflow Action|0|rd
Desk User|Workflow State|0|s
Desk User|Workspace|0|rwcdpehtm
Employee|Activity Type|0|r
Employee|Appointment|0|rwcdpehtm
Employee|Call Log|0|r
Employee|Company|0|r
Employee|Cost Center|0|spehtm
Employee|Department|0|s
Employee|Employee|0|rptm
Employee|Fiscal Year|0|r
Employee|Non Conformance|0|rwcdpehtm
Employee|Project|0|spehtm
Employee|Timesheet|0|rwc
Fleet Manager|Driver|0|rpehtm
Fleet Manager|Vehicle|0|rwcdpehtm
Fulfillment User|Delivery Trip|0|rwcduxapehtm
HR Manager|Appointment Booking Settings|0|rwchtm
HR Manager|Branch|0|rwcdphtm
HR Manager|Contract Template|0|rpehtm
HR Manager|Contract|0|rwcduxapehtm
HR Manager|Department|0|rwcdpeihtm
HR Manager|Driver|0|rwcdpehtm
HR Manager|Employee|0|rwcdpeihtm
HR Manager|Holiday List|0|rwcdphtm
HR Manager|Terms and Conditions|0|rwc
HR User|Branch|0|rwcdphtm
HR User|Department|0|rwcdphtm
HR User|Designation|0|rwcdphtm
HR User|Driver|0|rwcdpehtm
HR User|Employee|0|rwcdpeihtm
HR User|Terms and Conditions|0|s
HR User|Timesheet|0|rwcduxapehtm
Inbox User|Communication|0|rcdetm
Inbox User|Email Account|0|r
Item Manager|Batch|0|rwcdpeihtm
Item Manager|Brand|0|rwcdpeihtm
Item Manager|Item Alternative|0|rwcdpehtm
Item Manager|Item Attribute|0|rwcdph
Item Manager|Item Group|0|rwcdpeihtm
Item Manager|Item Manufacturer|0|rwcdpehtm
Item Manager|Item Variant Settings|0|rwchtm
Item Manager|Item|0|rwcdpeihtm
Item Manager|Packing Slip|0|rwcduxaphtm
Item Manager|Serial No|0|rwcdphtm
Item Manager|UOM|0|rwcdpeihtm
Item Manager|Warehouse Type|0|rwcdpehtm
Item Manager|Warehouse|0|rwcdpeihtm
Knowledge Base Contributor|Help Article|0|rwc
Knowledge Base Editor|Help Article|0|rwcdpeitm
Maintenance Manager|Competitor|0|r
Maintenance Manager|Contact|0|rwcphtm
Maintenance Manager|Maintenance Schedule|0|rwcduxaphtm
Maintenance Manager|Quotation Lost Reason|0|r
Maintenance Manager|Quotation|0|rwcduxaphtm
Maintenance Manager|Quotation|1|rp
Maintenance User|Address|0|rwcphtm
Maintenance User|Competitor|0|r
Maintenance User|Contact|0|rwcphtm
Maintenance User|Item|0|r
Maintenance User|Maintenance Visit|0|rwcduxaphtm
Maintenance User|Quotation Lost Reason|0|r
Maintenance User|Quotation|0|rwcduxaphtm
Maintenance User|Quotation|1|rp
Maintenance User|Sales Order|0|rwcduxaphtm
Maintenance User|Territory|0|r
Maintenance User|Warranty Claim|0|rwcdphtm
Manufacturing Manager|Asset Capitalization|0|rwcduxapehtm
Manufacturing Manager|Asset Repair|0|rwcduxapeihtm
Manufacturing Manager|BOM Creator|0|rwcduxphtm
Manufacturing Manager|BOM Update Log|0|rwcupehtm
Manufacturing Manager|BOM Update Tool|0|rwch
Manufacturing Manager|BOM|0|rwcduxphtm
Manufacturing Manager|Downtime Entry|0|rwcdpehtm
Manufacturing Manager|Job Card|0|rwcduxapehtm
Manufacturing Manager|Manufacturing Settings|0|rwch
Manufacturing Manager|Operation|0|rwcdpeih
Manufacturing Manager|Pick List|0|rwcduxapehtm
Manufacturing Manager|Request for Quotation|0|rwcduxaphtm
Manufacturing Manager|Routing|0|rwcdpehtm
Manufacturing Manager|Serial and Batch Bundle|0|rwcduxpehtm
Manufacturing Manager|Stock Entry Type|0|rwcdpehtm
Manufacturing Manager|Stock Entry|0|rwcduxaphtm
Manufacturing Manager|Supplier Quotation|0|rwcduxaphtm
Manufacturing User|Asset Maintenance Log|0|rwcduxapehtm
Manufacturing User|Asset Maintenance Team|0|rwcdpehtm
Manufacturing User|Asset Maintenance|0|rwcdpehtm
Manufacturing User|BOM Creator|0|rwcduxphtm
Manufacturing User|BOM|0|rwcduxphtm
Manufacturing User|Downtime Entry|0|rwcdpehtm
Manufacturing User|Item|0|r
Manufacturing User|Job Card|0|rwcduxapehtm
Manufacturing User|Operation|0|rwcdeih
Manufacturing User|Pick List|0|rwcduxapehtm
Manufacturing User|Price List|0|r
Manufacturing User|Production Plan|0|rwcduxahtm
Manufacturing User|Quality Inspection Parameter Group|0|rwcdpehtm
Manufacturing User|Quality Inspection Parameter|0|rwcdpehtm
Manufacturing User|Quality Inspection Template|0|rwcdpehtm
Manufacturing User|Routing|0|rwcdpehtm
Manufacturing User|Serial and Batch Bundle|0|rwcduxpehtm
Manufacturing User|Stock Entry|0|rwcduxaphtm
Manufacturing User|Timesheet|0|rwcduxapehtm
Manufacturing User|Warehouse Type|0|rpehtm
Manufacturing User|Warehouse|0|r
Manufacturing User|Work Order|0|rwcduxapeihtm
Manufacturing User|Workstation Type|0|rwcdphtm
Manufacturing User|Workstation|0|rwcdphtm
Newsletter Manager|Email Group Member|0|rwcdpeihtm
Newsletter Manager|Email Group|0|rwcdpeihtm
Newsletter Manager|Marketing Campaign|0|rwcdpehtm
Newsletter Manager|Newsletter|0|rwcdpehtm
Prepared Report User|Prepared Report|0|rpehtm
Projects Manager|Project Type|0|rwcdpehtm
Projects Manager|Project|0|rwcdpehtm
Projects Manager|Project|1|rwdpehtm
Projects Manager|Task Type|0|rwcdpehtm
Projects User|Activity Cost|0|rwcdpehtm
Projects User|Activity Type|0|rwcphtm
Projects User|Company|0|r
Projects User|Project Type|0|rpehtm
Projects User|Project Update|0|rwcdupehtm
Projects User|Project|0|rwcdphtm
Projects User|Task Type|0|rpehtm
Projects User|Task|0|rwcdphtm
Projects User|Timesheet|0|rwcduxaphtm
Purchase Manager|Bin|0|rp
Purchase Manager|Buying Settings|0|rwcehtm
Purchase Manager|Contact|0|rwcphtm
Purchase Manager|Contract Template|0|rpehtm
Purchase Manager|Contract|0|rwcduxapehtm
Purchase Manager|Incoterm|0|rwcdpehtm
Purchase Manager|Material Request|0|rwcduxapeihtm
Purchase Manager|Pricing Rule|0|rwcdph
Purchase Manager|Purchase Order|0|rwcduxaphtm
Purchase Manager|Purchase Order|1|rw
Purchase Manager|Purchase Taxes and Charges Template|0|rptm
Purchase Manager|Request for Quotation|0|rwcduxaphtm
Purchase Manager|Request for Quotation|1|rw
Purchase Manager|Serial and Batch Bundle|0|rwcduxpehtm
Purchase Manager|Stock Reservation Entry|0|rwcduxpehtm
Purchase Manager|Subcontracting Order|0|rwcduxaphtm
Purchase Manager|Subcontracting Order|1|rw
Purchase Manager|Supplier Group|0|rptm
Purchase Manager|Supplier Group|1|r
Purchase Manager|Supplier Quotation|0|rwcduxaphtm
Purchase Manager|Supplier Quotation|1|rw
Purchase Manager|Supplier|0|rwptm
Purchase Master Manager|Contact|0|rwcdphtm
Purchase Master Manager|Item Price|0|rwcdpeihtm
Purchase Master Manager|Price List|0|rwcdph
Purchase Master Manager|Purchase Taxes and Charges Template|0|rwcdphtm
Purchase Master Manager|Supplier Group|0|rwcdpeihtm
Purchase Master Manager|Supplier Group|1|rw
Purchase Master Manager|Supplier|0|rwcdpeihtm
Purchase User|Accounts Settings|0|r
Purchase User|Account|0|rptm
Purchase User|Address|0|rwcphtm
Purchase User|Bin|0|rptm
Purchase User|Brand|0|rptm
Purchase User|Buying Settings|0|r
Purchase User|Company|0|r
Purchase User|Contact|0|rwcphtm
Purchase User|Cost Center|0|r
Purchase User|Currency Exchange|0|rptm
Purchase User|Currency|0|r
Purchase User|Fiscal Year|0|r
Purchase User|Incoterm|0|r
Purchase User|Item Group|0|rptm
Purchase User|Item|0|r
Purchase User|Material Request|0|rwcduxaphtm
Purchase User|Price List|0|rp
Purchase User|Purchase Invoice|0|rptm
Purchase User|Purchase Order|0|rwcduxaphtm
Purchase User|Purchase Receipt|0|rwcduxaphtm
Purchase User|Purchase Taxes and Charges Template|0|r
Purchase User|Request for Quotation|0|rwcaphtm
Purchase User|Serial and Batch Bundle|0|rwcduxpehtm
Purchase User|Stock Reservation Entry|0|rwcduxpehtm
Purchase User|Subcontracting Order|0|rwcduxaphtm
Purchase User|Subcontracting Receipt|0|rwcduxaphtm
Purchase User|Supplier Group|0|rptm
Purchase User|Supplier Group|1|r
Purchase User|Supplier Quotation|0|rwcuaphtm
Purchase User|Supplier|0|rptm
Purchase User|Terms and Conditions|0|r
Purchase User|Warehouse Type|0|rpehtm
Purchase User|Warehouse|0|rptm
Quality Manager|Asset Activity|0|rdphm
Quality Manager|Asset Capitalization|0|rwcduxapehtm
Quality Manager|Asset Category|0|rwcdpehtm
Quality Manager|Asset Depreciation Schedule|0|rwcduxpehtm
Quality Manager|Asset Maintenance|0|rwcdpehtm
Quality Manager|Asset Repair|0|rwcduxapeihtm
Quality Manager|Asset|0|rwcduxpehtm
Quality Manager|Quality Inspection Parameter Group|0|rwcdpehtm
Quality Manager|Quality Inspection Parameter|0|rwcdpehtm
Quality Manager|Quality Inspection Template|0|rwcdpehtm
Quality Manager|Quality Inspection|0|rwcduxaphtm
Quality Manager|Quality Review|0|rwcdpehtm
Report Manager|Auto Email Report|0|rwcdpehtm
Report Manager|Report|0|rwcdphtm
Sales Manager|Appointment Booking Settings|0|rwcdhtm
Sales Manager|Appointment|0|rwcdpehtm
Sales Manager|Bin|0|rp
Sales Manager|CRM Settings|0|rwcdhtm
Sales Manager|Campaign|0|rwcdpeitm
Sales Manager|Competitor|0|r
Sales Manager|Contact|0|rwcphtm
Sales Manager|Contract Template|0|rpehtm
Sales Manager|Contract|0|rwcduxapehtm
Sales Manager|Coupon Code|0|rwcdpehtm
Sales Manager|Customer Group|0|rptm
Sales Manager|Customer Group|1|r
Sales Manager|Customer|0|rptm
Sales Manager|DuckDB Sync|0|rwcdpehtm
Sales Manager|Incoterm|0|rwcdpehtm
Sales Manager|Industry Type|0|rwcphtm
Sales Manager|Lead Source|0|rwcdpehtm
Sales Manager|Lead|0|rwcdpeihtm
Sales Manager|Lead|1|rp
Sales Manager|Market Segment|0|rwcdpehtm
Sales Manager|Opportunity Lost Reason|0|rwcdpehtm
Sales Manager|Opportunity Type|0|rwcdpehtm
Sales Manager|Opportunity|0|rwcdpeihtm
Sales Manager|POS Closing Entry|0|rwcuxpehtm
Sales Manager|POS Invoice Merge Log|0|rwcduxpehtm
Sales Manager|POS Opening Entry|0|rwcuxpehtm
Sales Manager|Packing Slip|0|rwcduxaphtm
Sales Manager|Pricing Rule|0|rwcdph
Sales Manager|Promotional Scheme|0|rwcdpehtm
Sales Manager|Prospect|0|rwcdpehtm
Sales Manager|Quotation Lost Reason|0|r
Sales Manager|Quotation|0|rwcduxapeihtm
Sales Manager|Quotation|1|rwp
Sales Manager|Sales Order|0|rwcduxapeihtm
Sales Manager|Sales Order|1|rw
Sales Manager|Sales Partner|0|rptm
Sales Manager|Sales Person|0|rptm
Sales Manager|Sales Stage|0|rwcdpehtm
Sales Manager|Selling Settings|0|rwchtm
Sales Manager|Share Type|0|rwcdpehtm
Sales Manager|Stock Reservation Entry|0|rwcduxpehtm
Sales Manager|Territory|0|rptm
Sales Master Manager|CRM Settings|0|rwcdhtm
Sales Master Manager|Campaign|0|rwcdphtm
Sales Master Manager|Competitor|0|rwcdpehtm
Sales Master Manager|Contact|0|rwcdphtm
Sales Master Manager|Customer Group|0|rwcdpeihtm
Sales Master Manager|Customer Group|1|rw
Sales Master Manager|Customer|0|rwcdpeihtm
Sales Master Manager|Customer|1|rw
Sales Master Manager|Industry Type|0|rwcphtm
Sales Master Manager|Item Price|0|rwcdpeihtm
Sales Master Manager|Opportunity Lost Reason|0|rwcdpehtm
Sales Master Manager|Price List|0|rwcdpeih
Sales Master Manager|Quotation Lost Reason|0|rwcdphtm
Sales Master Manager|Sales Partner|0|rwcphtm
Sales Master Manager|Sales Person|0|rwcdphtm
Sales Master Manager|Sales Taxes and Charges Template|0|rwcdphtm
Sales Master Manager|Share Type|0|rwcdpehtm
Sales Master Manager|Shipping Rule|0|rwcdpeihtm
Sales Master Manager|Terms and Conditions|0|rwcdpeihtm
Sales Master Manager|Territory|0|rwcdpeihtm
Sales User|Accounts Settings|0|r
Sales User|Account|0|rptm
Sales User|Address|0|rwcphtm
Sales User|Appointment|0|rwcpehtm
Sales User|Bin|0|rptm
Sales User|Brand|0|rptm
Sales User|Campaign|0|rptm
Sales User|Company|0|r
Sales User|Competitor|0|r
Sales User|Contact|0|rwcphtm
Sales User|Cost Center|0|r
Sales User|Currency Exchange|0|rptm
Sales User|Currency|0|r
Sales User|Customer Group|0|rptm
Sales User|Customer Group|1|r
Sales User|Customer|0|rwcphtm
Sales User|Customer|1|r
Sales User|Delivery Note|0|rwcduxaphtm
Sales User|Designation|0|r
Sales User|Fiscal Year|0|r
Sales User|Incoterm|0|r
Sales User|Industry Type|0|rptm
Sales User|Installation Note|0|rwcduxaphtm
Sales User|Installation Note|1|rp
Sales User|Item Group|0|rptm
Sales User|Item|0|r
Sales User|Lead Source|0|rwcpehtm
Sales User|Lead|0|rwcphtm
Sales User|Lead|1|rp
Sales User|Opportunity Lost Reason|0|rwcdpehtm
Sales User|Opportunity Type|0|rpehtm
Sales User|Opportunity|0|rwcdphtm
Sales User|POS Invoice Merge Log|0|rwcdpehtm
Sales User|POS Settings|0|rwhtm
Sales User|Packing Slip|0|rwcduxaphtm
Sales User|Price List|0|rp
Sales User|Product Bundle|0|rwcdphtm
Sales User|Prospect|0|rpehtm
Sales User|Quotation Lost Reason|0|r
Sales User|Quotation|0|rwcduxaphtm
Sales User|Quotation|1|rp
Sales User|Sales Order|0|rwcduxaphtm
Sales User|Sales Partner|0|rptm
Sales User|Sales Person|0|rptm
Sales User|Sales Taxes and Charges Template|0|rptm
Sales User|Share Type|0|rwcdpehtm
Sales User|Shipping Rule|0|rptm
Sales User|Stock Reservation Entry|0|rwcduxpehtm
Sales User|Stock Settings|0|r
Sales User|Terms and Conditions|0|r
Sales User|Territory|0|rptm
Sales User|Warehouse Type|0|rpehtm
Sales User|Warehouse|0|rptm
Script Manager|Server Script|0|rwcdpehtm
Stock Manager|Asset Movement|0|rwcduxapehtm
Stock Manager|Bin|0|rp
Stock Manager|Buying Settings|0|r
Stock Manager|Closing Stock Balance|0|rwcduxpehtm
Stock Manager|Customer|0|rptm
Stock Manager|Customs Tariff Number|0|rwcdpehtm
Stock Manager|Delivery Note|0|rwcduxaphtm
Stock Manager|Delivery Note|1|rw
Stock Manager|Fiscal Year|0|r
Stock Manager|Incoterm|0|rwcdpehtm
Stock Manager|Inventory Dimension|0|rwcdpehtm
Stock Manager|Item Alternative|0|rwcdpehtm
Stock Manager|Item Group|0|rpetm
Stock Manager|Item Manufacturer|0|rwcdpehtm
Stock Manager|Item|0|rptm
Stock Manager|Landed Cost Voucher|0|rwcduxapeh
Stock Manager|Location|0|rwcdpehtm
Stock Manager|Manufacturer|0|rwcdpehtm
Stock Manager|Material Request|0|rwcduxaphtm
Stock Manager|Packing Slip|0|rwcduxaphtm
Stock Manager|Pick List|0|rwcduxapehtm
Stock Manager|Product Bundle|0|rwcdphtm
Stock Manager|Purchase Receipt|0|rwcduxaphtm
Stock Manager|Purchase Receipt|1|rw
Stock Manager|Putaway Rule|0|rwcdpehtm
Stock Manager|Putaway Rule|1|rwpehtm
Stock Manager|Quick Stock Balance|0|rwcdh
Stock Manager|Repost Item Valuation|0|rwcduxpehtm
Stock Manager|Serial No|0|rwcdpeitm
Stock Manager|Serial and Batch Bundle|0|rwcduxpehtm
Stock Manager|Shipment|0|rwcduxpehtm
Stock Manager|Stock Entry Type|0|rwcdpehtm
Stock Manager|Stock Entry|0|rwcduxapeihtm
Stock Manager|Stock Reconciliation|0|rwcduxaph
Stock Manager|Stock Reservation Entry|0|rwcduxpehtm
Stock Manager|Stock Settings|0|rwchtm
Stock Manager|Subcontracting Receipt|0|rwcduxaphtm
Stock Manager|Subcontracting Receipt|1|rw
Stock Manager|Supplier|0|rptm
Stock Manager|UOM|0|rptm
Stock Manager|Warehouse Type|0|rwcdpehtm
Stock User|Bin|0|rptm
Stock User|Brand|0|rptm
Stock User|Buying Settings|0|r
Stock User|Closing Stock Balance|0|rwcduxpehtm
Stock User|Company|0|r
Stock User|Customer|0|rptm
Stock User|Customs Tariff Number|0|rpehtm
Stock User|Delivery Note|0|rwcduxaphtm
Stock User|Delivery Trip|0|rwcduxapehtm
Stock User|Fiscal Year|0|r
Stock User|Incoterm|0|r
Stock User|Inventory Dimension|0|r
Stock User|Item Alternative|0|rwcdpehtm
Stock User|Item Group|0|rptm
Stock User|Item Manufacturer|0|rwcdpehtm
Stock User|Item|0|rptm
Stock User|Location|0|rwcdpehtm
Stock User|Manufacturer|0|rpehtm
Stock User|Material Request|0|rwcduxaphtm
Stock User|Packing Slip|0|rwcduxaphtm
Stock User|Pick List|0|rwcduxapehtm
Stock User|Product Bundle|0|rptm
Stock User|Purchase Order|0|rp
Stock User|Purchase Receipt|0|rwcduxaphtm
Stock User|Putaway Rule|0|rpt
Stock User|Quality Inspection Parameter Group|0|rwcdpehtm
Stock User|Quality Inspection Parameter|0|rwcdpehtm
Stock User|Quality Inspection Template|0|rwcdpehtm
Stock User|Quick Stock Balance|0|rwcdh
Stock User|Request for Quotation|0|rptm
Stock User|Sales Order|0|rp
Stock User|Serial No|0|rptm
Stock User|Serial and Batch Bundle|0|rwcduxpehtm
Stock User|Stock Entry Type|0|r
Stock User|Stock Entry|0|rwcduxaphtm
Stock User|Stock Ledger Entry|0|rpet
Stock User|Stock Reservation Entry|0|rwcduxpehtm
Stock User|Subcontracting Order|0|rp
Stock User|Subcontracting Receipt|0|rwcduxaphtm
Stock User|Supplier Quotation|0|rptm
Stock User|Supplier|0|r
Stock User|Terms and Conditions|0|r
Stock User|Territory|0|r
Stock User|UOM|0|rptm
Stock User|Warehouse Type|0|rpehtm
Stock User|Warehouse|0|rptm
Stock User|Work Order|0|rp
Support Team|Issue Type|0|rwcdpehtm
Support Team|Issue|0|rwcdphtm
System Manager|Access Log|0|rdpehtm
System Manager|Accounting Dimension Filter|0|rwcdpehtm
System Manager|Accounting Dimension|0|rwcdpehtm
System Manager|Accounting Period|0|rwcdpehtm
System Manager|Activity Log|0|rphm
System Manager|Activity Type|0|rwcdpeihtm
System Manager|Address Template|0|rwcdpeh
System Manager|Address|0|rwcdpeihtm
System Manager|Appointment Booking Settings|0|rwcdhtm
System Manager|Appointment Booking Settings|1|rwhtm
System Manager|Appointment|0|rwcdpehtm
System Manager|Asset Activity|0|rdphm
System Manager|Asset Movement|0|rwcduxapehtm
System Manager|Asset Shift Allocation|0|rwcdpehtm
System Manager|Asset Shift Factor|0|rwcdpehtm
System Manager|Asset Value Adjustment|0|rwcduxapehtm
System Manager|Assignment Rule|0|rwcdpehtm
System Manager|Audit Trail|0|rwhtm
System Manager|Authorization Rule|0|rwcdphtm
System Manager|Auto Email Report|0|rwcdpehtm
System Manager|Auto Repeat|0|rwcdpehtm
System Manager|BOM Update Log|0|rwcdupehtm
System Manager|Bank Account Subtype|0|rwcdpehtm
System Manager|Bank Account Type|0|rwcdpehtm
System Manager|Bank Reconciliation Tool|0|rwcdhtm
System Manager|Bank Statement Import|0|rwcdpehtm
System Manager|Bank Transaction|0|rwcduxpehtm
System Manager|Bank|0|rwcdpehtm
System Manager|Blanket Order|0|rwcduxpehtm
System Manager|Building Showcase|0|rwcdpehtm
System Manager|Bulk Transaction Log Detail|0|rwcdpehtm
System Manager|Bulk Transaction Log|0|rwcdpehtm
System Manager|Bulk Update|0|rwcdhtm
System Manager|Buying Settings|0|rwchtm
System Manager|CRM Settings|0|rwchtm
System Manager|CRM Settings|1|rwdhtm
System Manager|Calendar View|0|rwcdpehtm
System Manager|Call Log|0|rwcdpehtm
System Manager|Cashier Closing|0|rwcdupehtm
System Manager|Changelog Feed|0|rwcdpehtm
System Manager|Cheque Print Template|0|rwcdpehtm
System Manager|Client Script|0|rwcdphtm
System Manager|Closing Stock Balance|0|rwcduxpehtm
System Manager|Code List|0|rwcdpehtm
System Manager|Comment|0|rwcdpehtm
System Manager|Common Code|0|rwcdpehtm
System Manager|Communication Medium|0|rwcdpehtm
System Manager|Communication|0|rcdphm
System Manager|Communication|1|rdpehtm
System Manager|Communication|2|rwdpehtm
System Manager|Company|0|rwcdphtm
System Manager|Connected App|0|rwcdpehtm
System Manager|Console Log|0|rwcpehtm
System Manager|Contact|0|rwcdpeihtm
System Manager|Contract Template|0|rwcdpehtm
System Manager|Contract|0|rwcduxapehtm
System Manager|Cost Center Allocation|0|rwcduxapehtm
System Manager|Country|0|rwcpeihtm
System Manager|Coupon Code|0|rwcdpehtm
System Manager|Currency Exchange Settings|0|rwcdhtm
System Manager|Currency|0|rwcdpeihtm
System Manager|Custom DocPerm|0|rwcdpeihtm
System Manager|Custom Field|0|rwcdphtm
System Manager|Custom HTML Block|0|rwcdpehtm
System Manager|Custom Role|0|rwcdpehtm
System Manager|Customize Form|0|rwchtm
System Manager|Dashboard Chart Source|0|rpehtm
System Manager|Dashboard Chart|0|rwcdpehtm
System Manager|Dashboard|0|rwcdpehtm
System Manager|Data Export|0|rwcdhtm
System Manager|Data Import Log|0|rwcdpehtm
System Manager|Data Import|0|rwcdpehtm
System Manager|Deleted Document|0|rde
System Manager|Desktop Icon|0|rwcdpehtm
System Manager|Discussion Reply|0|rwcdpehtm
System Manager|Discussion Topic|0|rwcdpehtm
System Manager|DocShare|0|rwcdpeih
System Manager|DocType Layout|0|rwcdpehtm
System Manager|DocType|0|rwcdptm
System Manager|Document Follow|0|rwcdpehtm
System Manager|Document Naming Rule|0|rwcdpehtm
System Manager|Document Naming Settings|0|rwchtm
System Manager|Document Share Key|0|rwcdpehtm
System Manager|Domain Settings|0|rwcdhtm
System Manager|Domain|0|rwcpehtm
System Manager|Downtime Entry|0|rwcdpehtm
System Manager|Driver|0|rwcdpehtm
System Manager|Dropbox Settings|0|rwcdehtm
System Manager|DuckDB Sync|0|rwcdpehtm
System Manager|Dunning Type|0|rwcdpehtm
System Manager|Dunning|0|rwcduxapehtm
System Manager|Email Account|0|rwcd
System Manager|Email Campaign|0|rwcdpehtm
System Manager|Email Digest|0|rwcdphtm
System Manager|Email Digest|1|r
System Manager|Email Domain|0|rwcdh
System Manager|Email Flag Queue|0|rdpehtm
System Manager|Email Queue|0|rdptm
System Manager|Email Rule|0|rpehtm
System Manager|Email Template|0|rwcdpeihm
System Manager|Email Unsubscribe|0|rwcdpehtm
System Manager|Employee Group|0|rwcdpehtm
System Manager|Energy Point Log|0|rp
System Manager|Energy Point Rule|0|rwcdpehtm
System Manager|Energy Point Settings|0|rwcdhtm
System Manager|Error Log|0|rwcdphtm
System Manager|Event|0|rwcdpeihtm
System Manager|Exchange Rate Revaluation|0|rwcduxapehtm
System Manager|File|0|rwcdpeihtm
System Manager|Fiscal Year|0|rwcdphtm
System Manager|Form Tour|0|rwcdpehtm
System Manager|Gender|0|rwcdpehtm
System Manager|Global Defaults|0|rwch
System Manager|Global Search Settings|0|rwcdhtm
System Manager|Google Calendar|0|rwcdpehtm
System Manager|Google Contacts|0|rwcdhtm
System Manager|Google Drive|0|rwcdhtm
System Manager|Google Settings|0|rwcdhtm
System Manager|Homepage Section|0|rwcdpehtm
System Manager|Homepage|0|rwcdhtm
System Manager|Incoming Call Settings|0|rwcdpehtm
System Manager|Installed Applications|0|rwcdhtm
System Manager|Integration Request|0|rdpehtm
System Manager|Inventory Dimension|0|rwcdpehtm
System Manager|Invoice Discounting|0|rwcduxapeihtm
System Manager|Issue Priority|0|rwcdpehtm
System Manager|Issue Type|0|rwcdpehtm
System Manager|Item Tax Template|0|rwcdpehtm
System Manager|Item Variant Settings|0|rwchtm
System Manager|Job Card|0|rwcduxapehtm
System Manager|Kanban Board|0|rwcdpehtm
System Manager|LDAP Settings|0|rwcdehtm
System Manager|Language|0|rwcd
System Manager|Lead|0|rwcphtm
System Manager|Ledger Health Monitor|0|rwcdhtm
System Manager|Ledger Health|0|rwcdpehtm
System Manager|Ledger Merge|0|rwcdpehtm
System Manager|Letter Head|0|rwcdphtm
System Manager|List View Settings|0|rwcdhtm
System Manager|Location|0|rwcdpehtm
System Manager|Log Settings|0|rwcdhtm
System Manager|Lower Deduction Certificate|0|rwcdpehtm
System Manager|Loyalty Program|0|rwcdpehtm
System Manager|Marketing Campaign|0|rwcdpehtm
System Manager|Milestone Tracker|0|rwcdpehtm
System Manager|Milestone|0|rwcdpehtm
System Manager|Module Def|0|srwcdp
System Manager|Module Onboarding|0|rwcdpehtm
System Manager|Module Profile|0|rwcdpehtm
System Manager|Navbar Settings|0|rwcdhtm
System Manager|Network Printer Settings|0|rwcdpehtm
System Manager|Non Conformance|0|rwcdpehtm
System Manager|Note|0|rwcdpehtm
System Manager|Note|1|rw
System Manager|Note|2|rw
System Manager|Notification Type|0|rwcdpehtm
System Manager|Notification|0|rwcdpeh
System Manager|Number Card|0|rwcdpehtm
System Manager|OAuth Authorization Code|0|rdpehtm
System Manager|OAuth Bearer Token|0|rdpehtm
System Manager|OAuth Client|0|rwcdpehtm
System Manager|OAuth Provider Settings|0|rwcdhtm
System Manager|Opening Invoice Creation Tool|0|rwchtm
System Manager|Opportunity Lost Reason|0|rwcdpehtm
System Manager|Opportunity Type|0|rwcdpehtm
System Manager|POS Closing Entry|0|rwcduxpehtm
System Manager|POS Invoice Merge Log|0|rwcduxpehtm
System Manager|POS Opening Entry|0|rwcduxpehtm
System Manager|POS Settings|0|rwhtm
System Manager|Package Import|0|rwcdpehtm
System Manager|Package Release|0|rwcdpehtm
System Manager|Package|0|rwcdpehtm
System Manager|Page|0|rwhtm
System Manager|Party Link|0|rwcdpehtm
System Manager|Party Specific Item|0|rwcdpehtm
System Manager|Party Type|0|rpehtm
System Manager|Patch Log|0|rpetm
System Manager|Payment Terms Template|0|rwcdpehtm
System Manager|Payment Term|0|rwcdpehtm
System Manager|Pegged Currencies|0|rwcdhtm
System Manager|Period Closing Voucher|0|rwcduxaphtm
System Manager|Permission Inspector|0|rw
System Manager|Personal Data Deletion Request|0|rwcdpehtm
System Manager|Personal Data Download Request|0|rwcdpehtm
System Manager|Plaid Settings|0|rwcdhtm
System Manager|Plant Floor|0|rwcdpehtm
System Manager|Prepared Report|0|rwcdpehtm
System Manager|Pricing Rule|0|rwcdpeih
System Manager|Print Format Field Template|0|rwcdpehtm
System Manager|Print Format|0|rwcdphtm
System Manager|Print Heading|0|rwcdphtm
System Manager|Print Settings|0|rwch
System Manager|Print Style|0|rwcdpehtm
System Manager|Process Deferred Accounting|0|rwcduxpehtm
System Manager|Process Period Closing Voucher|0|rwcduxpehtm
System Manager|Process Subscription|0|rwcdupehtm
System Manager|Project Template|0|rwcdpehtm
System Manager|Project Type|0|rwcdpehtm
System Manager|Projects Settings|0|rwcdhtm
System Manager|Promotional Scheme|0|rwcdpehtm
System Manager|Property Block|0|rwcdpehtm
System Manager|Property Flat|0|rwcdpehtm
System Manager|Property Setter|0|rwcdphtm
System Manager|Property Site|0|rwcdpehtm
System Manager|Prospect|0|rwcpehtm
System Manager|Push Notification Settings|0|rwcdhtm
System Manager|Quality Action|0|rwcdpehtm
System Manager|Quality Feedback Template|0|rwcdpehtm
System Manager|Quality Feedback|0|rwcdpehtm
System Manager|Quality Goal|0|rwcdpehtm
System Manager|Quality Inspection Parameter Group|0|rwcdpehtm
System Manager|Quality Inspection Parameter|0|rwcdpehtm
System Manager|Quality Inspection Template|0|rwcdpehtm
System Manager|Quality Meeting|0|rwcdpehtm
System Manager|Quality Procedure|0|rwcdpehtm
System Manager|Quality Review|0|rwcdpehtm
System Manager|Quick Stock Balance|0|rwcdh
System Manager|RQ Job|0|rpehtm
System Manager|RQ Worker|0|rpehtm
System Manager|Rename Tool|0|rwch
System Manager|Report|0|rwcdphtm
System Manager|Repost Accounting Ledger Settings|0|srwcd
System Manager|Repost Accounting Ledger|0|srwcduxapehtm
System Manager|Repost Item Valuation|0|rwcduxpehtm
System Manager|Repost Payment Ledger|0|srwcduxapehtm
System Manager|Role Permission for Page and Report|0|rwcdhtm
System Manager|Role Profile|0|rwcdpehtm
System Manager|Role Profile|1|rwpehtm
System Manager|Role|0|rwcdphtm
System Manager|Route History|0|rpehtm
System Manager|S3 Backup Settings|0|rwcdhtm
System Manager|SMS Center|0|rwch
System Manager|SMS Log|0|rptm
System Manager|SMS Settings|0|rwch
System Manager|Sales Partner Type|0|rwcdpehtm
System Manager|Salutation|0|rwcdpehtm
System Manager|Scheduled Job Log|0|rwcdpehtm
System Manager|Scheduled Job Type|0|rwcdpehtm
System Manager|Scheduler Event|0|rwcdpehtm
System Manager|Security Settings|0|rwcdhtm
System Manager|Selling Settings|0|rwchtm
System Manager|Serial and Batch Bundle|0|rwcduxpehtm
System Manager|Service Level Agreement|0|rwcdpehtm
System Manager|Session Default Settings|0|rwcdhtm
System Manager|Share Transfer|0|rwcduxapehtm
System Manager|Share Type|0|rwcdpehtm
System Manager|Shareholder|0|rwcdpehtm
System Manager|Shipment Parcel Template|0|rwcdpehtm
System Manager|Shipment|0|rwcduxpehtm
System Manager|Slack Webhook URL|0|rwcdpehtm
System Manager|Social Login Key|0|rwcdpehtm
System Manager|Stock Entry Type|0|rwcdpehtm
System Manager|Stock Reposting Settings|0|rwcdhtm
System Manager|Stock Reservation Entry|0|rwcduxpehtm
System Manager|Subcontracting BOM|0|rwcdpehtm
System Manager|Submission Queue|0|rpehtm
System Manager|Subscription Plan|0|rwcdpehtm
System Manager|Subscription Settings|0|rwcdhtm
System Manager|Subscription|0|rwcdpehtm
System Manager|Success Action|0|rwcdpehtm
System Manager|Supplier Scorecard Criteria|0|rwcdpehtm
System Manager|Supplier Scorecard Period|0|rwcduxpehtm
System Manager|Supplier Scorecard Standing|0|rwcdpehtm
System Manager|Supplier Scorecard Variable|0|rwcdpehtm
System Manager|Supplier Scorecard|0|rwcdpehtm
System Manager|Support Settings|0|rwcdhtm
System Manager|System Console|0|rwhtm
System Manager|System Health Report|0|rt
System Manager|System Settings|0|rwch
System Manager|Tag Link|0|rwcdpehtm
System Manager|Tag|0|rwcdpehtm
System Manager|Task Type|0|rwcdpehtm
System Manager|Tax Category|0|rwcdpehtm
System Manager|Tax Withholding Category|0|rwcdpehtm
System Manager|Telephony Call Type|0|rwcdpehtm
System Manager|Terms and Conditions|0|rwcdphtm
System Manager|ToDo|0|rwcpehtm
System Manager|Token Cache|0|rd
System Manager|Transaction Deletion Record|0|rwcdupehtm
System Manager|Translation|0|rwcdpehtm
System Manager|UOM Category|0|rwcdpehtm
System Manager|UOM Conversion Factor|0|rwcdpehtm
System Manager|Unhandled Email|0|r
System Manager|User Group|0|rwcdpehtm
System Manager|User Invitation|0|rwcpehtm
System Manager|User Permission|0|rwcdpehtm
System Manager|User Type|0|rwpehtm
System Manager|User|0|rwcdpeihtm
System Manager|User|1|rw
System Manager|Version|0|rpe
System Manager|Video Settings|0|rwcdhtm
System Manager|Video|0|rwcdpehtm
System Manager|View Log|0|rpehtm
System Manager|Voice Call Settings|0|rwcdpehtm
System Manager|Voice Call Settings|1|rwdpehtm
System Manager|Voice Call Settings|2|rwdpehtm
System Manager|Warehouse Type|0|rwcdpehtm
System Manager|Web Page View|0|rwcdpehtm
System Manager|Web Template|0|rwcdpehtm
System Manager|Webhook Request Log|0|rwcdpehtm
System Manager|Webhook|0|rwcdpehtm
System Manager|Website Route Meta|0|rwcdpehtm
System Manager|Workflow Action Master|0|rwcdhtm
System Manager|Workflow State|0|rwcdhtm
System Manager|Workflow|0|rwcdhtm
System Manager|ultramsg_4_ERPNext log|0|rwcdpehtm
System Manager|whatsapp message|0|wcdhtm
Translator|Translation|0|rwcdpehtm
Website Manager|About Us Settings|0|rwchtm
Website Manager|Blog Category|0|rwcdphtm
Website Manager|Blog Post|0|rwcdphtm
Website Manager|Blog Settings|0|rwchtm
Website Manager|Blogger|0|rwcdpeihtm
Website Manager|Color|0|rwcdpehtm
Website Manager|Comment|0|rwcdpehtm
Website Manager|Contact Us Settings|0|rwchtm
Website Manager|Coupon Code|0|rwcdpehtm
Website Manager|Help Category|0|rwcdpehtm
Website Manager|Portal Settings|0|rwcdhtm
Website Manager|Pricing Rule|0|rwcdph
Website Manager|Web Form|0|rwcdph
Website Manager|Web Page|0|rwcdih
Website Manager|Website Script|0|rwchtm
Website Manager|Website Settings|0|rwchtm
Website Manager|Website Sidebar|0|rwcdpehtm
Website Manager|Website Slideshow|0|rwcdphtm
Website Manager|Website Theme|0|rwcd
Workspace Manager|Custom HTML Block|0|rwcdpehtm
Workspace Manager|Workspace|0|rwcdpehtm"""

LETTERS = {"s": "select", "r": "read", "w": "write", "c": "create", "d": "delete", "u": "submit", "x": "cancel",
           "a": "amend", "p": "report", "e": "export", "i": "import", "h": "share", "t": "print", "m": "email"}
LEVEL = {"0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9}
COLS = "name, parent, role, permlevel, if_owner, `select`, `read`, `write`, `create`, `delete`, `submit`, `cancel`, `amend`, `report`, `export`, `import`, `share`, `print`, `email`"

roles_ok = {r[0]: 1 for r in frappe.db.sql("select name from tabRole where is_custom=0 and name not like 'SRC%'")}
doctypes = {r[0]: 1 for r in frappe.db.sql("select name from tabDocType where custom=0")}
overridden = {r[0]: 1 for r in frappe.db.sql("select distinct parent from `tabCustom DocPerm`")}

standard = {}
for r in frappe.db.sql("select " + COLS + " from tabDocPerm", as_dict=1):
    standard["%s|%s|%d|%d" % (r.role, r.parent, r.permlevel, 1 if r.if_owner else 0)] = r
custom = {}
for r in frappe.db.sql("select " + COLS + " from `tabCustom DocPerm`", as_dict=1):
    custom["%s|%s|%d|%d" % (r.role, r.parent, r.permlevel, 1 if r.if_owner else 0)] = r

plan_std_insert = []
plan_std_raise = []
plan_custom_insert = []
plan_custom_raise = []
per_role = {}
skipped = {}

for line in DATA.split("\n"):
    parts = line.split("|")
    role = parts[0]
    dt = parts[1]
    lvl = parts[2]
    letters = parts[3]
    if role not in roles_ok or dt not in doctypes or (len(ONLY_ROLES) > 0 and role not in ONLY_ROLES):
        skipped[role] = 1
        continue
    owner = "1" if "o" in letters else "0"
    key = role + "|" + dt + "|" + lvl + "|" + owner
    want = {LETTERS[ch]: 1 for ch in letters if ch != "o"}
    if role not in per_role:
        per_role[role] = [0, 0]
    for kind in ["standard", "custom"]:
        if kind == "custom" and dt not in overridden:
            continue
        rows = standard if kind == "standard" else custom
        row = rows.get(key)
        if row is None:
            (plan_std_insert if kind == "standard" else plan_custom_insert).append([role, dt, lvl, letters])
            per_role[role][0] = per_role[role][0] + 1
        else:
            low = [f for f in want if not row[f]]
            if low:
                (plan_std_raise if kind == "standard" else plan_custom_raise).append([role, dt, row.name, low])
                per_role[role][1] = per_role[role][1] + 1

total = sum(1 for x in plan_std_insert) + sum(1 for x in plan_std_raise) + sum(1 for x in plan_custom_insert) + sum(1 for x in plan_custom_raise)
print("PLAN  standard rows to add: %d | to raise: %d | override rows to add: %d | to raise: %d | total: %d"
      % (sum(1 for x in plan_std_insert), sum(1 for x in plan_std_raise), sum(1 for x in plan_custom_insert), sum(1 for x in plan_custom_raise), total))
print("PER ROLE (rows to add / raise | enabled users with the role):")
for role in sorted(per_role):
    if per_role[role][0] or per_role[role][1]:
        users = frappe.db.sql("select count(distinct hr.parent) from `tabHas Role` hr join tabUser u on u.name=hr.parent and u.enabled=1 where hr.role=%s and hr.parenttype='User'", (role,))[0][0]
        print("  %-28s add %-4d raise %-4d | %d user(s)" % (role, per_role[role][0], per_role[role][1], users))
print("NOT TOUCHED: SRC roles, custom roles, doctypes not on this site.")

if DRY_RUN:
    print("DRY RUN: nothing changed. Change DRY_RUN to False and tick Commit to apply.")
else:
    now = frappe.utils.now()
    stamp = now.replace("-", "").replace(":", "").replace(" ", "").replace(".", "")
    made_std = []
    made_custom = []
    raised = []
    budget = LIMIT
    n = 0
    for x in plan_std_insert:
        if budget <= 0:
            break
        budget -= 1
        n += 1
        idx = (frappe.db.sql("select max(idx) from tabDocPerm where parent=%s", (x[1],))[0][0] or 0) + 1
        d = {"doctype": "DocPerm", "parent": x[1], "parenttype": "DocType", "parentfield": "permissions", "idx": idx,
             "role": x[0], "permlevel": LEVEL[x[2]], "if_owner": 1 if "o" in x[3] else 0}
        for ch in x[3]:
            if ch != "o":
                d[LETTERS[ch]] = 1
        doc = frappe.get_doc(d)
        doc.name = "stdfix%s_%d" % (stamp, n)
        doc.creation = now
        doc.modified = now
        doc.owner = "Administrator"
        doc.modified_by = "Administrator"
        doc.db_insert()
        made_std.append(doc.name)
    for x in plan_custom_insert:
        if budget <= 0:
            break
        budget -= 1
        d = {"doctype": "Custom DocPerm", "parent": x[1], "role": x[0], "permlevel": LEVEL[x[2]], "if_owner": 1 if "o" in x[3] else 0}
        for ch in x[3]:
            if ch != "o":
                d[LETTERS[ch]] = 1
        doc = frappe.get_doc(d)
        doc.insert(ignore_permissions=True)
        made_custom.append(doc.name)
    for table, plan in [["DocPerm", plan_std_raise], ["Custom DocPerm", plan_custom_raise]]:
        for x in plan:
            if budget <= 0:
                break
            budget -= 1
            for f in x[3]:
                frappe.db.set_value(table, x[2], f, 1, update_modified=False)
                raised.append("%s|%s|%s|%s|%s was 0" % (table, x[2], x[0], x[1], f))
    done = sum(1 for x in made_std) + sum(1 for x in made_custom) + sum(1 for x in raised)
    print("APPLIED  standard rows added: %d | override rows added: %d | values raised: %d" % (sum(1 for x in made_std), sum(1 for x in made_custom), sum(1 for x in raised)))
    if total > LIMIT:
        print("MORE TO DO: about %d rows remain. Run the script again (same settings) until the plan says total: 0." % (total - LIMIT))
    print("UNDO  delete these DocPerm rows: %s" % ", ".join(made_std))
    print("UNDO  delete these Custom DocPerm rows: %s" % ", ".join(made_custom))
    print("UNDO  set these back to 0 (table|row|role|doctype|field): %s" % "; ".join(raised))
    print("NOW: make sure 'Commit' is ticked, then clear the cache and reload.")
