# READ-ONLY. Paste into System Console (Python), leave "Commit" unticked, Execute, and send back the whole output.
import frappe

def sec(t):
	print("\n=== " + t + " ===")

def fields(dt, only_custom=False):
	if not frappe.db.exists("DocType", dt):
		print(dt, "-> DOCTYPE NOT FOUND")
		return
	m = frappe.get_meta(dt)
	print(dt, "| module:", m.module, "| custom:", m.custom, "| autoname:", m.autoname)
	for f in m.fields:
		if only_custom and not f.get("is_custom_field") and not f.get("fieldname", "").startswith("custom_"):
			continue
		print("  ", f.fieldname, "|", f.fieldtype, "|", f.label, "|", f.options or "")

sec("VERSIONS")
try:
	print(frappe.get_attr("frappe.__version__") if False else frappe.__version__)
	for a in frappe.get_installed_apps():
		print(a, frappe.get_attr(a + ".__version__") if frappe.get_module(a) and hasattr(frappe.get_module(a), "__version__") else "")
except Exception as e:
	print("err", e)

sec("SERVER SCRIPTS (all enabled; bodies cut at 5000 chars)")
for s in frappe.get_all("Server Script", filters={"disabled": 0}, fields=["name", "script_type", "reference_doctype", "doctype_event", "event_frequency", "cron_format", "api_method"]):
	print("\n--", s.name, "|", s.script_type, "|", s.reference_doctype, "|", s.doctype_event, "|", s.event_frequency, "|", s.cron_format, "|", s.api_method)
	body = frappe.db.get_value("Server Script", s.name, "script") or ""
	if any(k in (s.name + body).lower() for k in ("remind", "due", "whatsapp", "installment", "booking", "invoice")):
		print(body[:5000])

sec("NOTIFICATIONS (enabled)")
for n in frappe.get_all("Notification", filters={"enabled": 1}, fields=["name", "document_type", "event", "channel", "condition", "date_changed", "days_in_advance", "subject"]):
	print(n)
	print((frappe.db.get_value("Notification", n.name, "message") or "")[:1500])

sec("SCHEDULED JOB TYPES (enabled, custom or mentioning due/remind)")
for j in frappe.get_all("Scheduled Job Type", filters={"stopped": 0}, fields=["name", "method", "frequency", "cron_format"]):
	if any(k in (j.method or "").lower() for k in ("remind", "due", "whatsapp", "srconst", "installment")):
		print(j)

sec("DOCTYPES")
for dt in ("Flat Booking", "Flat", "Flat Booking Cancellation"):
	fields(dt)
sec("CHILD TABLES OF FLAT BOOKING")
if frappe.db.exists("DocType", "Flat Booking"):
	for f in frappe.get_meta("Flat Booking").fields:
		if f.fieldtype == "Table":
			fields(f.options)
sec("CUSTOM FIELDS on Customer / Sales Invoice / Sales Invoice Item")
for dt in ("Customer", "Sales Invoice", "Sales Invoice Item"):
	for cf in frappe.get_all("Custom Field", filters={"dt": dt}, fields=["fieldname", "fieldtype", "label", "insert_after"]):
		print(dt, cf)

sec("ITEMS that look like parking")
print(frappe.get_all("Item", or_filters=[["item_name", "like", "%park%"], ["item_code", "like", "%park%"]], fields=["name", "item_group", "stock_uom", "is_stock_item", "disabled"]))

sec("SAMPLE: last 3 Flat Bookings (raw)")
if frappe.db.exists("DocType", "Flat Booking"):
	for r in frappe.get_all("Flat Booking", fields=["*"], order_by="creation desc", limit=3):
		print({k: v for k, v in r.items() if v not in (None, "", 0)})

sec("SALES INVOICES created from bookings: how are they linked / what items")
if frappe.db.exists("DocType", "Flat Booking"):
	b = frappe.get_all("Flat Booking", fields=["name"], order_by="creation desc", limit=1)
	if b:
		print("latest booking:", b[0].name)
		for si in frappe.get_all("Sales Invoice", or_filters=[["remarks", "like", "%" + b[0].name + "%"], ["po_no", "=", b[0].name]], fields=["name", "docstatus", "grand_total"], limit=3):
			print(si, frappe.get_all("Sales Invoice Item", filters={"parent": si.name}, fields=["item_code", "item_name", "qty", "rate"]))
