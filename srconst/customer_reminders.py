"""Customer: Alternate Mobile, and a Reminders tab (last reminder date, reminders this month, one log row per reminder).

The overdue-installment Server Script writes the log rows (scripts/overdue_reminder_server_script.py); this module only
creates the fields and fills the two read-only summary values when a Customer is opened.
"""

import frappe
from frappe.utils import add_months, get_first_day, getdate, today


def ensure_fields():
	from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

	if not frappe.db.exists("DocType", "Customer") or not frappe.db.exists("DocType", "Customer Reminder Log"):
		return False
	meta = frappe.get_meta("Customer")
	fields = [{"fieldname": "alternate_mobile", "fieldtype": "Data", "options": "Phone", "label": "Alternate Mobile", "insert_after": "mobile_number"}]
	if not meta.has_field("reminders_tab"):
		# a Tab Break takes every field after it, so it must go after the form's last field
		last = meta.fields[-1].fieldname
		fields += [
			{"fieldname": "reminders_tab", "fieldtype": "Tab Break", "label": "Reminders", "insert_after": last},
			{"fieldname": "last_reminder_date", "fieldtype": "Date", "label": "Last Reminder Date", "read_only": 1, "insert_after": "reminders_tab"},
			{"fieldname": "reminders_col", "fieldtype": "Column Break", "insert_after": "last_reminder_date"},
			{"fieldname": "reminders_this_month", "fieldtype": "Int", "label": "Reminders This Month", "read_only": 1, "insert_after": "reminders_col"},
			{"fieldname": "reminders_sec", "fieldtype": "Section Break", "insert_after": "reminders_this_month"},
			{"fieldname": "reminder_log", "fieldtype": "Table", "label": "Reminder Log", "options": "Customer Reminder Log", "read_only": 1, "insert_after": "reminders_sec"},
		]
	create_custom_fields({"Customer": fields}, update=True)
	frappe.clear_cache(doctype="Customer")
	return True


def onload(doc, method=None):
	"""Customer.onload: summarise the log (computed on open, so 'this month' is never stale)."""
	if not doc.meta.has_field("reminder_log"):
		return
	dates = [getdate(r.reminder_date) for r in doc.get("reminder_log") if r.reminder_date]
	month = get_first_day(today())
	doc.last_reminder_date = max(dates) if dates else None
	doc.reminders_this_month = sum(1 for d in dates if month <= d < add_months(month, 1))
