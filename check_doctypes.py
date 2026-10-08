import frappe

def get_real_estate_doctypes():
    doctypes = frappe.get_all("DocType", filters={"module": ["in", ["Sr Construction", "Real Estate", "Core"]], "name": ["like", "%Flat%"]}, pluck="name")
    doctypes += frappe.get_all("DocType", filters={"name": ["like", "%Site%"]}, pluck="name")
    doctypes += frappe.get_all("DocType", filters={"name": ["like", "%Room%"]}, pluck="name")
    doctypes += frappe.get_all("DocType", filters={"name": ["like", "%Unit%"]}, pluck="name")
    
    unique_doctypes = list(set(doctypes))
    result = {}
    for dt in unique_doctypes:
        meta = frappe.get_meta(dt)
        fields = [{"fieldname": df.fieldname, "fieldtype": df.fieldtype, "label": df.label} for df in meta.fields]
        result[dt] = fields
    
    import json
    print("DIAGNOSTIC_DATA_START")
    print(json.dumps(result, indent=2))
    print("DIAGNOSTIC_DATA_END")
