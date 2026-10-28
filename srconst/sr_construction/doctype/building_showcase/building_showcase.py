import json

import frappe
from frappe.model.document import Document


class BuildingShowcase(Document):
	def validate(self):
		self.building = (self.building or "").strip()
		if self.plan_hotspots:
			try:
				data = json.loads(self.plan_hotspots)
			except ValueError:
				frappe.throw("Plan Hotspots must be valid JSON")
			if not isinstance(data, dict):
				frappe.throw("Plan Hotspots must be an object keyed by flat position")
		for row in self.get("floor_plans") or []:
			if row.plan_hotspots:
				try:
					json.loads(row.plan_hotspots)
				except ValueError:
					frappe.throw(f"Row {row.idx}: Plan Hotspots must be valid JSON")
