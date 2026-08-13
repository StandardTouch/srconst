import frappe
from frappe.utils import today, get_first_day, get_last_day, flt


@frappe.whitelist()
def get_dashboard_data():
	return {
		"flat_kpis": get_flat_kpis(),
		"flat_grid": get_flat_grid(),
		"instalments_today": get_instalments_today(),
		"instalments_month": get_instalments_month(),
		"pending_emis": get_pending_emis(),
		"labour_summary": get_labour_summary(),
		"stock_levels": get_stock_levels(),
		"purchase_summary": get_purchase_summary(),
		"pl_summary": get_pl_summary(),
		"site_wise_collection": get_site_wise_collection(),
		"receivables_aging": get_receivables_aging(),
	}


def get_flat_kpis():
	total = frappe.db.count("Flat")
	empty = frappe.db.count("Flat", {"status": "Empty"})
	in_process = frappe.db.count("Flat", {"status": "In Process"})
	sold = frappe.db.count("Flat", {"status": "Sold"})
	cancelled_bookings = frappe.db.count("Flat Booking Cancellation", {"docstatus": 1})

	return {
		"total_flats": total,
		"available_flats": empty,
		"in_process_flats": in_process,
		"sold_flats": sold,
		"cancelled_bookings": cancelled_bookings,
	}


def get_flat_grid():
	return frappe.db.sql(
		"""
		SELECT
			f.name AS flat,
			f.flat_number,
			f.floor,
			f.status,
			f.building,
			b.building_name,
			fb.name AS booking,
			fb.customer,
			fb.total_sale_value,
			fb.total_received,
			fb.total_outstanding
		FROM `tabFlat` f
		LEFT JOIN `tabBuilding` b ON b.name = f.building
		LEFT JOIN `tabFlat Booking` fb
			ON fb.flat = f.name AND fb.docstatus = 1
		ORDER BY f.building, f.floor, f.flat_number
		""",
		as_dict=True,
	)


def get_instalments_today():
	return _get_instalment_summary(today(), today())


def get_instalments_month():
	return _get_instalment_summary(get_first_day(today()), get_last_day(today()))


def _get_instalment_summary(from_date, to_date):
	row = frappe.db.sql(
		"""
		SELECT
			SUM(fi.amount_due) AS due,
			SUM(fi.amount_received) AS received
		FROM `tabFlat Installment` fi
		JOIN `tabFlat Booking` fb ON fb.name = fi.parent
		WHERE fb.docstatus = 1
			AND fi.due_date BETWEEN %s AND %s
		""",
		(from_date, to_date),
		as_dict=True,
	)[0]

	due = row.due or 0
	received = row.received or 0

	return {
		"due": due,
		"received": received,
		"pending": due - received,
	}


def get_pending_emis():
	return frappe.db.sql(
		"""
		SELECT
			fb.name AS booking,
			fb.building,
			fb.flat,
			fb.customer,
			fi.installment_no,
			fi.due_date,
			fi.amount_due,
			fi.amount_received,
			(fi.amount_due - fi.amount_received) AS pending_amount,
			DATEDIFF(CURDATE(), fi.due_date) AS days_overdue
		FROM `tabFlat Installment` fi
		JOIN `tabFlat Booking` fb ON fb.name = fi.parent
		WHERE fb.docstatus = 1
			AND fi.status != 'Paid'
			AND fi.due_date <= CURDATE()
		ORDER BY fi.due_date ASC
		LIMIT 200
		""",
		as_dict=True,
	)


def get_labour_summary():
	workflow_counts = frappe.db.sql(
		"""
		SELECT
			workflow_state,
			COUNT(*) AS count,
			SUM(net_payable) AS amount
		FROM `tabLabour Payment Entry`
		WHERE docstatus != 2
		GROUP BY workflow_state
		""",
		as_dict=True,
	)

	month_start = get_first_day(today())
	site_wise = frappe.db.sql(
		"""
		SELECT
			project_cost_center,
			COUNT(*) AS entries,
			SUM(net_payable) AS amount
		FROM `tabLabour Payment Entry`
		WHERE docstatus = 1
			AND payment_date >= %s
		GROUP BY project_cost_center
		""",
		(month_start,),
		as_dict=True,
	)

	return {
		"workflow_counts": workflow_counts,
		"site_wise": site_wise,
	}


def get_stock_levels():
	return frappe.db.sql(
		"""
		SELECT
			b.warehouse,
			b.item_code,
			i.item_name,
			b.actual_qty,
			b.reserved_qty,
			i.stock_uom
		FROM `tabBin` b
		JOIN `tabItem` i ON i.name = b.item_code
		WHERE b.actual_qty > 0
		ORDER BY b.warehouse, b.item_code
		""",
		as_dict=True,
	)


def get_purchase_summary():
	statuses = frappe.db.sql(
		"""
		SELECT
			status,
			COUNT(*) AS count,
			SUM(grand_total) AS amount
		FROM `tabPurchase Order`
		WHERE docstatus != 2
		GROUP BY status
		""",
		as_dict=True,
	)

	item_group_spend = frappe.db.sql(
		"""
		SELECT
			i.item_group,
			SUM(poi.amount) AS amount
		FROM `tabPurchase Order Item` poi
		JOIN `tabPurchase Order` po ON po.name = poi.parent
		JOIN `tabItem` i ON i.name = poi.item_code
		WHERE po.docstatus = 1
			AND po.transaction_date >= %s
		GROUP BY i.item_group
		ORDER BY amount DESC
		""",
		(get_first_day(today()),),
		as_dict=True,
	)

	return {
		"statuses": statuses,
		"item_group_spend": item_group_spend,
	}


def get_pl_summary():
	cache_key = "src_dashboard_pl_summary"
	cached = frappe.cache().get_value(cache_key)
	if cached:
		return cached

	from_date = get_first_day(today())
	to_date = today()
	company = "SR Construction"

	income = frappe.db.sql(
		"""
		SELECT SUM(gle.credit - gle.debit) AS amount
		FROM `tabGL Entry` gle
		JOIN `tabAccount` acc ON acc.name = gle.account
		WHERE acc.root_type = 'Income'
			AND gle.company = %s
			AND gle.posting_date BETWEEN %s AND %s
			AND gle.is_cancelled = 0
		""",
		(company, from_date, to_date),
		as_dict=True,
	)[0]

	expense = frappe.db.sql(
		"""
		SELECT SUM(gle.debit - gle.credit) AS amount
		FROM `tabGL Entry` gle
		JOIN `tabAccount` acc ON acc.name = gle.account
		WHERE acc.root_type = 'Expense'
			AND gle.company = %s
			AND gle.posting_date BETWEEN %s AND %s
			AND gle.is_cancelled = 0
		""",
		(company, from_date, to_date),
		as_dict=True,
	)[0]

	revenue = flt(income.amount)
	expenses = flt(expense.amount)
	net_profit = revenue - expenses

	result = {
		"revenue": revenue,
		"expenses": expenses,
		"net_profit": net_profit,
		"margin_pct": round((net_profit / revenue * 100), 2) if revenue else 0,
	}

	frappe.cache().set_value(cache_key, result, expires_in_sec=120)
	return result


def get_site_wise_collection():
	return frappe.db.sql(
		"""
		SELECT
			fb.building,
			b.building_name,
			SUM(fb.total_sale_value) AS total_booked,
			SUM(fb.total_received) AS total_received,
			SUM(fb.total_outstanding) AS total_pending
		FROM `tabFlat Booking` fb
		LEFT JOIN `tabBuilding` b ON b.name = fb.building
		WHERE fb.docstatus = 1
		GROUP BY fb.building
		ORDER BY total_booked DESC
		""",
		as_dict=True,
	)


AGING_BUCKETS = ["Not Due", "1-30 Days", "31-60 Days", "61-90 Days", "90+ Days"]


def get_receivables_aging():
	rows = frappe.db.sql(
		"""
		SELECT
			CASE
				WHEN DATEDIFF(CURDATE(), fi.due_date) < 0 THEN 'Not Due'
				WHEN DATEDIFF(CURDATE(), fi.due_date) <= 30 THEN '1-30 Days'
				WHEN DATEDIFF(CURDATE(), fi.due_date) <= 60 THEN '31-60 Days'
				WHEN DATEDIFF(CURDATE(), fi.due_date) <= 90 THEN '61-90 Days'
				ELSE '90+ Days'
			END AS bucket,
			SUM(fi.amount_due - fi.amount_received) AS pending_amount
		FROM `tabFlat Installment` fi
		JOIN `tabFlat Booking` fb ON fb.name = fi.parent
		WHERE fb.docstatus = 1
			AND fi.status != 'Paid'
		GROUP BY bucket
		""",
		as_dict=True,
	)
	amounts = {row.bucket: (row.pending_amount or 0) for row in rows}

	return [{"bucket": bucket, "pending_amount": amounts.get(bucket, 0)} for bucket in AGING_BUCKETS]
