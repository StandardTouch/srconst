# Replace the body of the Server Script "SRC - WhatsApp Scheduled - Installment Overdue" (Scheduler Event, Cron 30 3 * * *).
# Changes vs. the old one:
#  1. at most one customer reminder per booking per calendar month (was: every day)
#  2. the customer message no longer shows the overdue amount (finance alert unchanged)
#  3. goes to the booking's primary mobile, else the customer's Alternate Mobile
#  4. every customer reminder is logged in the Customer > Reminders tab
#  5. an installment counts from its due date (due_date <= today), whether still Pending or already flipped to Overdue
today = frappe.utils.today()
nl = chr(10)
wm = frappe.get_doc("whatsapp message")
has_alt = frappe.get_meta("Customer").has_field("alternate_mobile")
has_log = frappe.db.exists("DocType", "Customer Reminder Log")

bookings = frappe.get_all(
    "Flat Booking",
    filters={"docstatus": 1},
    fields=["name", "customer", "flat", "building", "total_outstanding", "customer_mobile", "last_notified_date"]
)

for fb in bookings:

    # already reminded this month (same YYYY-MM)
    if fb.last_notified_date and str(fb.last_notified_date)[:7] == today[:7]:
        continue

    installments = frappe.get_all(
        "Flat Installment",
        filters={"parent": fb.name, "status": ["in", ["Pending", "Overdue"]], "due_date": ["<=", today]},
        fields=["installment_no", "due_date", "amount_due"]
    )

    if not installments:
        continue

    overdue_count = str(len(installments))
    overdue_amount = str(sum(i.amount_due for i in installments))

    customer_caption = (
        "*SR CONSTRUCTION*" + nl + "*Installment Payment Reminder*" + nl + nl +
        "Dear " + str(fb.customer) + "," + nl + nl +
        "This is a reminder that you have " + overdue_count + " installment(s) due for your flat booking." + nl + nl +
        "*Booking Details:*" + nl +
        "Booking: " + str(fb.name) + nl +
        "Flat: " + str(fb.flat) + nl +
        "Building: " + str(fb.building) + nl + nl +
        "Please make the payment at the earliest to avoid any inconvenience." + nl +
        "For queries, contact us at +91 90080 61616." + nl +
        "SR Construction"
    )

    finance_caption = (
        "*SR CONSTRUCTION*" + nl + "*Overdue Installment Alert*" + nl + nl +
        "Flat Booking " + str(fb.name) + " has " + overdue_count + " overdue installment(s)." + nl + nl +
        "*Details:*" + nl +
        "Booking: " + str(fb.name) + nl +
        "Customer: " + str(fb.customer) + nl +
        "Flat: " + str(fb.flat) + nl +
        "Building: " + str(fb.building) + nl +
        "Overdue Installments: " + overdue_count + nl +
        "*Overdue Amount: Rs. " + overdue_amount + "*" + nl +
        "Total Outstanding: Rs. " + str(fb.total_outstanding) + nl + nl +
        "Please follow up with the customer immediately." + nl +
        "srconstruction.k.frappe.cloud"
    )

    # primary number first, else the alternate one
    number = fb.customer_mobile
    if not number and has_alt:
        number = frappe.db.get_value("Customer", fb.customer, "alternate_mobile")

    if number:
        clean_customer = "".join(ch for ch in str(number) if ch.isdigit())
        frappe.make_post_request(
            wm.message_url,
            data={"token": wm.token, "to": clean_customer, "body": customer_caption}
        )
        if has_log:
            try:
                frappe.get_doc({
                    "doctype": "Customer Reminder Log",
                    "parent": fb.customer,
                    "parenttype": "Customer",
                    "parentfield": "reminder_log",
                    "reminder_date": today,
                    "flat_booking": fb.name,
                    "sent_to": clean_customer,
                }).insert(ignore_permissions=True)
            except Exception as e:
                frappe.log_error(str(e), "Reminder log failed for " + str(fb.name))

    role_users = frappe.get_all("Has Role", filters={"role": "SRC Finance Head"}, fields=["parent"])
    for ru in role_users:
        user_mobile = frappe.db.get_value("User", ru.parent, "mobile_no")
        if user_mobile:
            clean_number = "".join(ch for ch in str(user_mobile) if ch.isdigit())
            frappe.make_post_request(
                wm.message_url,
                data={"token": wm.token, "to": clean_number, "body": finance_caption}
            )

    frappe.db.set_value("Flat Booking", fb.name, "last_notified_date", today, update_modified=False)

frappe.db.commit()
