"""Keeps open Site Showcase pages in step with ERPNext.

Whenever a Flat, a Building, a Flat Booking or a Flat Booking Cancellation changes (from the page, from the desk, from an
import or from a script), every open showcase page is told which site changed and re-reads it. Only ids travel in the message;
the page then asks the normal API, which applies the user's own permissions.
"""

import frappe


def _site_of_building(building):
	"""The site id the showcase uses for a Building (its cost center, else its project)."""
	if not building:
		return None
	row = frappe.db.get_value("Building", building, ["cost_center", "project", "building_name"], as_dict=True)
	if not row:
		return None
	return row.cost_center or "project:" + (row.project or row.building_name or building).strip()


def _notify(building):
	try:
		site = _site_of_building(building)
		if not site:
			return
		seen = frappe.local.flags.setdefault("showcase_notified", set())  # once per site per request, however many flats changed
		if site in seen:
			return
		seen.add(site)
		frappe.publish_realtime("showcase_inventory_changed", {"site": site, "building": building}, after_commit=True)
	except Exception:
		frappe.log_error(title="Site Showcase: could not notify open pages")  # a notification problem must never block a save


def flat_changed(doc, method=None):
	_notify(doc.get("building"))


def building_changed(doc, method=None):
	_notify(doc.name)


def booking_changed(doc, method=None):
	"""Flat Booking / Flat Booking Cancellation: the flat's status changes without the Flat itself being saved."""
	flat = doc.get("flat")
	if flat:
		_notify(frappe.db.get_value("Flat", flat, "building"))
