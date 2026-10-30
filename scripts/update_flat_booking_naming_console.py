# Paste into System Console (type: Python) on the site and press Execute. Tick "Commit" to save.
# Replaces the body of the "Flat Booking - Before Insert - Set Naming Series" server script.
# New names look like FB-GUL-A-4F-0001: site code from the flat's cost center, block, floor, counter.
# Existing bookings keep their names. To undo, the previous script text is printed first.

NAME = "Flat Booking - Before Insert - Set Naming Series"

NEW_SCRIPT = '''floor_map = {
    "Ground Floor": "GF", "First Floor": "FF", "Second Floor": "2F", "Third Floor": "3F",
    "Fourth Floor": "4F", "Fifth Floor": "5F", "Sixth Floor": "6F", "Seventh Floor": "7F",
    "Eighth Floor": "8F", "Ninth Floor": "9F", "Tenth Floor": "10F",
}

site_code = "SRC"
block_code = ""
floor_code = "FL"

if doc.flat:
    flat = frappe.db.get_value("Flat", doc.flat, ["cost_center", "block", "floor"], as_dict=True)
    if flat:
        # "1 - Gulbarga - SRC" -> drop the company suffix -> last named part "Gulbarga"
        parts = (flat.cost_center or "").split(" - ")
        if len(parts) > 1:
            parts = parts[:-1]
        named = [p for p in parts if any([c.isalpha() for c in p])]
        if named:
            words = [w for w in named[-1].replace("-", " ").split() if w[0].isalpha()]
            if len(words) == 1:
                site_code = words[0][:3].upper()
            elif words:
                site_code = "".join([w[0] for w in words[:4]]).upper()
        if flat.block:
            block_code = flat.block.upper()
        floor_code = floor_map.get(flat.floor, "FL")

parts = ["FB", site_code]
if block_code:
    parts.append(block_code)
parts.append(floor_code)
doc.naming_series = "-".join(parts) + "-.####"
'''

print("PREVIOUS SCRIPT (keep to undo):")
print(frappe.db.get_value("Server Script", NAME, "script"))
frappe.db.set_value("Server Script", NAME, "script", NEW_SCRIPT)
print("Updated. Tick Commit to save, then create a test booking.")
