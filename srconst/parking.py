"""Car parking on a Flat Booking: an extra amount on top of the flat, invoiced as its own "Car Parking" line.

Fields on Flat Booking (Custom Fields, kept by after_migrate):
  parking_amount          the parking price (without GST) included in Total Sale Value; 0 = no parking
  parking_sales_invoice   only set when parking is added after the booking (its own draft invoice)
The default price is 3,50,000; change it with `showcase_parking_amount` in site_config.json.
"""

import frappe
from frappe import _
from frappe.utils import add_months, cint, flt, getdate, nowdate

ITEM = "Car Parking"
DEFAULT_AMOUNT = 350000


def default_amount():
	return flt(frappe.conf.get("showcase_parking_amount")) or DEFAULT_AMOUNT


def ensure_fields():
	from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

	if not frappe.db.exists("DocType", "Flat Booking"):
		return False
	create_custom_fields(
		{
			"Flat Booking": [
				{"fieldname": "parking_amount", "fieldtype": "Currency", "label": "Car Parking Amount (excl. GST)", "insert_after": "booking_amount", "default": 0,
					"description": "Included in Total Sale Value and invoiced on its own 'Car Parking' line."},
				{"fieldname": "parking_sales_invoice", "fieldtype": "Link", "options": "Sales Invoice", "label": "Parking Invoice", "insert_after": "sales_invoice", "read_only": 1},
			]
		},
		update=True,
	)
	if not frappe.db.exists("Item", ITEM):
		frappe.get_doc(
			{"doctype": "Item", "item_code": ITEM, "item_name": ITEM, "item_group": "Services", "stock_uom": "Nos", "is_stock_item": 0}
		).insert(ignore_permissions=True)
	frappe.clear_cache(doctype="Flat Booking")
	return True


def add_to_booking(booking, mode, due_date, amount):
	"""Add parking to a submitted booking: a draft invoice for it, and its amount (with GST) in the payment schedule.

	mode "single": one new installment row due on `due_date`.  mode "installments": split over the installments not yet touched.
	Returns the invoice name. Runs in the caller's transaction.
	"""
	from srconst.showcase_api import _template_rate

	b = frappe.get_doc("Flat Booking", booking)
	if b.docstatus != 1:
		frappe.throw(_("Only a submitted booking can take car parking"))
	if flt(b.get("parking_amount")):
		frappe.throw(_("This booking already has car parking"))
	if not frappe.db.exists("Item", ITEM):
		frappe.throw(_("Item {0} does not exist. Run bench migrate.").format(ITEM))
	if amount <= 0:
		frappe.throw(_("Car parking amount must be greater than zero"))

	rate = _template_rate(b.taxes_and_charges)
	gst = flt(amount * rate / 100, 2)
	total = flt(amount + gst, 2)

	untouched = [r for r in b.installments if r.status == "Pending" and not flt(r.amount_received)]
	if mode == "installments" and not untouched:
		frappe.throw(_("No unpaid installment is left to add the parking to. Use a single payment."))
	if mode == "single" and not due_date:
		frappe.throw(_("Choose the date the parking payment is due"))

	income_account = frappe.db.get_value("Account", {"account_name": "Flat Booking Income", "company": b.company}, "name")
	si = frappe.get_doc(
		{
			"doctype": "Sales Invoice", "customer": b.customer, "company": b.company, "cost_center": b.cost_center, "posting_date": nowdate(),
			"due_date": nowdate(), "currency": "INR",
			"items": [{"item_code": ITEM, "qty": 1, "rate": amount, "cost_center": b.cost_center, "income_account": income_account,
				"description": f"Car parking - Flat {b.flat} - {b.building}"}],
		}
	)
	if b.taxes_and_charges:
		for t in frappe.get_doc("Sales Taxes and Charges Template", b.taxes_and_charges).taxes:
			si.append("taxes", {"charge_type": t.charge_type, "account_head": t.account_head, "description": t.description, "rate": t.rate, "cost_center": b.cost_center})
	si.insert()

	if mode == "single":
		frappe.get_doc(
			{"doctype": "Flat Installment", "parent": b.name, "parenttype": "Flat Booking", "parentfield": "installments", "idx": len(b.installments) + 1,
			"installment_no": max([cint(r.installment_no) for r in b.installments] + [0]) + 1, "due_date": getdate(due_date), "amount_due": total,
			"amount_received": 0, "status": "Pending", "remarks": "Car parking"}
		).insert(ignore_permissions=True)
	else:
		share = flt(total / len(untouched), 2)
		for i, r in enumerate(untouched):
			part = share if i < len(untouched) - 1 else flt(total - share * (len(untouched) - 1), 2)
			frappe.db.set_value("Flat Installment", r.name, "amount_due", flt(r.amount_due) + part, update_modified=False)

	frappe.db.set_value(
		"Flat Booking", b.name,
		{"parking_amount": amount, "parking_sales_invoice": si.name, "total_sale_value": flt(b.total_sale_value) + amount,
		"gst_amount": flt(b.gst_amount) + gst, "total_with_gst": flt(b.total_with_gst) + total, "total_outstanding": flt(b.total_outstanding) + total},
		update_modified=False,
	)
	return si.name
