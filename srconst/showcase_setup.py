"""Keeps the Site Showcase page reachable by the roles that sell flats.

Standard pages get their roles reset from the page JSON on every migrate, so the production roles are re-added
after each migrate. A role that does not exist on a site (for example a fresh dev site) is skipped.
"""

import frappe

PAGE = "site-showcase"
ROLES = [
	"System Manager", "Sales User", "Sales Manager",
	"SRC MD", "SRC Admin", "SRC Booking Executive", "SRC Finance Head", "SRC Finance Staff", "SRC Site Manager",
]


def ensure_page_roles():
	if not frappe.db.exists("Page", PAGE):
		return
	page = frappe.get_doc("Page", PAGE)
	have = {r.role for r in page.roles}
	added = []
	for role in ROLES:
		if role not in have and frappe.db.exists("Role", role):
			page.append("roles", {"role": role})
			added.append(role)
	if added:
		page.save(ignore_permissions=True)
	return added


def after_migrate():
	ensure_page_roles()
	from srconst import flat_showcase

	if flat_showcase.ensure_fields():  # the Showcase section on the Flat form, then positions for the flats that have none
		flat_showcase.backfill_positions()
