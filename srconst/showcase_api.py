"""Backend of the Site Showcase page.

Inventory comes from the ERP itself: Project (Building.project) -> Building -> Flat. Nothing is copied:
statuses, prices and areas are read live, so the page can never disagree with ERPNext.

Booking and cancellation are done by creating and submitting the real Flat Booking / Flat Booking Cancellation
documents as the logged-in user. Everything that ERPNext does on those documents (naming series, flat status,
sales invoice, WhatsApp PDF, payment reversal) is done by the existing Server Scripts, not re-implemented here.

Presentation media (building photo, floor plan, flat areas on the plan) live in the "Building Showcase" doctype,
one record per Building, so the ERP doctypes are left untouched.

"""

import hashlib
import json
import math
import os
import re

import frappe
from frappe import _
from frappe.utils import add_months, cint, flt, getdate, nowdate

CACHE_DIR = "showcase_cache"  # under the site's public/files, so it survives app updates and is site specific
MANAGE_ROLES = ("System Manager", "SRC MD", "SRC Admin")  # showcase media, flat mapping
CREATE_SITE_ROLES = ("System Manager", "SRC MD")  # may add Buildings and Flats from the page (see create_site_flats)
PRICE_ROLES = ("SRC Finance Head", "SRC MD")  # only these may book at a price other than the flat's base price
PALETTE = ["#38bdf8", "#34d399", "#fbbf24", "#f43f5e", "#a855f7", "#06b6d4"]
DEFAULT_FLOORS = [
	"Ground Floor", "First Floor", "Second Floor", "Third Floor", "Fourth Floor", "Fifth Floor",
	"Sixth Floor", "Seventh Floor", "Eighth Floor", "Ninth Floor", "Tenth Floor",
]  # fallback only; the real list is read from the Flat doctype's `floor` options
STATUS_LABEL = {"Empty": "Available", "In Process": "In Process", "Sold": "Sold"}
# Cost centers that are not construction sites. Override with `showcase_hidden_cost_centers: [...]` in site_config.json.
# A cost center that has Buildings is always shown, whatever its name.
HIDDEN_COST_CENTERS = ("main", "admin and overhead", "head office", "project alpha", "project beta", "project gamma")
# Flat numbers read <block letter><floor code><n> (BFFF4 = block B, Fourth Floor, no. 4); series match the Flat server script.
FLOOR_CODE = {
	"Ground Floor": "GF", "First Floor": "FF", "Second Floor": "SF", "Third Floor": "TF", "Fourth Floor": "FFF",
	"Fifth Floor": "FiF", "Sixth Floor": "SiF", "Seventh Floor": "SeF", "Eighth Floor": "EF", "Ninth Floor": "NF", "Tenth Floor": "TeF",
}
FLOOR_SERIES = {
	"Ground Floor": "GF-.####", "First Floor": "FF-.####", "Second Floor": "SF-.####", "Third Floor": "TF-.####",
	"Fourth Floor": "FoF-.####", "Fifth Floor": "FiF-.####", "Sixth Floor": "SiF-.####", "Seventh Floor": "SeF-.####",
	"Eighth Floor": "EF-.####", "Ninth Floor": "NF-.####", "Tenth Floor": "TeF-.####",
}
MAX_BLOCKS, MAX_FLATS_PER_CALL = 10, 600

# ============================================================================ permissions


def _perms():
	roles = set(frappe.get_roles())
	return {
		"book": bool(frappe.has_permission("Flat Booking", "create")),
		"cancel": bool(frappe.has_permission("Flat Booking Cancellation", "create")),
		"manage": bool(roles & set(MANAGE_ROLES)),
		"create_site": bool(roles & set(CREATE_SITE_ROLES)),
		"edit_price": bool(roles & set(PRICE_ROLES)),
	}


def _require_create_site():
	if not set(frappe.get_roles()) & set(CREATE_SITE_ROLES):
		frappe.throw(_("Only {0} can add sites").format(", ".join(CREATE_SITE_ROLES)), frappe.PermissionError)


def _require_manage():
	if not set(frappe.get_roles()) & set(MANAGE_ROLES):
		frappe.throw(_("Only {0} can change the showcase media").format(", ".join(MANAGE_ROLES)), frappe.PermissionError)


# ============================================================================ inventory


@frappe.whitelist()
def get_showcase_sites():
	return {"success": True, "data": _erp_summaries(), "perms": _perms()}


@frappe.whitelist()
def get_showcase_site(site_id):
	site = _erp_site(site_id)
	return {"success": bool(site), "data": site, "perms": _perms()}


def _project_of(b):
	return (b.get("project") or b.get("building_name") or b.get("name") or "").strip()


def _tidy(name):
	"""'  SR Galaxy' / 'SR Galaxy - SR Galaxy' -> 'SR Galaxy'"""
	parts = []
	for p in (name or "").split(" - "):
		p = p.strip()
		if p and (not parts or parts[-1].lower() != p.lower()):
			parts.append(p)
	return " - ".join(parts)


def _hidden_cost_centers():
	conf = frappe.conf.get("showcase_hidden_cost_centers")
	return {str(x).strip().lower() for x in (conf if isinstance(conf, (list, tuple)) else HIDDEN_COST_CENTERS)}


def _sites():
	"""Every construction site: each leaf Cost Center, with the Buildings booked to it. {site_id: {...}}

	A site with no Buildings yet is still listed (so it can be set up); overhead cost centers are not.
	"""
	ccs = frappe.get_all("Cost Center", filters={"is_group": 0, "disabled": 0}, fields=["name", "cost_center_name", "company"], order_by="name asc")
	buildings = frappe.get_list(
		"Building", fields=["name", "building_name", "project", "company", "total_floors", "cost_center"], order_by="name asc", limit_page_length=0
	)
	by = {}
	for b in buildings:
		by.setdefault(b.cost_center or "project:" + _project_of(b), []).append(b)

	def title(label, bl):
		projects = {(b.project or "").strip() for b in bl if (b.project or "").strip()}
		return projects.pop() if len(projects) == 1 else label

	hidden = _hidden_cost_centers()
	sites = {}
	for cc in ccs:
		label = _tidy(cc.cost_center_name or cc.name)
		bl = by.pop(cc.name, [])
		if not bl and label.lower() in hidden:
			continue
		sites[cc.name] = {"id": cc.name, "name": title(label, bl), "label": label, "company": cc.company, "cost_center": cc.name, "buildings": bl}
	for key, bl in by.items():  # Buildings whose cost center is missing, disabled or a group
		sites[key] = {"id": key, "name": title(_project_of(bl[0]), bl), "label": _project_of(bl[0]), "company": bl[0].company, "cost_center": None, "buildings": bl}
	return sites


def _erp_summaries():
	sites = _sites()
	if not sites:
		return []
	counts = {}
	for r in frappe.get_list("Flat", fields=["building", "status", "count(name) as c"], group_by="building, status", limit_page_length=0):
		counts.setdefault(r.building, {})[r.status] = r.c
	media = {m.building: m for m in frappe.get_all("Building Showcase", fields=["building", "building_image"], limit_page_length=0)}

	out = []
	for s in sites.values():
		blocks = total = available = floors = 0
		image = None
		for b in s["buildings"]:
			c = counts.get(b.name, {})
			n = sum(c.values())
			if not n:
				continue
			blocks += 1
			total += n
			available += c.get("Empty", 0)
			floors = max(floors, cint(b.total_floors))
			image = image or (media.get(b.name) or {}).get("building_image")
		out.append(
			{
				"id": s["id"],
				"kind": "erp",
				"name": s["name"],
				"developer": s["company"],
				"location": None,
				"description": None,
				"empty": total == 0,
				"image": optimized(image, 1000) if image else None,
				"stats": {"blocks": blocks, "floors": floors, "total": total, "available": available},
			}
		)
	out.sort(key=lambda x: (x["empty"], x["name"].lower()))
	return out


def _floor_order():
	try:
		opts = frappe.get_meta("Flat").get_field("floor").options or ""
		floors = [o for o in opts.split("\n") if o]
		return floors or DEFAULT_FLOORS
	except Exception:
		return DEFAULT_FLOORS


def _natural(s):
	return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s or "")]


SHOWCASE_FLAT_FIELDS = ["showcase_plan_position", "showcase_inside_image", "showcase_description", "showcase_highlights"]


def _flat_fields():
	base = ["name", "flat_number", "building", "block", "floor", "flat_type", "facing", "area_sqft", "base_price", "status", "booking_ref"]
	meta = frappe.get_meta("Flat")
	return base + [f for f in SHOWCASE_FLAT_FIELDS if meta.has_field(f)]


def _flat_photos(flat_names):
	"""{flat: [{src, thumb, caption}]} from the Photos table of the Showcase section."""
	if not flat_names or not frappe.get_meta("Flat").has_field("showcase_photos"):
		return {}
	out = {}
	for r in frappe.get_all(
		"Flat Showcase Photo", filters={"parent": ["in", flat_names], "parenttype": "Flat"}, fields=["parent", "image", "caption"], order_by="parent, idx"
	):
		if r.image:
			out.setdefault(r.parent, []).append({"src": optimized(r.image, 1600), "thumb": optimized(r.image, 420), "caption": r.caption or ""})
	return out


def _positions(rows):
	"""{flat name: plan position}: the position saved on the flat, else the next free number (flat-number order)."""
	pos = {f.name: cint(f.get("showcase_plan_position")) for f in rows}
	used = {p for p in pos.values() if p}
	n = 1
	for f in sorted((f for f in rows if not pos[f.name]), key=lambda x: _natural(x.flat_number)):
		while n in used:
			n += 1
		pos[f.name] = n
		used.add(n)
	return pos


def _erp_site(site_id):
	site = _sites().get(site_id)
	if not site:
		return None
	buildings = site["buildings"]
	if not buildings:
		return {"id": site["id"], "kind": "erp", "name": site["name"], "developer": site["company"], "cost_center": site["cost_center"], "empty": True, "blocks": []}
	names = [b.name for b in buildings]
	flats = frappe.get_list(
		"Flat",
		filters={"building": ["in", names]},
		fields=_flat_fields(),
		limit_page_length=0,
	)
	photos = _flat_photos([f.name for f in flats])
	media = {m.building: m for m in frappe.get_all("Building Showcase", fields=["building", "building_image", "floor_plan_image", "plan_hotspots", "brochure"], filters={"building": ["in", names]})}
	plan_rows = {}
	for r in frappe.get_all(
		"Building Showcase Floor", filters={"parent": ["in", names], "parenttype": "Building Showcase"},
		fields=["parent", "floors", "floor_plan_image", "plan_hotspots"], order_by="idx asc",
	):
		plan_rows.setdefault(r.parent, []).append(r)
	floors = _floor_order()
	crop_cache = {}

	def crops_for(src, custom):
		if not src or not custom:
			return {}
		key = (src, json.dumps(custom, sort_keys=True))
		if key not in crop_cache:
			crop_cache[key] = flat_crops(src, {k: v for k, v in custom.items() if isinstance(v, list) and len(v) == 4})
		return crop_cache[key]

	blocks = []
	for i, b in enumerate(buildings):
		mine = [f for f in flats if f.building == b.name]
		if not mine:
			continue
		m = media.get(b.name) or {}
		default_src, default_custom = m.get("floor_plan_image"), _parse_hotspots(m.get("plan_hotspots"))
		from_brochure = not default_src and bool(m.get("brochure"))
		if from_brochure:
			default_src = _plan_from_brochure(m.get("brochure"), b.name)
		rows = plan_rows.get(b.name, [])

		def plan_for(floor):
			"""(plan image, flat areas) for one floor: its own row if it has one, else the building's default plan"""
			for r in rows:
				if floor in _lines(r.floors):
					return (r.floor_plan_image or default_src), _parse_hotspots(r.plan_hotspots)
			return default_src, default_custom

		per_floor = {}
		for f in mine:
			per_floor.setdefault(f.floor, []).append(f)
		widest = max(len(v) for v in per_floor.values())

		levels = []
		for floor in sorted(per_floor, key=lambda x: floors.index(x) if x in floors else 99):
			idx = floors.index(floor) if floor in floors else 99
			plan_src, custom = plan_for(floor)
			plan = optimized(plan_src, 2000) if plan_src else None
			crops = crops_for(plan_src, custom)
			units = []
			where = _positions(per_floor[floor])
			for f in sorted(per_floor[floor], key=lambda x: (where[x.name], _natural(x.flat_number))):
				pos = where[f.name]
				crop = crops.get(str(pos))
				inside = f.get("showcase_inside_image")  # an image set on the flat itself beats the view cut from the plan
				units.append(
					{
						"id": f.name,
						"name": f.flat_number,
						"type": f.flat_type or "",
						"facing": f.facing or "",
						"area": flt(f.area_sqft) or None,
						"price": flt(f.base_price) or None,
						"status": STATUS_LABEL.get(f.status, f.status),
						"rawStatus": f.status,
						"bookingRef": f.booking_ref,
						"render3d": optimized(inside, 1600) if inside else (crop[0] if crop else None),
						"thumb": optimized(inside, 520) if inside else (crop[1] if crop else None),  # an unmapped plan would only repeat the whole page on every card
						"plan2d": plan,
						"planIsFloor": True,
						"unitIndex": pos,
						"hotspot": custom.get(str(pos)) if plan else None,
						"dims": {},
						"features": _lines(f.get("showcase_highlights")),
						"description": (f.get("showcase_description") or "").strip(),
						"photos": photos.get(f.name, []),
					}
				)
			levels.append({"level": idx, "label": floor, "short": "G" if idx == 0 else str(idx), "floorplate": plan, "mapped": bool(custom), "fromBrochure": bool(plan) and from_brochure and not any(floor in _lines(r.floors) and r.floor_plan_image for r in rows), "units": units})

		blocks.append(
			{
				"id": b.name,
				"name": _block_label(b.building_name or b.name, site["label"]),
				"color": PALETTE[i % len(PALETTE)],
				"totalFloors": cint(b.total_floors) or len(levels),
				"elevation": optimized(m.get("building_image"), 1600) if m.get("building_image") else None,
				"brochure": m.get("brochure"),
				"hasPlan": any(l["floorplate"] for l in levels),
				"levels": levels,
			}
		)

	first_img = next((media[n].get("building_image") for n in names if media.get(n) and media[n].get("building_image")), None)
	return {
		"id": site["id"],
		"kind": "erp",
		"name": site["name"],
		"developer": site["company"],
		"cost_center": site["cost_center"],
		"empty": False,
		"location": None,
		"description": None,
		"hero": optimized(first_img, 1920) if first_img else None,
		"brochure": next((x["brochure"] for x in blocks if x["brochure"]), None),
		"blocks": blocks,
	}


_IMAGE_EXT = (".png", ".jpg", ".jpeg", ".webp")


def _plan_from_brochure(url, building):
	"""An image brochure is itself the plan until a real floor plan is uploaded; a PDF gives its largest embedded image."""
	if not url:
		return None
	if url.lower().split("?")[0].endswith(_IMAGE_EXT):
		return url
	if url.lower().split("?")[0].endswith(".pdf"):
		return _extract_plan(url, building)  # cached under a name derived from the file, so repeat calls are cheap
	return None


def _block_label(name, site_label):
	suffix = " - " + (site_label or "")
	return name[: -len(suffix)] if site_label and name.endswith(suffix) and len(name) > len(suffix) else name


def _lines(text):
	return [l.strip() for l in (text or "").splitlines() if l.strip()]


def _parse_hotspots(text):
	if not text:
		return {}
	try:
		d = json.loads(text)
		return d if isinstance(d, dict) else {}
	except ValueError:
		return {}


def _auto_hotspot(idx, per_floor):
	"""Two-column serpentine layout: left column numbered bottom-to-top, right top-to-bottom.
	A first guess only; the Map flats tool on the page fits it to the real plan."""
	rows = max(1, math.ceil(per_floor / 2))
	h = 87.5 / rows
	if idx <= rows:
		x, w, row = 6.2, 39.8, rows - idx
	else:
		x, w, row = 52.5, 41, idx - rows - 1
	row = min(row, rows - 1)
	return [x, round(7.2 + row * h, 2), w, round(h - 1.2, 2)]


# ============================================================================ create a site (Buildings + Flats)


def _select_options(doctype, fieldname):
	f = frappe.get_meta(doctype).get_field(fieldname)
	return [o for o in ((f.options or "").split("\n") if f else []) if o]


@frappe.whitelist()
def site_of_flat(flat):
	"""The showcase site a flat belongs to (for the "View on Showcase" button of the Flat form)."""
	f = frappe.get_doc("Flat", flat)
	f.check_permission("read")
	from srconst.showcase_sync import _site_of_building

	return _site_of_building(f.building)


@frappe.whitelist()
def site_options():
	"""What the Add site form offers."""
	_require_create_site()
	sites = _sites()
	hidden = _hidden_cost_centers()
	rows = []
	for cc in frappe.get_all("Cost Center", filters={"is_group": 0, "disabled": 0}, fields=["name", "cost_center_name", "company"], order_by="name asc"):
		label = _tidy(cc.cost_center_name or cc.name)
		if label.lower() in hidden and not (sites.get(cc.name) or {}).get("buildings"):
			continue
		rows.append({"name": cc.name, "label": label, "company": cc.company, "buildings": [b.building_name for b in (sites.get(cc.name) or {}).get("buildings", [])]})
	parents = [
		{"name": g.name, "label": _tidy(g.cost_center_name or g.name), "company": g.company, "root": not g.parent_cost_center}
		for g in frappe.get_all("Cost Center", filters={"is_group": 1, "disabled": 0}, fields=["name", "cost_center_name", "company", "parent_cost_center"], order_by="lft asc")
	]
	return {
		"cost_centers": rows,
		"parents": parents,
		"floors": _floor_order(),
		"flat_types": _select_options("Flat", "flat_type"),
		"facings": _select_options("Flat", "facing"),
	}


def _block_letter(building_name):
	"""'BLOCK A' -> 'A', 'Tower 2' -> '2', 'Pride' -> 'P'"""
	words = re.findall(r"[A-Za-z0-9]+", building_name or "")
	if not words:
		return "X"
	last = words[-1]
	return (last if len(last) == 1 else words[0][0]).upper()


@frappe.whitelist(methods=["POST"])
def create_site_flats(cost_center=None, project=None, blocks=None, building_image=None, floor_plan_image=None, brochure=None, new_cost_center=None):
	"""Create Buildings and their Flats (status Empty) for a site, the same records the ERPNext forms create.
	Allowed for CREATE_SITE_ROLES (System Manager, SRC MD).

	blocks: [{building_name, floors, flats_per_floor, flat_type, area_sqft, facing, base_price}, ...]
	"""
	# The role check above is the permission rule for this action. System Manager has no create right on the custom
	# Building / Flat doctypes, so the records are inserted with ignore_permissions after that check.
	_require_create_site()
	if isinstance(blocks, str):
		blocks = json.loads(blocks)
	if isinstance(new_cost_center, str):
		new_cost_center = json.loads(new_cost_center) if new_cost_center else None

	cc_label = None
	new_cc_args = None
	if new_cost_center:  # a brand-new site: its cost center is created in the same transaction as its buildings
		cc_name = (new_cost_center.get("name") or "").strip()
		parent = frappe.db.get_value("Cost Center", new_cost_center.get("parent"), ["name", "company", "is_group", "disabled"], as_dict=True)
		if not cc_name:
			frappe.throw(_("Enter the new site's name"))
		if not parent or not parent.is_group or parent.disabled:
			frappe.throw(_("Choose the group the new site belongs under"))
		if frappe.db.exists("Cost Center", {"cost_center_name": cc_name, "company": parent.company}):
			frappe.throw(_("A cost center named {0} already exists. Pick it from the list instead.").format(cc_name))
		cc = frappe._dict(name=None, company=parent.company)
		cc_label = cc_name
		new_cc_args = {"doctype": "Cost Center", "cost_center_name": cc_name, "parent_cost_center": parent.name, "company": parent.company, "is_group": 0}
		cost_center = cc_name
	else:
		cc = frappe.db.get_value("Cost Center", cost_center, ["name", "company", "is_group", "disabled", "cost_center_name"], as_dict=True)
		if not cc or cc.is_group or cc.disabled:
			frappe.throw(_("Choose a site (leaf cost center)"))
		cc_label = _tidy(cc.cost_center_name or cc.name)
	project = (project or "").strip() or cc_label
	if not blocks or len(blocks) > MAX_BLOCKS:
		frappe.throw(_("Add between 1 and {0} blocks").format(MAX_BLOCKS))

	floors_all, types, facings = _floor_order(), _select_options("Flat", "flat_type"), _select_options("Flat", "facing")
	block_options = _select_options("Flat", "block")
	series = (_select_options("Building", "naming_series") or ["BLD-.YYYY.-.####"])[0]

	clean, names, total = [], set(), 0
	for i, b in enumerate(blocks, start=1):
		name = (b.get("building_name") or "").strip()
		floors, per, area, price = cint(b.get("floors")), cint(b.get("flats_per_floor")), flt(b.get("area_sqft")), flt(b.get("base_price"))
		ftype, facing = (b.get("flat_type") or "").strip(), (b.get("facing") or "").strip()
		if not name:
			frappe.throw(_("Block {0}: enter a building name").format(i))
		entered = name
		if frappe.db.exists("Building", name) or name.lower() in names:
			name = f"{entered} - {cc_label}"  # Building names are unique across sites, so the site name is appended
		if name.lower() in names or frappe.db.exists("Building", name):
			frappe.throw(_("A Building named {0} already exists. Use a different name.").format(name))
		names.add(name.lower())
		if not 1 <= floors <= len(floors_all):
			frappe.throw(_("{0}: floors must be between 1 and {1}").format(name, len(floors_all)))
		if not 1 <= per <= 20:
			frappe.throw(_("{0}: flats per floor must be between 1 and 20").format(name))
		if area <= 0 or price <= 0:
			frappe.throw(_("{0}: area and base price must be greater than zero").format(name))
		if ftype and ftype not in types:
			frappe.throw(_("{0}: unknown flat type {1}").format(name, ftype))
		if facing and facing not in facings:
			frappe.throw(_("{0}: unknown facing {1}").format(name, facing))
		total += floors * per
		clean.append((name, floors, per, area, price, ftype, facing, entered))
	if total > MAX_FLATS_PER_CALL:
		frappe.throw(_("That would create {0} flats. Create at most {1} at a time.").format(total, MAX_FLATS_PER_CALL))

	has_position = frappe.get_meta("Flat").has_field("showcase_plan_position")
	frappe.db.savepoint("showcase_site")
	created = []
	try:
		if new_cc_args:
			made = frappe.get_doc(new_cc_args).insert(ignore_permissions=True)
			cc.name = made.name
			cost_center = made.name
		for name, floors, per, area, price, ftype, facing, entered in clean:
			building = frappe.get_doc(
				{
					"doctype": "Building", "naming_series": series, "building_name": name, "project": project, "company": cc.company,
					"cost_center": cc.name, "total_floors": floors, "total_flats": floors * per,
				}
			).insert(ignore_permissions=True)
			letter = _block_letter(entered)
			for floor in floors_all[:floors]:
				code = FLOOR_CODE.get(floor, floor[:2].upper())
				for n in range(1, per + 1):
					frappe.get_doc(
						{
							"doctype": "Flat", "naming_series": FLOOR_SERIES.get(floor, "GF-.####"), "flat_number": f"{letter}{code}{n}",
							"block": letter if letter in block_options else None, "building": building.name, "floor": floor, "status": "Empty",
							"company": cc.company, "cost_center": cc.name, "area_sqft": area, "base_price": price,
							"flat_type": ftype or None, "facing": facing or None, **({"showcase_plan_position": n} if has_position else {}),
						}
					).insert(ignore_permissions=True)
			created.append({"building": building.name, "flats": floors * per, "renamed": building.name != entered})
		if building_image or floor_plan_image or brochure:
			for c in created:
				media = _showcase_doc(c["building"])
				_apply_media(media, building_image, floor_plan_image, brochure)
				media.save(ignore_permissions=True)
	except Exception:
		frappe.db.rollback(save_point="showcase_site")
		raise
	return {"success": True, "site": cc.name, "buildings": created, "flats": total}


# ============================================================================ showcase media (admin)


def _floors_with_flats(building):
	return [r.floor for r in frappe.get_all("Flat", filters={"building": building}, fields=["floor"], distinct=True) if r.floor]


def _drop_floors_from_plans(doc, floors):
	"""Take these floors out of every floor-specific plan row (rows left with no floors are removed)."""
	kept = []
	for r in doc.get("floor_plans") or []:
		rest = [f for f in _lines(r.floors) if f not in floors]
		if rest:
			kept.append({"floors": "\n".join(rest), "floor_plan_image": r.floor_plan_image, "plan_hotspots": r.plan_hotspots})
	doc.set("floor_plans", kept)


def _plan_src_for(doc, floor):
	default = doc.floor_plan_image or _plan_from_brochure(doc.brochure, doc.building)
	for r in doc.get("floor_plans") or []:
		if floor in _lines(r.floors):
			return r.floor_plan_image or default
	return default


def _chosen_floors(building, floors):
	if isinstance(floors, str):
		floors = json.loads(floors) if floors else []
	every = set(_floors_with_flats(building))
	chosen = [f for f in (floors or []) if f in every] or sorted(every)
	return chosen, every


def _is_derived(url):
	"""A plan cut or extracted from a brochure (as opposed to a floor plan someone uploaded)."""
	return bool(url) and f"/{CACHE_DIR}/plan-" in url


def _drop_derived_plans(doc):
	"""A new brochure invalidates every plan that was cut from the old one, and the flat mapping drawn on it."""
	if _is_derived(doc.floor_plan_image):
		doc.floor_plan_image = ""
		doc.plan_hotspots = ""
	kept = [
		{"floors": r.floors, "floor_plan_image": r.floor_plan_image, "plan_hotspots": r.plan_hotspots}
		for r in (doc.get("floor_plans") or [])
		if not _is_derived(r.floor_plan_image)
	]
	doc.set("floor_plans", kept)


def _apply_media(doc, building_image=None, floor_plan_image=None, brochure=None, extract_plan=0, floors=None):
	if building_image:
		doc.building_image = building_image
	if brochure:
		if brochure != doc.brochure:
			_drop_derived_plans(doc)
		doc.brochure = brochure
		if brochure.lower().endswith(".pdf"):  # extract the plan now, while the manager is saving, so nobody waits for it later
			optimized(_plan_from_brochure(brochure, doc.building), 2000)
		if cint(extract_plan) and not floor_plan_image:
			floor_plan_image = _extract_plan(brochure, doc.building)
	if floor_plan_image:
		chosen, every = _chosen_floors(doc.building, floors)
		if set(chosen) >= every:  # one plan for every floor
			doc.floor_plan_image = floor_plan_image
			doc.set("floor_plans", [])
		else:  # a plan for just these floors; their flat mapping starts empty
			_drop_floors_from_plans(doc, chosen)
			doc.append("floor_plans", {"floors": "\n".join(chosen), "floor_plan_image": floor_plan_image, "plan_hotspots": ""})


@frappe.whitelist(methods=["POST"])
def save_building_media(building, building_image=None, floor_plan_image=None, brochure=None, extract_plan=0, floors=None, site_id=None, apply_to_site=0):
	"""Display image, brochure and floor plan of a Building. A floor plan can apply to every floor or only to chosen floors.

	With apply_to_site, the display image and brochure are also set on the site's other buildings.
	"""
	_require_manage()
	if not frappe.db.exists("Building", building):
		frappe.throw(_("Building {0} not found").format(building))
	doc = _showcase_doc(building)
	_apply_media(doc, building_image, floor_plan_image, brochure, extract_plan, floors)
	doc.save(ignore_permissions=True)  # permission is the role check above; this doctype has no per-user rules
	if cint(apply_to_site) and site_id and (building_image or brochure):
		for b in (_sites().get(site_id) or {}).get("buildings", []):
			if b.name != building:
				other = _showcase_doc(b.name)
				_apply_media(other, building_image, None, brochure)
				other.save(ignore_permissions=True)
	return {"success": True}


@frappe.whitelist(methods=["POST"])
def crop_plan(building, rect, floors=None):
	"""Cut the floor plan out of a larger picture (e.g. a brochure page): rect = [x, y, w, h] in % of that picture.

	The cut-out (made from the original, full-resolution file) becomes the plan for the chosen floors; their flat mapping
	starts empty because the picture changed.
	"""
	_require_manage()
	if not frappe.db.exists("Building", building):
		frappe.throw(_("Building {0} not found").format(building))
	rect = json.loads(rect) if isinstance(rect, str) else rect
	if not (isinstance(rect, (list, tuple)) and len(rect) == 4):
		frappe.throw(_("Select the plan area first"))
	x, y, w, h = (max(0.0, min(100.0, flt(n))) for n in rect)
	if w < 5 or h < 5:
		frappe.throw(_("The selected area is too small"))
	chosen, every = _chosen_floors(building, floors)
	if not chosen:
		frappe.throw(_("This building has no flats yet"))
	doc = _showcase_doc(building)
	src = _plan_src_for(doc, chosen[0])
	path = _local_path((src or "").split("?")[0])
	if not path or not os.path.exists(path):
		frappe.throw(_("There is no picture to crop yet. Add a brochure or floor plan in Setup first."))
	from PIL import Image

	Image.MAX_IMAGE_PIXELS = None
	with Image.open(path) as im:
		im = im.convert("RGB")
		W, H = im.size
		cut = im.crop((int(W * x / 100), int(H * y / 100), min(W, int(W * (x + w) / 100)), min(H, int(H * (y + h) / 100))))
	name = "plan-crop-%s.webp" % hashlib.sha1(f"{src}|{x}|{y}|{w}|{h}".encode()).hexdigest()[:12]
	cut.save(os.path.join(_cache_dir(), name), "WEBP", quality=94, method=6)
	url = f"/files/{CACHE_DIR}/{name}"
	_apply_media(doc, floor_plan_image=url, floors=chosen)
	if set(chosen) >= every:
		doc.plan_hotspots = ""
	doc.save(ignore_permissions=True)
	return {"success": True, "plan": url, "size": [cut.width, cut.height]}


@frappe.whitelist(methods=["POST"])
def save_plan_hotspots(building, hotspots, floors=None):
	"""Store the flat areas drawn on a plan: {"<position on the floor>": [x, y, w, h]} in % of the image.

	`floors` are the floors this mapping applies to (default: every floor). Floors that differ from the rest get their
	own floor-specific plan row, so each floor can keep its own layout.
	"""
	_require_manage()
	if not frappe.db.exists("Building", building):
		frappe.throw(_("Building {0} not found").format(building))
	data = json.loads(hotspots) if isinstance(hotspots, str) else hotspots
	clean = {}
	for k, v in (data or {}).items():
		if not (isinstance(v, (list, tuple)) and len(v) == 4):
			frappe.throw(_("Bad area for flat position {0}").format(k))
		x, y, w, h = (max(0.0, min(100.0, flt(n))) for n in v)
		clean[str(cint(k))] = [round(x, 2), round(y, 2), round(w, 2), round(h, 2)]
	chosen, every = _chosen_floors(building, floors)
	if not chosen:
		frappe.throw(_("This building has no flats yet"))
	doc = _showcase_doc(building)
	src = _plan_src_for(doc, chosen[0])
	if set(chosen) >= every:
		doc.plan_hotspots = json.dumps(clean)
		if src:
			doc.floor_plan_image = src
		doc.set("floor_plans", [])
	else:
		_drop_floors_from_plans(doc, chosen)
		doc.append("floor_plans", {"floors": "\n".join(chosen), "floor_plan_image": src, "plan_hotspots": json.dumps(clean)})
	doc.save(ignore_permissions=True)
	return {"success": True}


def _showcase_doc(building):
	if frappe.db.exists("Building Showcase", building):
		return frappe.get_doc("Building Showcase", building)
	return frappe.get_doc({"doctype": "Building Showcase", "building": building})


def _extract_plan(file_url, building):
	"""Pull the largest image out of an uploaded brochure PDF (or use the image itself) as the floor plan.

	The result is cached under a name derived from the file, so asking again is cheap.
	"""
	try:
		slug = re.sub(r"[^a-z0-9]+", "-", building.lower()).strip("-") or "building"
		name = f"plan-{slug}-{hashlib.sha1(file_url.encode()).hexdigest()[:8]}.webp"
		out = os.path.join(_cache_dir(), name)
		if os.path.exists(out):
			return f"/files/{CACHE_DIR}/{name}"
		from PIL import Image

		path = frappe.get_doc("File", {"file_url": file_url}).get_full_path()
		img = None
		if path.lower().endswith(".pdf"):
			import pypdf

			best = 0
			for page in pypdf.PdfReader(path).pages[:15]:
				for im in page.images:
					pil = im.image
					if pil.width * pil.height > best:
						best, img = pil.width * pil.height, pil
		else:
			img = Image.open(path)
		if img is None:
			return None
		img.convert("RGB").save(out, "WEBP", quality=92, method=4)
		return f"/files/{CACHE_DIR}/{name}"
	except Exception:
		frappe.log_error(title="Site Showcase: plan extraction failed")
		return None


# ============================================================================ booking


def build_booking_values(total_sale_value, booking_amount, installment_months, installment_start_date, gst_rate=0, payment_mode="installments"):
	"""Same arithmetic as the Flat Booking form: GST on the sale value, then the balance split over the months.

	Returns the money fields and the installment rows. Pure function (no database), so it is unit-tested.
	"""
	total = flt(total_sale_value, 2)
	booking = flt(booking_amount, 2)
	one_time = payment_mode == "one_time"
	months = 1 if one_time else cint(installment_months)  # the booking form always needs a schedule: one payment of the whole balance
	rate = flt(gst_rate)
	if total <= 0:
		frappe.throw(_("Sale value must be greater than zero"))
	if booking < 0 or booking > total:
		frappe.throw(_("Booking amount cannot exceed the sale value"))
	if months < 1 or months > 240:
		frappe.throw(_("Installment duration must be between 1 and 240 months"))
	if not installment_start_date:
		frappe.throw(_("First installment date is required"))

	gst_amount = flt(total * rate / 100, 2)
	total_with_gst = flt(total + gst_amount, 2)
	balance = flt(total_with_gst - booking, 2)
	if one_time and balance <= 0:
		frappe.throw(_("Nothing is left to pay after the booking amount. Use a smaller booking amount."))
	monthly = flt(balance / months, 2)
	start = getdate(installment_start_date)
	rows = []
	for i in range(1, months + 1):
		due = monthly if i < months else flt(balance - monthly * (months - 1), 2)
		rows.append(
			{
				"installment_no": i,
				"due_date": str(add_months(start, i - 1)),
				"amount_due": due,
				"amount_received": 0,
				"status": "Pending",
				"remarks": "One-time payment of the balance" if one_time else f"Installment {i} of {months}",
			}
		)
	return {"gst_amount": gst_amount, "total_with_gst": total_with_gst, "balance": balance, "monthly": monthly, "months": months, "installments": rows}


def _template_rate(template):
	if not template:
		return 0
	return sum(flt(t.rate) for t in frappe.get_doc("Sales Taxes and Charges Template", template).taxes)


@frappe.whitelist()
def booking_defaults(flat):
	"""Everything the booking form needs for one flat."""
	frappe.has_permission("Flat Booking", "create", throw=True)
	f = frappe.get_doc("Flat", flat)
	f.check_permission("read")
	templates = frappe.get_all(
		"Sales Taxes and Charges Template",
		filters={"company": f.company, "disabled": 0},
		fields=["name", "title", "is_default"],
		order_by="is_default desc, name asc",
	)
	for t in templates:
		t["rate"] = _template_rate(t.name)
	return {
		"flat": {
			"name": f.name, "flat_number": f.flat_number, "building": f.building, "block": f.block, "floor": f.floor,
			"flat_type": f.flat_type, "area_sqft": f.area_sqft, "base_price": f.base_price, "status": f.status,
			"company": f.company, "cost_center": f.cost_center,
		},
		"templates": templates,
		"can_edit_price": _perms()["edit_price"],
		"today": nowdate(),
		"first_installment": str(add_months(getdate(nowdate()), 1)),
	}


@frappe.whitelist()
def preview_schedule(total_sale_value, booking_amount, installment_months, installment_start_date, taxes_and_charges=None, payment_mode="installments"):
	frappe.has_permission("Flat Booking", "create", throw=True)
	if not taxes_and_charges:
		frappe.throw(_("Select a GST template"))
	rate = _template_rate(taxes_and_charges)
	out = build_booking_values(total_sale_value, booking_amount, installment_months, installment_start_date, rate, payment_mode)
	out["gst_rate"] = rate
	return out


@frappe.whitelist()
def search_customers(txt=""):
	txt = (txt or "").strip()
	filters = {}
	or_filters = None
	if txt:
		like = f"%{txt}%"
		or_filters = {"name": ["like", like], "customer_name": ["like", like], "mobile_number": ["like", like]}
	return frappe.get_list(
		"Customer",
		filters=filters,
		or_filters=or_filters,
		fields=["name", "customer_name", "mobile_number"],
		order_by="modified desc",
		limit_page_length=8,
	)


def _new_customer(c):
	name = (c.get("customer_name") or "").strip()
	mobile = re.sub(r"[^0-9+]", "", c.get("mobile_number") or "")
	if not name or len(mobile) < 8:
		frappe.throw(_("Customer name and a valid mobile number are required"))
	dup = frappe.db.get_value("Customer", {"mobile_number": mobile}, "name")
	if dup:
		frappe.throw(_("Customer {0} already has this mobile number. Select that customer instead.").format(dup))
	doc = frappe.get_doc({"doctype": "Customer", "customer_name": name, "mobile_number": mobile, "customer_type": c.get("customer_type") or "Individual"})
	if c.get("customer_email"):
		doc.customer_email = c["customer_email"].strip()
	doc.insert()  # as the logged-in user: if they cannot create customers they get Frappe's normal permission error
	return doc.name


@frappe.whitelist(methods=["POST"])
def book_flat(flat, booking_date, total_sale_value, booking_amount, installment_months, installment_start_date,
			customer=None, new_customer=None, taxes_and_charges=None, remarks=None, payment_mode="installments"):
	"""Create and submit a Flat Booking. The ERP's own scripts do the rest (flat status, invoice, WhatsApp PDF)."""
	frappe.has_permission("Flat Booking", "create", throw=True)
	if isinstance(new_customer, str):
		new_customer = json.loads(new_customer) if new_customer else None

	doc = None
	frappe.db.savepoint("showcase_book")
	try:
		frappe.has_permission("Flat", "read", flat, throw=True)
		f = frappe.db.get_value(
			"Flat", flat, ["name", "flat_number", "building", "block", "flat_type", "status", "company", "cost_center", "base_price"],
			as_dict=True, for_update=True,
		)
		if not f:
			frappe.throw(_("Flat {0} not found").format(flat))
		if f.status != "Empty":
			frappe.throw(_("Flat {0} is {1}. Only Empty flats can be booked.").format(f.flat_number, f.status))
		if not f.company or not f.cost_center:
			frappe.throw(_("Flat {0} has no company / cost center. Complete the flat first.").format(f.flat_number))

		if not taxes_and_charges:
			frappe.throw(_("Select a GST template"))
		tmpl = frappe.db.get_value("Sales Taxes and Charges Template", taxes_and_charges, ["company", "disabled"], as_dict=True)
		if not tmpl or tmpl.disabled or tmpl.company != f.company:
			frappe.throw(_("GST template {0} cannot be used for company {1}").format(taxes_and_charges, f.company))
		if flt(total_sale_value, 2) != flt(f.base_price, 2) and not _perms()["edit_price"]:
			frappe.throw(
				_("Only {0} can book at a price different from the flat's base price ({1}).").format(", ".join(PRICE_ROLES), flt(f.base_price)),
				frappe.PermissionError,
			)

		if not customer and new_customer:
			customer = _new_customer(new_customer)
		if not customer or not frappe.db.exists("Customer", customer):
			frappe.throw(_("Select or create a customer"))

		rate = _template_rate(taxes_and_charges)
		calc = build_booking_values(total_sale_value, booking_amount, installment_months, installment_start_date, rate, payment_mode)

		doc = frappe.get_doc(
			{
				"doctype": "Flat Booking",
				"naming_series": "FB-.YYYY.-.####",  # the "Before Insert" server script replaces it with the flat's series
				"customer": customer,
				"flat": f.name,
				"building": f.building,
				"block": f.block or "",
				"flat_type": f.flat_type or "",
				"booking_date": booking_date,
				"company": f.company,
				"cost_center": f.cost_center,
				"total_sale_value": flt(total_sale_value, 2),
				"booking_amount": flt(booking_amount, 2),
				"installment_months": calc["months"],
				"installment_start_date": installment_start_date,
				"taxes_and_charges": taxes_and_charges,
				"gst_rate": rate,
				"gst_amount": calc["gst_amount"],
				"total_with_gst": calc["total_with_gst"],
				"remarks": remarks or "Booked from Site Showcase",
				"installments": calc["installments"],
			}
		)
		doc.insert()
		doc.submit()
	except Exception as e:
		_rollback("showcase_book")
		# ERPNext commits part-way through a submit (printing a PDF writes an access log and commits), so when a
		# later script fails (WhatsApp, PDF...) the booking itself may already be saved. Report what is true.
		if doc and doc.name and frappe.db.get_value("Flat Booking", doc.name, "docstatus") == 1:
			if frappe.db.get_value("Flat", f.name, "booking_ref") == doc.name:
				frappe.log_error(title="Site Showcase: booking saved, a follow-up step failed", message=frappe.get_traceback())
				return _booking_result(doc, f.name, warning=_short(e))
			frappe.throw(_("Booking {0} was saved, but ERPNext stopped before finishing it: {1}. The flat is not held yet. Ask an administrator to complete the booking in ERPNext.").format(doc.name, _short(e)))
		raise

	return _booking_result(doc, f.name)


def _short(e):
	text = (str(e).strip().splitlines() or [""])[0][:220]
	if "wkhtmltopdf" in text:
		return _("the booking PDF could not be created because wkhtmltopdf is not installed on this server")
	return text


def _rollback(save_point):
	try:
		frappe.db.rollback(save_point=save_point)
	except Exception:  # the savepoint is gone once something inside the submit has committed
		frappe.db.rollback()


def _booking_result(doc, flat, warning=None):
	doc.reload()
	return {
		"success": True,
		"booking": doc.name,
		"customer": doc.customer,
		"sales_invoice": doc.sales_invoice,
		"flat_status": frappe.db.get_value("Flat", flat, "status"),
		"warning": warning,
	}


# ============================================================================ booking info + cancellation


@frappe.whitelist()
def booking_info(flat):
	"""The live booking behind a booked flat (for the sheet and the cancel form)."""
	ref = frappe.db.get_value("Flat", flat, "booking_ref")
	if not ref:
		return {"booking": None}
	b = frappe.get_doc("Flat Booking", ref)
	b.check_permission("read")
	cancelled = frappe.db.exists("Flat Booking Cancellation", {"flat_booking": b.name, "docstatus": ["<", 2]})
	paid = sum(1 for r in b.installments if r.status == "Paid")
	return {
		"booking": {
			"name": b.name,
			"customer": b.customer,
			"customer_name": frappe.db.get_value("Customer", b.customer, "customer_name"),
			"booking_date": str(b.booking_date),
			"total_sale_value": b.total_sale_value,
			"total_with_gst": b.total_with_gst,
			"booking_amount": b.booking_amount,
			"total_received": b.total_received,
			"total_outstanding": b.total_outstanding,
			"sales_invoice": b.sales_invoice,
			"docstatus": b.docstatus,
			"installments": len(b.installments),
			"installments_paid": paid,
			"pending_cancellation": cancelled,
		}
	}


@frappe.whitelist(methods=["POST"])
def cancel_booking(booking, reason, cancellation_date=None):
	"""Create and submit a Flat Booking Cancellation. Its server script reverses payments, invoice and booking, and frees the flat."""
	frappe.has_permission("Flat Booking Cancellation", "create", throw=True)
	reason = (reason or "").strip()
	if len(reason) < 5:
		frappe.throw(_("Please give a reason for the cancellation"))

	doc = None
	flat = None
	frappe.db.savepoint("showcase_cancel")
	try:
		b = frappe.get_doc("Flat Booking", booking)
		b.check_permission("read")
		flat = b.flat
		if b.docstatus != 1:
			frappe.throw(_("Booking {0} is not an active (submitted) booking").format(booking))
		if frappe.db.exists("Flat Booking Cancellation", {"flat_booking": booking, "docstatus": ["<", 2]}):
			frappe.throw(_("A cancellation already exists for booking {0}").format(booking))
		doc = frappe.get_doc(
			{
				"doctype": "Flat Booking Cancellation",
				"naming_series": "FBC-.YYYY.-.####",
				"flat_booking": b.name,
				"customer": b.customer,
				"flat": b.flat,
				"cancellation_date": cancellation_date or nowdate(),
				"requested_by": frappe.session.user,
				"reason": reason,
				"amount_to_refund": flt(b.total_received),
				"amount_refund_pending": flt(b.total_received),
			}
		)
		doc.insert()
		doc.submit()
		refund = flt(b.total_received)
	except Exception as e:
		_rollback("showcase_cancel")
		if doc and doc.name and frappe.db.get_value("Flat Booking Cancellation", doc.name, "docstatus") == 1:
			done = frappe.db.get_value("Flat Booking", booking, "docstatus") == 2 and frappe.db.get_value("Flat", flat, "status") == "Empty"
			if done:  # the cancellation itself finished; a later script (WhatsApp...) failed
				frappe.log_error(title="Site Showcase: cancellation saved, a follow-up step failed", message=frappe.get_traceback())
				return {"success": True, "cancellation": doc.name, "amount_to_refund": flt(doc.amount_to_refund), "flat_status": "Empty", "warning": _short(e)}
			frappe.throw(_("Cancellation {0} was saved, but the flat was NOT released: ERPNext stopped at a step that runs before the cancellation steps ({1}). The booking is still active. Ask an administrator to fix that step and complete it in ERPNext.").format(doc.name, _short(e)))
		raise
	return {"success": True, "cancellation": doc.name, "amount_to_refund": refund, "flat_status": frappe.db.get_value("Flat", flat, "status"), "warning": None}


# ============================================================================ images


def _cache_dir():
	path = frappe.get_site_path("public", "files", CACHE_DIR)
	os.makedirs(path, exist_ok=True)
	return path


def _inside(base, rel):
	"""base/rel, but only if it really stays inside base (no '..', no symlink out of it)."""
	root = os.path.realpath(base)
	path = os.path.realpath(os.path.join(root, rel))
	return path if path.startswith(root + os.sep) else None


def _local_path(url):
	if url.startswith("/assets/srconst/"):
		return _inside(frappe.get_app_path("srconst", "public"), url[len("/assets/srconst/") :])
	if url.startswith("/files/"):
		return _inside(frappe.get_site_path("public", "files"), url[len("/files/") :])
	if url.startswith("/private/files/"):
		return _inside(frappe.get_site_path("private", "files"), url[len("/private/files/") :])
	return None  # external URLs are served as they are


_OPT_MEMO = {}
_CROP_MEMO = {}


def optimized(url, max_side):
	"""A cached, downscaled WebP copy of an image (originals can be 90 MB once decoded in the browser).

	Copies live in the site's public/files/showcase_cache and are reused. Images uploaded as private files get a
	public downscaled copy too, since the page shows them to anyone who can open it. Only showcase images go through
	here, never brochure PDFs.
	"""
	if not url or not url.lower().split("?")[0].endswith((".webp", ".jpg", ".jpeg", ".png")):
		return url
	src = _local_path(url.split("?")[0])
	if not src or not os.path.exists(src):
		return url
	try:
		from PIL import Image

		Image.MAX_IMAGE_PIXELS = None
		st = os.stat(src)
		memo_key = (url, max_side, st.st_mtime_ns)
		if memo_key in _OPT_MEMO:
			return _OPT_MEMO[memo_key]
		key = hashlib.sha1(f"{url}|{st.st_mtime_ns}|{max_side}".encode()).hexdigest()[:16]
		out = os.path.join(_cache_dir(), key + ".webp")
		rel = f"/files/{CACHE_DIR}/{key}.webp"
		if os.path.exists(out):
			_OPT_MEMO[memo_key] = rel
			return rel
		with Image.open(src) as im:
			if max(im.size) <= max_side and st.st_size < 400 * 1024 and not url.startswith("/private/"):
				_OPT_MEMO[memo_key] = url
				return url
			im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
			im.thumbnail((max_side, max_side), Image.LANCZOS)
			im.save(out, "WEBP", quality=88, method=4)
		_OPT_MEMO[memo_key] = rel
		return rel
	except Exception:
		frappe.log_error(title="Site Showcase: image optimise failed")
		return url


def flat_crops(url, rects):
	"""Cut each mapped flat out of the full-resolution plan: {position: (sheet_url, thumb_url)}.

	The plan is opened once; results are cached on disk, so this only costs time after the mapping changes.
	"""
	src = _local_path((url or "").split("?")[0])
	if not src or not os.path.exists(src) or not rects:
		return {}
	st = os.stat(src)
	memo_key = (url, st.st_mtime_ns, json.dumps(rects, sort_keys=True))
	if memo_key in _CROP_MEMO:
		return _CROP_MEMO[memo_key]
	out_dir = _cache_dir()
	result, todo = {}, []
	for idx, r in rects.items():
		key = hashlib.sha1(f"crop3|{url}|{st.st_mtime_ns}|{r}".encode()).hexdigest()[:16]
		full, thumb = f"{key}-f.webp", f"{key}-t.webp"
		result[idx] = (f"/files/{CACHE_DIR}/{full}", f"/files/{CACHE_DIR}/{thumb}")
		if not (os.path.exists(os.path.join(out_dir, full)) and os.path.exists(os.path.join(out_dir, thumb))):
			todo.append((r, full, thumb))
	if todo:
		try:
			from PIL import Image, ImageFilter

			Image.MAX_IMAGE_PIXELS = None
			with Image.open(src) as im:
				im = im.convert("RGB")
				W, H = im.size
				for (x, y, w, h), full, thumb in todo:
					c = im.crop((int(W * x / 100), int(H * y / 100), int(W * (x + w) / 100), int(H * (y + h) / 100)))
					big = c.copy()
					longest = max(big.size)
					if longest < 1000:  # low-res source: enlarge smoothly, then sharpen so edges and labels stay readable
						k = 1000 / longest
						big = big.resize((round(big.width * k), round(big.height * k)), Image.LANCZOS)
						big = big.filter(ImageFilter.UnsharpMask(radius=2, percent=90, threshold=2))
					else:
						big.thumbnail((1400, 1400), Image.LANCZOS)
					big.save(os.path.join(out_dir, full), "WEBP", quality=92, method=6)
					c.thumbnail((520, 520), Image.LANCZOS)
					c.save(os.path.join(out_dir, thumb), "WEBP", quality=82, method=4)
		except Exception:
			frappe.log_error(title="Site Showcase: flat crop failed")
			return {}
	_CROP_MEMO[memo_key] = result
	return result
