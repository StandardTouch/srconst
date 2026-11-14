# Replace the body of the Server Script "Flat Booking - On Submit - Update Flat Status" (DocType Event: Flat Booking, After Submit).
# Only change vs. the old one: when the booking has car parking, the invoice gets a second "Car Parking" line and the
# "Flat Booking" line carries the flat alone (total_sale_value includes the parking).
# 1. Update flat status
flat_doc = frappe.get_doc("Flat", doc.flat)
if flat_doc.status == "In Process":
    frappe.throw("This flat is already booked.")
if flat_doc.status == "Sold":
    frappe.throw("This flat has already been sold.")
flat_doc.status = "In Process"
flat_doc.customer = doc.customer
flat_doc.booking_ref = doc.name
flat_doc.save(ignore_permissions=True)

# 2. Auto-create Sales Invoice in Draft
if not doc.sales_invoice:
    try:
        income_account = frappe.db.get_value(
            "Account",
            {"account_name": "Flat Booking Income", "company": doc.company},
            "name"
        )

        today = frappe.utils.today()
        parking = frappe.utils.flt(doc.get("parking_amount"))

        items = [{
            "item_code"     : "Flat Booking",
            "qty"           : 1,
            "rate"          : doc.total_sale_value - parking,
            "cost_center"   : doc.cost_center,
            "income_account": income_account,
            "description"   : "Flat " + str(doc.flat) + " — " + str(doc.building),
        }]
        if parking:
            items.append({
                "item_code"     : "Car Parking",
                "qty"           : 1,
                "rate"          : parking,
                "cost_center"   : doc.cost_center,
                "income_account": income_account,
                "description"   : "Car parking — Flat " + str(doc.flat) + " — " + str(doc.building),
            })

        si_doc = frappe.get_doc({
            "doctype"       : "Sales Invoice",
            "customer"      : doc.customer,
            "company"       : doc.company,
            "cost_center"   : doc.cost_center,
            "posting_date"  : today,
            "due_date"      : today,
            "currency"      : "INR",
            "items"         : items,
        })

        if doc.taxes_and_charges:
            tax_template = frappe.get_doc(
                "Sales Taxes and Charges Template", doc.taxes_and_charges
            )
            for tax in tax_template.taxes:
                si_doc.append("taxes", {
                    "charge_type"  : tax.charge_type,
                    "account_head" : tax.account_head,
                    "description"  : tax.description,
                    "rate"         : tax.rate,
                    "cost_center"  : doc.cost_center,
                })

        si_doc.insert(ignore_permissions=True)
        frappe.db.set_value("Flat Booking", doc.name, "sales_invoice", si_doc.name)
        frappe.msgprint(
            "Sales Invoice " + si_doc.name + " created (Draft). "
            "Review GST amounts and submit.",
            alert=True
        )
    except Exception as e:
        frappe.log_error(
            "SI Creation Failed for " + doc.name + ":\n" + str(e),
            "Flat Booking - SI Auto Create Error"
        )
        frappe.msgprint(
            "Warning: Sales Invoice could not be created automatically. "
            "Error: " + str(e) + ". Please create it manually.",
            indicator="orange",
            alert=True
        )
