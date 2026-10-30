import unittest

import frappe
from frappe.tests.utils import FrappeTestCase

from srconst import showcase_api as api


class TestSchedule(unittest.TestCase):
	"""The arithmetic must match the Flat Booking form (GST on sale value, balance split over the months)."""

	def test_equal_split_last_row_absorbs_rounding(self):
		out = api.build_booking_values(1000000, 100000, 3, "2026-11-05")
		rows = out["installments"]
		self.assertEqual([r["installment_no"] for r in rows], [1, 2, 3])
		self.assertEqual(rows[0]["amount_due"], 300000.0)
		self.assertAlmostEqual(sum(r["amount_due"] for r in rows), 900000.0, places=2)
		self.assertEqual(rows[1]["remarks"], "Installment 2 of 3")
		self.assertEqual([r["due_date"] for r in rows], ["2026-11-05", "2026-12-05", "2027-01-05"])

	def test_rounding(self):
		rows = api.build_booking_values(100, 0, 3, "2026-01-31")["installments"]
		self.assertEqual([r["amount_due"] for r in rows], [33.33, 33.33, 33.34])
		self.assertEqual(rows[1]["due_date"], "2026-02-28")  # month end is clamped

	def test_gst_is_added_before_the_balance(self):
		out = api.build_booking_values(1000000, 200000, 4, "2026-11-05", gst_rate=5)
		self.assertEqual(out["gst_amount"], 50000.0)
		self.assertEqual(out["total_with_gst"], 1050000.0)
		self.assertAlmostEqual(sum(r["amount_due"] for r in out["installments"]), 850000.0, places=2)

	def test_one_time_payment_is_a_single_row(self):
		out = api.build_booking_values(1000000, 100000, 12, "2026-12-01", gst_rate=5, payment_mode="one_time")
		self.assertEqual(len(out["installments"]), 1)  # the months argument is ignored for a one-time payment
		row = out["installments"][0]
		self.assertEqual(row["amount_due"], 950000.0)
		self.assertEqual((row["due_date"], row["installment_no"]), ("2026-12-01", 1))
		self.assertEqual(row["remarks"], "One-time payment of the balance")
		with self.assertRaises(frappe.ValidationError):
			api.build_booking_values(1000, 1000, 1, "2026-12-01", 0, "one_time")  # nothing left to pay

	def test_validation(self):
		bad = [
			(0, 0, 3, "2026-11-05"),
			(1000, 2000, 3, "2026-11-05"),
			(1000, -1, 3, "2026-11-05"),
			(1000, 100, 0, "2026-11-05"),
			(1000, 100, 241, "2026-11-05"),
			(1000, 100, 3, None),
		]
		for args in bad:
			with self.assertRaises(frappe.ValidationError, msg=str(args)):
				api.build_booking_values(*args)


class TestHelpers(unittest.TestCase):
	def test_natural_sort(self):
		names = ["AFF10", "AFF2", "AFF1"]
		self.assertEqual(sorted(names, key=api._natural), ["AFF1", "AFF2", "AFF10"])

	def test_auto_hotspot_two_columns(self):
		boxes = [api._auto_hotspot(i, 8) for i in range(1, 9)]
		self.assertTrue(all(b[0] == 6.2 for b in boxes[:4]) and all(b[0] == 52.5 for b in boxes[4:]))
		self.assertGreater(boxes[0][1], boxes[3][1])  # left column is numbered bottom-to-top
		self.assertLess(boxes[4][1], boxes[7][1])  # right column top-to-bottom
		for b in boxes:
			self.assertTrue(0 <= b[0] and b[0] + b[2] <= 100 and 0 <= b[1] and b[1] + b[3] <= 100)

	def test_image_paths_cannot_escape_their_folders(self):
		import os

		ok = api._local_path("/assets/srconst/brochure/floor_plan_master.webp")
		self.assertTrue(ok and os.path.exists(ok))
		for evil in (
			"/files/../private/files/x.png",
			"/files/../../site_config.json",
			"/private/files/../../site_config.json",
			"/assets/srconst/../../../sites/common_site_config.json",
			"/assets/srconst/../srconst/hooks.py",
			"/files/",
		):
			self.assertIsNone(api._local_path(evil), evil)
		self.assertIsNone(api._local_path("https://example.com/a.png"))
		# and an escaping path is simply left alone by the image optimiser
		self.assertEqual(api.optimized("/files/../../site_config.json.png", 500), "/files/../../site_config.json.png")

	def test_tidy_and_block_letter(self):
		self.assertEqual(api._tidy("  SR Galaxy - SR Galaxy "), "SR Galaxy")
		self.assertEqual(api._tidy("1 - Gulbarga"), "1 - Gulbarga")
		self.assertEqual(api._block_letter("BLOCK A"), "A")
		self.assertEqual(api._block_letter("Tower 2"), "2")
		self.assertEqual(api._block_letter("Pride"), "P")

	def test_parse_hotspots_is_tolerant(self):
		self.assertEqual(api._parse_hotspots(None), {})
		self.assertEqual(api._parse_hotspots("not json"), {})
		self.assertEqual(api._parse_hotspots("[1,2]"), {})
		self.assertEqual(api._parse_hotspots('{"1":[1,2,3,4]}'), {"1": [1, 2, 3, 4]})


@unittest.skipUnless(frappe.db.exists("DocType", "Flat Booking"), "needs the Flat Booking doctype (production data)")
class TestBookingFlow(FrappeTestCase):
	"""Books and cancels a real flat through the real documents. Everything is rolled back after the class.

	The two WhatsApp server scripts are disabled inside the test transaction so nothing is sent.
	"""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		for name in ("SRC - WhatsApp PDF - Flat Booking Submitted", "SRC - WhatsApp PDF - Flat Booking Cancelled"):
			if frappe.db.exists("Server Script", name):
				frappe.db.set_value("Server Script", name, "disabled", 1)
		frappe.cache.delete_value("server_script_map")
		cls.flat = frappe.db.get_value("Flat", {"status": "Empty"}, "name")

	def setUp(self):
		frappe.db.savepoint("showcase_test")  # each test starts from the same untouched data

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback(save_point="showcase_test")

	@classmethod
	def tearDownClass(cls):
		frappe.cache.delete_value("server_script_map")
		super().tearDownClass()

	def _template(self):
		company = frappe.db.get_value("Flat", self.flat, "company")
		return frappe.db.get_value("Sales Taxes and Charges Template", {"company": company, "disabled": 0}, "name")

	def _book(self, **over):
		args = dict(
			flat=self.flat, booking_date=frappe.utils.nowdate(), total_sale_value=4500000, booking_amount=450000,
			installment_months=6, installment_start_date=str(frappe.utils.add_months(frappe.utils.nowdate(), 1)),
			new_customer={"customer_name": "Showcase Test Customer", "mobile_number": "9000000001"},
			taxes_and_charges=self._template(),
		)
		args.update(over)
		return api.book_flat(**args)

	def test_book_then_cancel(self):
		self.assertTrue(self.flat, "needs an Empty flat in the data")
		res = self._book()
		booking = frappe.get_doc("Flat Booking", res["booking"])
		self.assertEqual(booking.docstatus, 1)
		self.assertEqual(len(booking.installments), 6)
		self.assertGreater(booking.gst_rate, 0)
		self.assertAlmostEqual(booking.total_with_gst, 4500000 * (1 + booking.gst_rate / 100), places=2)
		self.assertAlmostEqual(sum(r.amount_due for r in booking.installments), booking.total_with_gst - 450000, places=2)
		self.assertEqual(res["flat_status"], "In Process")
		self.assertEqual(frappe.db.get_value("Flat", self.flat, "booking_ref"), booking.name)
		self.assertTrue(booking.naming_series.startswith("FB-"))

		# a booked flat cannot be booked again
		with self.assertRaises(frappe.ValidationError):
			self._book(new_customer={"customer_name": "Second Customer", "mobile_number": "9000000002"})

		info = api.booking_info(self.flat)["booking"]
		self.assertEqual(info["name"], booking.name)
		self.assertEqual(info["installments"], 6)

		with self.assertRaises(frappe.ValidationError):
			api.cancel_booking(booking.name, "no")  # reason too short
		cancelled = api.cancel_booking(booking.name, "Customer changed plans (test)")
		self.assertEqual(cancelled["flat_status"], "Empty")
		self.assertEqual(frappe.db.get_value("Flat Booking", booking.name, "docstatus"), 2)
		self.assertEqual(frappe.db.get_value("Flat", self.flat, "booking_ref") or "", "")

	def test_one_time_booking(self):
		start = str(frappe.utils.add_months(frappe.utils.nowdate(), 2))
		res = self._book(payment_mode="one_time", installment_months=1, installment_start_date=start)
		b = frappe.get_doc("Flat Booking", res["booking"])
		self.assertEqual((b.docstatus, b.installment_months, len(b.installments)), (1, 1, 1))
		self.assertEqual(str(b.installments[0].due_date), start)
		self.assertAlmostEqual(b.installments[0].amount_due, b.total_with_gst - b.booking_amount, places=2)

	def test_booking_saved_but_a_follow_up_script_fails(self):
		"""ERPNext commits part-way through a submit, so a later script (WhatsApp, PDF) can fail after the booking is saved."""
		from unittest import mock

		real_submit = frappe.model.document.Document.submit

		def submit_then_fail(doc, *a, **k):
			out = real_submit(doc, *a, **k)
			if doc.doctype == "Flat Booking":
				raise OSError("simulated: WhatsApp API unreachable\nsecond line")
			return out

		# in that situation the savepoint is gone, which _rollback absorbs; here keep the (uncommitted) data
		with mock.patch("frappe.model.document.Document.submit", submit_then_fail), mock.patch.object(api, "_rollback"):
			res = self._book()
		self.assertTrue(res["success"])
		self.assertEqual(res["warning"], "simulated: WhatsApp API unreachable")  # first line only
		self.assertEqual(res["flat_status"], "In Process")
		self.assertEqual(frappe.db.get_value("Flat Booking", res["booking"], "docstatus"), 1)

	def test_missing_pdf_tool_gets_a_plain_message(self):
		self.assertIn("wkhtmltopdf is not installed", api._short(OSError('No wkhtmltopdf executable found: "b\'\'"')))

	def test_failure_before_anything_is_saved_still_raises(self):
		from unittest import mock

		with mock.patch("frappe.model.document.Document.submit", side_effect=OSError("boom")):
			with self.assertRaises(OSError):
				self._book()
		self.assertEqual(frappe.db.get_value("Flat", self.flat, "status"), "Empty")

	def test_gst_template_is_required(self):
		with self.assertRaises(frappe.ValidationError):
			self._book(taxes_and_charges=None)
		with self.assertRaises(frappe.ValidationError):
			api.preview_schedule(4500000, 450000, 6, "2026-12-01", None)
		out = api.preview_schedule(4500000, 450000, 6, "2026-12-01", self._template())
		self.assertEqual(len(out["installments"]), 6)

	def test_price_rule(self):
		base = frappe.db.get_value("Flat", self.flat, "base_price")
		# a booking executive who is not Finance Head / MD may only book at the base price
		users = frappe.get_all("Has Role", filters={"role": "SRC Booking Executive", "parenttype": "User"}, pluck="parent")
		ordinary = next(
			(u for u in users if u not in ("Administrator", "Guest") and frappe.db.get_value("User", u, "enabled")
			 and not set(api.PRICE_ROLES) & set(frappe.get_roles(u))), None)
		if ordinary:
			frappe.set_user(ordinary)
			try:
				with self.assertRaises(frappe.PermissionError):
					self._book(total_sale_value=base - 100000)
			finally:
				frappe.set_user("Administrator")
		# Administrator holds every role, so a different price is accepted
		res = self._book(total_sale_value=base - 100000)
		self.assertEqual(frappe.db.get_value("Flat Booking", res["booking"], "total_sale_value"), base - 100000)

	def test_rejects_bad_input_and_leaves_no_trace(self):
		before = frappe.db.count("Flat Booking")
		with self.assertRaises(frappe.ValidationError):
			self._book(booking_amount=99999999)
		with self.assertRaises(frappe.ValidationError):
			self._book(new_customer={"customer_name": "", "mobile_number": "1"})
		with self.assertRaises(frappe.ValidationError):
			self._book(new_customer=None, customer=None)
		self.assertEqual(frappe.db.count("Flat Booking"), before)
		self.assertEqual(frappe.db.get_value("Flat", self.flat, "status"), "Empty")

	def test_user_without_booking_rights_is_refused(self):
		# any enabled user who can read but not create bookings (e.g. a site manager)
		users = frappe.get_all("Has Role", filters={"role": "SRC Site Manager", "parenttype": "User"}, pluck="parent")
		user = next(
			(u for u in users if u not in ("Administrator", "Guest") and frappe.db.get_value("User", u, "enabled")
			 and not frappe.has_permission("Flat Booking", "create", user=u)),
			None,
		)
		if not user:
			self.skipTest("no read-only user available on this site")
		frappe.set_user(user)
		try:
			with self.assertRaises(frappe.PermissionError):
				self._book()
			with self.assertRaises(frappe.PermissionError):
				api.save_plan_hotspots("BLOCK A", "{}")
		finally:
			frappe.set_user("Administrator")


@unittest.skipUnless(frappe.db.exists("DocType", "Building") and frappe.db.exists("DocType", "Flat"), "needs the Building / Flat doctypes (production data)")
class TestSites(FrappeTestCase):
	"""Sites are cost centers; creating a site makes real Buildings and Flats. Rolled back after each test."""

	def setUp(self):
		frappe.set_user("Administrator")
		frappe.db.savepoint("showcase_sites_test")
		self.cc = frappe.db.get_value("Cost Center", {"is_group": 0, "disabled": 0, "cost_center_name": ["like", "%Pride%"]}, "name") \
			or frappe.db.get_value("Cost Center", {"is_group": 0, "disabled": 0}, "name")

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback(save_point="showcase_sites_test")

	def _blocks(self, *names, **over):
		row = dict(floors=2, flats_per_floor=3, flat_type="2BHK", area_sqft=1200, facing="East", base_price=4500000)
		row.update(over)
		return [dict(row, building_name=n) for n in names]

	def test_every_site_cost_center_is_listed_even_without_flats(self):
		ids = {s["id"] for s in api.get_showcase_sites()["data"]}
		self.assertIn(self.cc, ids)
		hidden = api._hidden_cost_centers()
		for cc in frappe.get_all("Cost Center", filters={"is_group": 0, "disabled": 0}, fields=["name", "cost_center_name"]):
			if api._tidy(cc.cost_center_name).lower() in hidden and not frappe.db.exists("Building", {"cost_center": cc.name}):
				self.assertNotIn(cc.name, ids)

	def test_create_site_makes_real_buildings_and_flats(self):
		res = api.create_site_flats(self.cc, "Test Project", self._blocks("ZZ TEST BLOCK X", "ZZ TEST BLOCK Y", floors=2, flats_per_floor=3))
		self.assertEqual(res["flats"], 12)
		b = frappe.get_doc("Building", "ZZ TEST BLOCK X")
		self.assertEqual((b.total_floors, b.total_flats, b.cost_center, b.project), (2, 6, self.cc, "Test Project"))
		flats = frappe.get_all("Flat", filters={"building": "ZZ TEST BLOCK X"}, fields=["flat_number", "floor", "status", "area_sqft", "base_price", "cost_center", "company"])
		self.assertEqual(sorted(f.flat_number for f in flats), ["XFF1", "XFF2", "XFF3", "XGF1", "XGF2", "XGF3"])
		self.assertTrue(all(f.status == "Empty" and f.area_sqft == 1200 and f.base_price == 4500000 and f.cost_center == self.cc for f in flats))
		# the new site now shows up with its flats, ready to book
		site = api.get_showcase_site(self.cc)["data"]
		self.assertFalse(site["empty"])
		self.assertIn("ZZ TEST BLOCK X", [x["name"] for x in site["blocks"]])

	def test_create_site_refuses_bad_input_and_leaves_nothing(self):
		before = frappe.db.count("Flat")
		for blocks, why in [
			(self._blocks("ZZ A", "ZZ A", "ZZ A"), "same name three times"),
			(self._blocks("ZZ B", floors=99), "too many floors"),
			(self._blocks("ZZ C", area_sqft=0), "no area"),
			(self._blocks("ZZ D", base_price=0), "no price"),
			(self._blocks("ZZ E", flat_type="9BHK"), "unknown type"),
			(self._blocks("ZZ F", flats_per_floor=0), "no flats"),
			([], "no blocks"),
		]:
			with self.assertRaises(frappe.ValidationError, msg=why):
				api.create_site_flats(self.cc, "X", blocks)
		with self.assertRaises(frappe.ValidationError):
			api.create_site_flats("Main - SRC", "X", self._blocks("ZZ G")) if frappe.db.get_value("Cost Center", "Main - SRC", "is_group") else api.create_site_flats("SR Construction - SRC", "X", self._blocks("ZZ G"))
		self.assertEqual(frappe.db.count("Flat"), before)
		self.assertFalse(frappe.db.exists("Building", "ZZ B"))

	def test_new_site_creates_its_cost_center(self):
		parent = frappe.db.get_value("Cost Center", {"is_group": 1, "parent_cost_center": ["in", ["", None]], "disabled": 0}, "name") \
			or frappe.db.get_value("Cost Center", {"is_group": 1, "disabled": 0}, "name")
		res = api.create_site_flats(None, "ZZ Project", self._blocks("ZZ NEW BLOCK", floors=1, flats_per_floor=2), new_cost_center={"name": "ZZ New Site", "parent": parent})
		cc = frappe.get_doc("Cost Center", res["site"])
		self.assertEqual((cc.cost_center_name, cc.is_group, cc.parent_cost_center), ("ZZ New Site", 0, parent))
		self.assertEqual(frappe.db.get_value("Building", "ZZ NEW BLOCK", "cost_center"), cc.name)
		site = api.get_showcase_site(cc.name)["data"]
		self.assertEqual((site["name"], len(site["blocks"])), ("ZZ Project", 1))
		with self.assertRaises(frappe.ValidationError):  # the same site name twice
			api.create_site_flats(None, "ZZ P2", self._blocks("ZZ OTHER BLOCK"), new_cost_center={"name": "ZZ New Site", "parent": parent})
		with self.assertRaises(frappe.ValidationError):  # a leaf cost center is not a group
			api.create_site_flats(None, "ZZ P3", self._blocks("ZZ B3"), new_cost_center={"name": "ZZ Another", "parent": cc.name})
		with self.assertRaises(frappe.ValidationError):
			api.create_site_flats(None, "ZZ P4", self._blocks("ZZ B4"), new_cost_center={"name": "  ", "parent": parent})

	def test_a_taken_building_name_gets_the_site_name_appended(self):
		res = api.create_site_flats(self.cc, "ZZ Project", self._blocks("BLOCK A", floors=1, flats_per_floor=2))
		label = api._tidy(frappe.db.get_value("Cost Center", self.cc, "cost_center_name"))
		self.assertEqual(res["buildings"][0]["building"], "BLOCK A - " + label)
		self.assertTrue(res["buildings"][0]["renamed"])
		# flats keep the letter of the name that was typed, and the page shows the plain name again
		flats = frappe.get_all("Flat", filters={"building": res["buildings"][0]["building"]}, pluck="flat_number")
		self.assertTrue(all(f.startswith("A") for f in flats), flats)
		blk = next(b for b in api.get_showcase_site(self.cc)["data"]["blocks"] if b["id"] == res["buildings"][0]["building"])
		self.assertEqual(blk["name"], "BLOCK A")
		# typed twice in one request: the second gets the site name; a third has nowhere to go
		two = api.create_site_flats(self.cc, "X", self._blocks("ZZ DUP", "ZZ DUP", floors=1, flats_per_floor=1))
		self.assertEqual([b["building"] for b in two["buildings"]], ["ZZ DUP", "ZZ DUP - " + label])
		with self.assertRaises(frappe.ValidationError):  # "BLOCK A" and "BLOCK A - <site>" are both taken now
			api.create_site_flats(self.cc, "X", self._blocks("BLOCK A"))

	def test_a_new_brochure_replaces_the_plan_that_was_cut_from_the_old_one(self):
		building = "BLOCK A"
		if not frappe.db.exists("Building", building):
			self.skipTest("needs BLOCK A")
		uploaded = "/assets/srconst/brochure/floor_plan_master.webp"
		doc = api._showcase_doc(building)
		doc.brochure = "/private/files/old-brochure.png"
		doc.floor_plan_image = "/files/showcase_cache/plan-crop-abc123.webp"  # a crop of the old brochure
		doc.plan_hotspots = '{"1":[1,1,10,10]}'
		doc.set("floor_plans", [{"floors": "Ground Floor", "floor_plan_image": "/files/showcase_cache/plan-xyz.webp", "plan_hotspots": "{}"},
								{"floors": "First Floor", "floor_plan_image": uploaded, "plan_hotspots": '{"1":[2,2,10,10]}'}])
		doc.save(ignore_permissions=True)
		api.save_building_media(building, brochure="/private/files/new-brochure.png")
		doc = api._showcase_doc(building)
		self.assertEqual(doc.brochure, "/private/files/new-brochure.png")
		self.assertFalse(doc.floor_plan_image)  # derived plan gone, so the new brochure is the plan again
		self.assertFalse(doc.plan_hotspots)  # the mapping was drawn on the old picture
		self.assertEqual([(r.floors, r.floor_plan_image) for r in doc.floor_plans], [("First Floor", uploaded)])  # an uploaded plan survives
		# the same brochure again changes nothing
		doc.floor_plan_image = "/files/showcase_cache/plan-crop-new.webp"
		doc.save(ignore_permissions=True)
		api.save_building_media(building, brochure="/private/files/new-brochure.png")
		self.assertEqual(api._showcase_doc(building).floor_plan_image, "/files/showcase_cache/plan-crop-new.webp")

	def test_open_pages_are_told_when_the_inventory_changes(self):
		from unittest import mock

		def events(fn):
			frappe.local.flags.pop("showcase_notified", None)
			with mock.patch("frappe.publish_realtime") as pub:
				fn()
			return [c for c in pub.call_args_list if c.args and c.args[0] == "showcase_inventory_changed"]

		# many flats inserted in one request -> one event for the site, sent after the commit
		made = events(lambda: api.create_site_flats(self.cc, "ZZ Sync", self._blocks("ZZ SYNC BLOCK", floors=2, flats_per_floor=3)))
		self.assertEqual(len(made), 1)
		self.assertEqual(made[0].args[1]["site"], self.cc)
		self.assertTrue(made[0].kwargs.get("after_commit"))
		# a flat saved from the desk
		flat = frappe.db.get_value("Flat", {"building": "ZZ SYNC BLOCK"}, "name")
		changed = events(lambda: frappe.get_doc("Flat", flat).save(ignore_permissions=True))
		self.assertEqual([c.args[1]["site"] for c in changed], [self.cc])
		# a booking / cancellation changes the flat's status without saving the flat
		from srconst import showcase_sync

		booked = events(lambda: showcase_sync.booking_changed(frappe._dict(flat=flat)))
		self.assertEqual([c.args[1]["site"] for c in booked], [self.cc])
		# a flat that does not exist, or a missing building, is ignored quietly
		self.assertEqual(events(lambda: showcase_sync.booking_changed(frappe._dict(flat=None))), [])
		self.assertEqual(events(lambda: showcase_sync._notify("no such building")), [])

	def _flat(self, building, floor, number, **over):
		from srconst.showcase_api import FLOOR_SERIES

		cc = frappe.db.get_value("Building", building, ["company", "cost_center"], as_dict=True)
		d = {"doctype": "Flat", "naming_series": FLOOR_SERIES[floor], "flat_number": number, "building": building, "floor": floor, "status": "Empty",
			 "company": cc.company, "cost_center": cc.cost_center, "area_sqft": 1000, "base_price": 1000000}
		d.update(over)
		return frappe.get_doc(d).insert(ignore_permissions=True)

	def test_flat_form_has_the_showcase_section_and_it_is_safe_to_repeat(self):
		from srconst import flat_showcase as fs

		self.assertTrue(fs.has_fields())
		before = frappe.db.count("Custom Field", {"dt": "Flat"})
		fs.ensure_fields()
		fs.ensure_fields()
		self.assertEqual(frappe.db.count("Custom Field", {"dt": "Flat"}), before)
		for f in ("showcase_plan_position", "showcase_inside_image", "showcase_description", "showcase_highlights", "showcase_photos"):
			self.assertTrue(frappe.get_meta("Flat").has_field(f), f)

	def test_plan_positions_are_stable_and_unique_per_floor(self):
		api.create_site_flats(self.cc, "ZZ Pos", self._blocks("ZZ POS", floors=2, flats_per_floor=3))
		pos = lambda floor: {f.flat_number: f.showcase_plan_position for f in frappe.get_all("Flat", filters={"building": "ZZ POS", "floor": floor}, fields=["flat_number", "showcase_plan_position"])}
		self.assertEqual(sorted(pos("Ground Floor").values()), [1, 2, 3])
		self.assertEqual(sorted(pos("First Floor").values()), [1, 2, 3])  # numbering restarts on every floor

		# a flat added from the desk without a position takes the next free one on its floor
		new = self._flat("ZZ POS", "Ground Floor", "XGF9")
		self.assertEqual(new.showcase_plan_position, 4)
		# a freed number is reused before a new one is made
		frappe.delete_doc("Flat", frappe.db.get_value("Flat", {"building": "ZZ POS", "floor": "Ground Floor", "showcase_plan_position": 2}, "name"), ignore_permissions=True, force=True)
		self.assertEqual(self._flat("ZZ POS", "Ground Floor", "XGF8").showcase_plan_position, 2)
		# two flats cannot share a box on one floor, but different floors can
		with self.assertRaises(frappe.ValidationError):
			self._flat("ZZ POS", "Ground Floor", "XGF7", showcase_plan_position=1)
		self.assertEqual(self._flat("ZZ POS", "Second Floor", "XSF1", showcase_plan_position=1).showcase_plan_position, 1)
		clash = frappe.get_doc("Flat", new.name)
		clash.showcase_plan_position = 1
		with self.assertRaises(frappe.ValidationError):
			clash.save(ignore_permissions=True)

	def test_the_page_follows_the_positions_and_the_flat_form_fields(self):
		api.create_site_flats(self.cc, "ZZ Fields", self._blocks("ZZ FIELDS", floors=1, flats_per_floor=3))
		first, second, third = [frappe.get_doc("Flat", n) for n in frappe.get_all("Flat", filters={"building": "ZZ FIELDS"}, order_by="flat_number asc", pluck="name")]
		# swap the order of the first two boxes in the desk: the page follows, nothing else moves
		first.showcase_plan_position = 9  # a swap needs a spare number in between, as two flats cannot share a box
		first.save(ignore_permissions=True)
		second.showcase_plan_position = 1
		second.save(ignore_permissions=True)
		first.showcase_plan_position = 2
		first.save(ignore_permissions=True)
		inside = "/assets/srconst/brochure/floor_plan_master.webp"
		photo = "/assets/srconst/brochure/floor_plan_preview.jpg"
		third.showcase_inside_image = inside
		third.showcase_description = "Corner flat with two balconies"
		third.showcase_highlights = "Vastu compliant\n\n  East facing  \n"
		third.append("showcase_photos", {"image": photo, "caption": "Living room"})
		third.save(ignore_permissions=True)

		blk = next(b for b in api.get_showcase_site(self.cc)["data"]["blocks"] if b["id"] == "ZZ FIELDS")
		units = blk["levels"][0]["units"]
		self.assertEqual([(u["name"], u["unitIndex"]) for u in units], [(second.flat_number, 1), (first.flat_number, 2), (third.flat_number, 3)])
		u = units[2]
		self.assertTrue(u["render3d"] and u["thumb"])  # the image set on the flat is its 3D view
		self.assertEqual(u["description"], "Corner flat with two balconies")
		self.assertEqual(u["features"], ["Vastu compliant", "East facing"])
		self.assertEqual([(p["caption"], bool(p["src"]), bool(p["thumb"])) for p in u["photos"]], [("Living room", True, True)])
		self.assertEqual(units[0]["photos"], [])

	def test_positions_are_filled_in_flat_number_order_for_existing_flats(self):
		from srconst import flat_showcase as fs

		api.create_site_flats(self.cc, "ZZ Fill", self._blocks("ZZ FILL", floors=1, flats_per_floor=4))
		names = frappe.get_all("Flat", filters={"building": "ZZ FILL"}, order_by="flat_number asc", pluck="name")
		for n in names:
			frappe.db.set_value("Flat", n, "showcase_plan_position", 0)
		frappe.db.set_value("Flat", names[2], "showcase_plan_position", 1)  # one flat already has a box
		fs.backfill_positions()
		got = {f.flat_number: f.showcase_plan_position for f in frappe.get_all("Flat", filters={"building": "ZZ FILL"}, fields=["flat_number", "showcase_plan_position"])}
		flat_numbers = [frappe.db.get_value("Flat", n, "flat_number") for n in names]
		self.assertEqual(got[flat_numbers[2]], 1)  # an existing position is never changed
		self.assertEqual(sorted(got.values()), [1, 2, 3, 4])
		self.assertEqual([got[flat_numbers[i]] for i in (0, 1, 3)], [2, 3, 4])
		self.assertEqual(fs.backfill_positions(), 0)  # and running it again changes nothing

	def test_only_managers_can_create_sites(self):
		users = frappe.get_all("Has Role", filters={"role": "SRC Booking Executive", "parenttype": "User"}, pluck="parent")
		ordinary = next((u for u in users if u not in ("Administrator", "Guest") and frappe.db.get_value("User", u, "enabled")
			and not set(api.CREATE_SITE_ROLES) & set(frappe.get_roles(u))), None)
		if not ordinary:
			self.skipTest("no user without System Manager / SRC MD on this site")
		frappe.set_user(ordinary)
		with self.assertRaises(frappe.PermissionError):
			api.create_site_flats(self.cc, "X", self._blocks("ZZ H"))
		with self.assertRaises(frappe.PermissionError):
			api.site_options()

	def test_each_floor_can_have_its_own_plan_and_mapping(self):
		building = "BLOCK A"
		if not frappe.db.exists("Building", building):
			self.skipTest("needs BLOCK A")
		site = frappe.db.get_value("Building", building, "cost_center")
		plan = "/assets/srconst/brochure/floor_plan_master.webp"
		other = "/assets/srconst/brochure/floor_plan_preview.jpg"
		floors = sorted(api._floors_with_flats(building))
		self.assertGreaterEqual(len(floors), 3)
		ground, first = "Ground Floor", "First Floor"

		def level(name):
			blk = next(b for b in api.get_showcase_site(site)["data"]["blocks"] if b["id"] == building)
			return next(l for l in blk["levels"] if l["label"] == name)

		# one plan + one mapping for every floor
		api.save_building_media(building, floor_plan_image=plan)
		api.save_plan_hotspots(building, {"1": [10, 10, 30, 20], "2": [50, 10, 30, 20]})
		self.assertEqual(level(ground)["units"][0]["hotspot"], [10.0, 10.0, 30.0, 20.0])
		self.assertEqual(level(first)["units"][0]["hotspot"], [10.0, 10.0, 30.0, 20.0])
		self.assertTrue(level(first)["mapped"])

		# the ground floor is laid out differently: map it on its own
		api.save_plan_hotspots(building, {"1": [60, 60, 30, 20], "2": [5, 60, 30, 20]}, floors=[ground])
		self.assertEqual(level(ground)["units"][0]["hotspot"], [60.0, 60.0, 30.0, 20.0])
		self.assertEqual(level(first)["units"][0]["hotspot"], [10.0, 10.0, 30.0, 20.0])  # the others keep the shared mapping
		self.assertNotEqual(level(ground)["units"][0]["render3d"], level(first)["units"][0]["render3d"])  # its own flat views

		# the first floor gets a different plan image altogether; its mapping starts empty
		api.save_building_media(building, floor_plan_image=other, floors=[first])
		self.assertNotEqual(level(first)["floorplate"], level(ground)["floorplate"])
		self.assertFalse(level(first)["mapped"])
		self.assertEqual(level(ground)["units"][0]["hotspot"], [60.0, 60.0, 30.0, 20.0])

		# mapping every floor again folds everything back into the default plan
		api.save_plan_hotspots(building, {"1": [1, 1, 20, 20], "2": [30, 1, 20, 20]})
		self.assertEqual(frappe.db.count("Building Showcase Floor", {"parent": building}), 0)
		self.assertEqual(level(first)["units"][0]["hotspot"], [1.0, 1.0, 20.0, 20.0])
