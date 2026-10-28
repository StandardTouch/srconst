"""The "Showcase (web view)" section of the Flat form.

Adds Custom Fields to the production Flat doctype (after every migrate, idempotent) and keeps each flat's plan position
stable and unique per floor:

  Plan position           which box of the floor plan this flat uses (1, 2, 3...). Left empty, the next free number on the
                          floor is assigned when the flat is saved, so flats added in ERPNext never shift the others.
  Inside / 3D view image  replaces the view cut from the plan, for flats whose real render differs
  Description, Highlights text and bullet points shown on the flat sheet
  Photos                  a gallery shown on the flat sheet
"""

import frappe
from frappe import _
from frappe.utils import cint

POSITION = "showcase_plan_position"

CUSTOM_FIELDS = {
	"Flat": [
		{"fieldname": "showcase_section", "fieldtype": "Section Break", "label": "Showcase (web view)", "insert_after": "remarks", "collapsible": 1},
		{
			"fieldname": POSITION, "fieldtype": "Int", "label": "Plan position", "insert_after": "showcase_section",
			"description": "Which box of the floor plan this flat uses (1, 2, 3...). Leave empty and the next free number on the floor is used.",
		},
		{
			"fieldname": "showcase_inside_image", "fieldtype": "Attach Image", "label": "Inside / 3D view image", "insert_after": POSITION,
			"description": "Shown as this flat's 3D view on the Site Showcase page instead of the view cut from the floor plan.",
		},
		{"fieldname": "showcase_column", "fieldtype": "Column Break", "insert_after": "showcase_inside_image"},
		{"fieldname": "showcase_description", "fieldtype": "Small Text", "label": "Description", "insert_after": "showcase_column"},
		{
			"fieldname": "showcase_highlights", "fieldtype": "Small Text", "label": "Highlights", "insert_after": "showcase_description",
			"description": "One per line, e.g. Vastu compliant. Shown as chips on the flat sheet.",
		},
		{"fieldname": "showcase_photos_section", "fieldtype": "Section Break", "label": "Photos", "insert_after": "showcase_highlights"},
		{"fieldname": "showcase_photos", "fieldtype": "Table", "label": "Photos", "options": "Flat Showcase Photo", "insert_after": "showcase_photos_section"},
	]
}


def has_fields():
	try:
		return frappe.db.exists("DocType", "Flat") and frappe.get_meta("Flat").has_field(POSITION)
	except Exception:
		return False


def ensure_fields():
	"""Create the Showcase section on the Flat form if it is not there yet."""
	if not frappe.db.exists("DocType", "Flat") or not frappe.db.exists("DocType", "Flat Showcase Photo"):
		return False
	from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

	create_custom_fields(CUSTOM_FIELDS, update=True)
	frappe.clear_cache(doctype="Flat")
	return True


def _natural(s):
	import re

	return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s or "")]


def next_position(building, floor, exclude=None):
	used = {
		cint(p)
		for p in frappe.get_all(
			"Flat", filters={"building": building, "floor": floor, "name": ["!=", exclude or ""]}, pluck=POSITION
		)
		if cint(p)
	}
	n = 1
	while n in used:
		n += 1
	return n


def validate_flat(doc, method=None):
	"""Flat.validate: give a new flat the next free position, and keep positions unique on a floor."""
	if not has_fields() or not doc.get("building") or not doc.get("floor"):
		return
	pos = cint(doc.get(POSITION))
	if not pos:
		doc.set(POSITION, next_position(doc.building, doc.floor, exclude=doc.name))
		return
	if pos < 1:
		frappe.throw(_("Plan position must be 1 or more"))
	if doc.is_new() or any(doc.has_value_changed(f) for f in (POSITION, "floor", "building")):
		clash = frappe.db.get_value(
			"Flat", {"building": doc.building, "floor": doc.floor, POSITION: pos, "name": ["!=", doc.name or ""]}, ["name", "flat_number"], as_dict=True
		)
		if clash:
			frappe.throw(
				_("Plan position {0} on {1} of {2} is already used by flat {3}.").format(pos, doc.floor, doc.building, clash.flat_number or clash.name)
			)


def backfill_positions():
	"""Give every flat without a position one, in flat-number order, so the current mapping of each plan stays exactly as it is."""
	if not has_fields():
		return 0
	groups = {}
	for r in frappe.get_all("Flat", fields=["name", "flat_number", "building", "floor", POSITION], limit_page_length=0):
		groups.setdefault((r.building, r.floor), []).append(r)
	done = 0
	for rows in groups.values():
		used = {cint(r.get(POSITION)) for r in rows if cint(r.get(POSITION))}
		n = 1
		for r in sorted((r for r in rows if not cint(r.get(POSITION))), key=lambda r: _natural(r.flat_number or r.name)):
			while n in used:
				n += 1
			frappe.db.set_value("Flat", r.name, POSITION, n, update_modified=False)
			used.add(n)
			done += 1
	return done
