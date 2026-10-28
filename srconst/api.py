import frappe
import os
import re
import json
from srconst.services.brochure_processor import process_and_create_site

def find_field(doctype, possible_names):
    """Finds matching fieldname in DocType meta."""
    if not frappe.db.exists("DocType", doctype):
        return None
    try:
        meta = frappe.get_meta(doctype)
        field_set = {df.fieldname for df in meta.fields}
        for name in possible_names:
            if name in field_set:
                return name
    except Exception:
        pass
    return None

def parse_flat_numbers(flat_str):
    """Extracts floor number and unit index from flat identifier (e.g. 402 -> Floor 4, Unit 2)."""
    m = re.search(r'(\d+)', str(flat_str))
    if m:
        num = m.group(1)
        if len(num) >= 3:
            return int(num[:-2]), int(num[-2:])
        elif len(num) == 2:
            return int(num[0]), int(num[1])
        elif len(num) == 1:
            return 1, int(num)
    return 1, 1

def load_from_custom_flat_doctypes():
    """
    Loads real estate data from custom ERPNext DocTypes:
    'Building', 'Flat', 'Flat Booking'
    """
    if not frappe.db.exists("DocType", "Flat"):
        return None

    # Detect fieldnames on 'Flat'
    flat_no_f = find_field("Flat", ["flat_number", "flat_no", "unit_number", "unit_no", "flat_name", "unit_name", "flat_id", "title"])
    bldg_f = find_field("Flat", ["building", "building_name", "block", "block_name", "tower", "tower_name", "site", "project"])
    floor_f = find_field("Flat", ["floor_number", "floor_no", "floor", "level", "storey"])
    unit_idx_f = find_field("Flat", ["unit_index", "unit_idx", "unit_no", "index"])
    status_f = find_field("Flat", ["status", "flat_status", "booking_status", "state"])
    type_f = find_field("Flat", ["flat_type", "type", "bhk", "unit_type", "configuration"])
    facing_f = find_field("Flat", ["facing", "direction", "orientation"])
    area_f = find_field("Flat", ["super_builtup_area", "super_built_up_area", "builtup_area", "carpet_area", "area", "total_area", "sqft"])
    carpet_f = find_field("Flat", ["carpet_area", "net_area", "internal_area"])
    price_f = find_field("Flat", ["base_price", "price", "rate", "total_amount", "amount", "unit_price", "cost"])
    render_f = find_field("Flat", ["inside_3d_render", "floor_plan", "image", "render_image"])

    # Query active bookings from Flat Booking if exists
    booked_flats = {}
    if frappe.db.exists("DocType", "Flat Booking"):
        try:
            booking_flat_f = find_field("Flat Booking", ["flat", "flat_number", "flat_no", "unit"]) or "flat"
            booking_status_f = find_field("Flat Booking", ["status", "booking_status"]) or "status"
            bookings = frappe.get_all("Flat Booking", fields=["name", booking_flat_f, booking_status_f])
            for bk in bookings:
                fl_ref = bk.get(booking_flat_f)
                st = bk.get(booking_status_f) or "Booked"
                if fl_ref and st.lower() not in ["cancelled", "refunded"]:
                    booked_flats[fl_ref] = "In Process" if "token" in st.lower() or "hold" in st.lower() or "process" in st.lower() else "Sold"
        except Exception as e:
            frappe.log_error(f"Error querying Flat Booking: {e}")

    # Query all Flats
    flat_fields = ["name"]
    for f in [flat_no_f, bldg_f, floor_f, unit_idx_f, status_f, type_f, facing_f, area_f, carpet_f, price_f, render_f]:
        if f and f not in flat_fields:
            flat_fields.append(f)

    raw_flats = frappe.get_all("Flat", fields=flat_fields)
    if not raw_flats:
        return None

    # Group flats by Building
    building_flats_map = {}
    for rf in raw_flats:
        flat_name = rf.name
        flat_num = rf.get(flat_no_f) if flat_no_f else flat_name
        bldg_name = rf.get(bldg_f) if bldg_f else "Tower Alpha"
        if not bldg_name:
            bldg_name = "Tower Alpha"

        parsed_floor, parsed_unit = parse_flat_numbers(flat_num)
        floor_num = int(rf.get(floor_f)) if (floor_f and rf.get(floor_f) is not None) else parsed_floor
        unit_idx = int(rf.get(unit_idx_f)) if (unit_idx_f and rf.get(unit_idx_f) is not None) else parsed_unit

        # Status resolution
        flat_st = rf.get(status_f) if status_f else None
        if not flat_st:
            flat_st = booked_flats.get(flat_name) or booked_flats.get(flat_num) or "Available"
        else:
            low = str(flat_st).lower()
            if "avail" in low or "vacant" in low or "ready" in low:
                flat_st = "Available"
            elif "token" in low or "hold" in low or "process" in low or "reserve" in low or "pending" in low:
                flat_st = "In Process"
            elif "sold" in low or "booked" in low or "allot" in low or "occup" in low:
                flat_st = "Sold"
            else:
                flat_st = "Available"

        area = int(rf.get(area_f)) if (area_f and rf.get(area_f)) else 1450
        carpet = int(rf.get(carpet_f)) if (carpet_f and rf.get(carpet_f)) else int(area * 0.78)
        price = float(rf.get(price_f)) if (price_f and rf.get(price_f)) else 9500000.0
        ftype = rf.get(type_f) if type_f and rf.get(type_f) else "3BHK Luxury"
        facing = rf.get(facing_f) if facing_f and rf.get(facing_f) else ("East" if unit_idx in [5,6,7,8] else "West")
        render = rf.get(render_f) if render_f and rf.get(render_f) else f"/assets/srconst/brochure/units/flat_{((unit_idx - 1) % 8) + 1}.webp"

        formatted_flat = {
            "name": str(flat_num),
            "docName": flat_name,
            "unitIndex": unit_idx,
            "floor": f"Floor {floor_num:02d}",
            "floorNumber": floor_num,
            "type": ftype,
            "facing": facing,
            "area": area,
            "carpetArea": carpet,
            "price": price,
            "status": flat_st,
            "inside3dRender": render,
            "dims": {
                "livingDining": "21'6\" x 10'0\"",
                "masterBedroom": "12'0\" x 10'0\"",
                "bedroom2": "10'0\" x 10'0\"",
                "kitchen": "9'6\" x 10'0\"",
                "balcony": "8'0\" x 10'0\"",
                "utility": "5'0\" x 11'0\""
            },
            "features": ["Vastu Compliant", "Panoramic View", "Double Glazed Balcony", "Smart Access"]
        }

        if bldg_name not in building_flats_map:
            building_flats_map[bldg_name] = []
        building_flats_map[bldg_name].append(formatted_flat)

    # Build blocks
    blocks = []
    for idx, (b_name, b_flats) in enumerate(building_flats_map.items()):
        max_floor = max([f["floorNumber"] for f in b_flats] or [14])
        total_floors = max(max_floor, 14)
        prefix = b_name[:1].upper() if b_name else chr(65 + idx)
        
        from collections import Counter
        floor_counts = Counter([f["floorNumber"] for f in b_flats])
        units_per_floor = max(floor_counts.values()) if floor_counts else 8

        blocks.append({
            "name": b_name,
            "prefix": prefix,
            "id": b_name,
            "totalFloors": total_floors,
            "unitsPerFloor": max(units_per_floor, 8),
            "posX": (idx - len(building_flats_map) / 2) * 15,
            "posZ": 0,
            "color": "#ff5b29" if idx == 0 else "#f5ff80",
            "elevationRender": "/assets/srconst/brochure/tower_elevation_real.jpg",
            "flats": b_flats
        })

    return [{
        "id": "erpnext_properties",
        "name": "ERPNext Residential Portfolio",
        "location": "Live ERPNext Database",
        "developer": "SR Construction",
        "masterPlan": "/assets/srconst/brochure/floor_plan_master.webp",
        "previewImage": "/assets/srconst/brochure/floor_plan_preview.jpg",
        "unitsPerFloorDefault": 8,
        "description": "Live properties and units loaded directly from ERPNext Custom DocTypes",
        "blocks": blocks
    }]

@frappe.whitelist(allow_guest=True)
def get_site_details(site_id=None):
    """
    Returns full hierarchy of sites, blocks, floors, and flats.
    Seamlessly integrates:
    1. Custom ERPNext DocTypes ('Flat', 'Building', 'Flat Booking')
    2. SR Construction DocTypes ('Property Site', 'Property Block', 'Property Flat')
    3. Multi-site catalog fallback
    """
    res = []

    # Priority 1: Check Custom ERPNext DocTypes ('Flat')
    try:
        custom_sites = load_from_custom_flat_doctypes()
        if custom_sites:
            res.extend(custom_sites)
    except Exception as e:
        frappe.log_error(f"Error loading custom ERPNext flats: {e}")

    # Priority 2: Check Property Site DocTypes
    try:
        if frappe.db.exists("DocType", "Property Site"):
            filters = {}
            if site_id:
                filters["name"] = site_id

            sites = frappe.get_all("Property Site", filters=filters, fields=["name", "site_name", "location", "master_plan_image", "status", "description", "developer"])
            for s in sites:
                blocks = frappe.get_all("Property Block", filters={"site": s.name}, fields=["name", "block_name", "block_prefix", "total_floors", "units_per_floor", "pos_x", "pos_z", "tower_theme", "elevation_render"])
                block_list = []
                for b in blocks:
                    flats = frappe.get_all(
                        "Property Flat",
                        filters={"block": b.name},
                        fields=["name", "flat_number", "unit_index", "floor_number", "flat_type as type", "facing", "carpet_area", "super_builtup_area as area", "base_price as price", "status", "inside_3d_render", "living_dining_dim", "master_bedroom_dim", "bedroom2_dim", "kitchen_dim", "balcony_dim", "utility_dim"]
                    )
                    
                    flats_formatted = []
                    for f in flats:
                        flats_formatted.append({
                            "name": f.flat_number or f.name,
                            "docName": f.name,
                            "unitIndex": f.unit_index or 1,
                            "floor": f"Floor {String_padStart(f.floor_number or 1)}",
                            "floorNumber": f.floor_number or 1,
                            "type": f.type or "3BHK Luxury",
                            "facing": f.facing or "East",
                            "area": f.area or 1450,
                            "carpetArea": f.carpet_area or 1150,
                            "price": f.price or 9500000,
                            "status": f.status or "Available",
                            "inside3dRender": f.inside_3d_render or f"/assets/srconst/brochure/units/flat_{f.unit_index or 1}.webp",
                            "dims": {
                                "livingDining": f.living_dining_dim or "21'6\" x 10'0\"",
                                "masterBedroom": f.master_bedroom_dim or "12'0\" x 10'0\"",
                                "bedroom2": f.bedroom2_dim or "10'0\" x 10'0\"",
                                "kitchen": f.kitchen_dim or "9'6\" x 10'0\"",
                                "balcony": f.balcony_dim or "8'0\" x 10'0\"",
                                "utility": f.utility_dim or "5'0\" x 11'0\""
                            },
                            "features": ["Vastu Compliant", "Panoramic View", "Double Glazed Balcony", "Smart Access"]
                        })

                    # Only add block if it has flats or defined floors
                    if flats_formatted or (b.total_floors and b.total_floors > 0):
                        block_list.append({
                            "name": b.block_name,
                            "prefix": b.block_prefix or "T",
                            "id": b.name,
                            "totalFloors": b.total_floors or 14,
                            "unitsPerFloor": b.units_per_floor or 8,
                            "posX": b.pos_x or 0,
                            "posZ": b.pos_z or 0,
                            "color": b.tower_theme or "#d4af37",
                            "elevationRender": b.elevation_render or "/assets/srconst/brochure/tower_elevation_real.jpg",
                            "flats": flats_formatted
                        })

                # Only add site if it has at least one valid block
                if block_list:
                    units_def = block_list[0]["unitsPerFloor"] if block_list else 8
                    res.append({
                        "id": s.name,
                        "name": s.site_name,
                        "location": s.location or "Prime Waterfront District",
                        "developer": s.developer or "SR Construction",
                        "masterPlan": s.master_plan_image or "/assets/srconst/brochure/floor_plan_master.webp",
                        "previewImage": s.master_plan_image or "/assets/srconst/brochure/floor_plan_preview.jpg",
                        "unitsPerFloorDefault": units_def,
                        "description": s.description or "",
                        "blocks": block_list
                    })
    except Exception as e:
        frappe.log_error(f"Error reading Property Site DocTypes: {e}")

    # Priority 3: Fallback to default catalog if NO sites or empty
    if not res:
        default_sites = get_default_multi_site_data(site_id)
        res = default_sites

    if site_id:
        filtered = [s for s in res if s.get("id") == site_id or s.get("name") == site_id]
        if filtered:
            return {"success": True, "data": filtered}

    return {
        "success": True,
        "data": res
    }

def String_padStart(num):
    return f"{num:02d}"

@frappe.whitelist(allow_guest=True)
def update_flat_status(flat_id, status, customer_name=None, customer_phone=None):
    """
    Updates flat status in database and registers booking/lead across:
    - Custom 'Flat', 'Flat Booking', 'Flat Booking Cancellation'
    - 'Property Flat'
    - 'Lead'
    """
    try:
        updated = False
        
        # 1. Update Custom 'Flat' DocType
        if frappe.db.exists("DocType", "Flat"):
            flat_no_f = find_field("Flat", ["flat_number", "flat_no", "unit_number", "unit_no", "flat_name", "title"])
            status_f = find_field("Flat", ["status", "flat_status", "booking_status"]) or "status"
            
            flat_doc_name = None
            if frappe.db.exists("Flat", flat_id):
                flat_doc_name = flat_id
            elif flat_no_f:
                matches = frappe.get_all("Flat", filters={flat_no_f: flat_id}, fields=["name"], limit=1)
                if matches:
                    flat_doc_name = matches[0].name
                else:
                    clean = flat_id.split("-")[-1].replace("Unit", "").strip()
                    matches = frappe.get_all("Flat", filters={flat_no_f: ["like", f"%{clean}"]}, fields=["name"], limit=1)
                    if matches:
                        flat_doc_name = matches[0].name

            if flat_doc_name:
                frappe.db.set_value("Flat", flat_doc_name, status_f, status)
                frappe.db.commit()
                updated = True

                # If booked / token taken, create Flat Booking record if DocType exists
                if status in ["In Process", "Sold"] and frappe.db.exists("DocType", "Flat Booking"):
                    try:
                        booking_flat_f = find_field("Flat Booking", ["flat", "flat_number", "flat_no", "unit"]) or "flat"
                        booking_cust_f = find_field("Flat Booking", ["customer", "customer_name", "client_name", "lead"])
                        booking_status_f = find_field("Flat Booking", ["status", "booking_status"])
                        
                        b_doc = frappe.new_doc("Flat Booking")
                        b_doc.set(booking_flat_f, flat_doc_name)
                        if booking_cust_f:
                            b_doc.set(booking_cust_f, customer_name or "VIP Client")
                        if booking_status_f:
                            b_doc.set(booking_status_f, "Token Received" if status == "In Process" else "Confirmed")
                        b_doc.insert(ignore_permissions=True)
                        frappe.db.commit()
                    except Exception as be:
                        frappe.log_error(f"Flat Booking creation error: {be}")

        # 2. Update Property Flat DocType
        if frappe.db.exists("DocType", "Property Flat"):
            p_flat_name = None
            if frappe.db.exists("Property Flat", flat_id):
                p_flat_name = flat_id
            else:
                matches = frappe.get_all("Property Flat", filters={"flat_number": flat_id}, fields=["name"], limit=1)
                if matches:
                    p_flat_name = matches[0].name
                else:
                    clean = flat_id.split("-")[-1].replace("Unit", "").strip()
                    matches = frappe.get_all("Property Flat", filters={"flat_number": ["like", f"%{clean}"]}, fields=["name"], limit=1)
                    if matches:
                        p_flat_name = matches[0].name
            if p_flat_name:
                frappe.db.set_value("Property Flat", p_flat_name, "status", status)
                frappe.db.commit()
                updated = True

        # 3. Create Lead if customer details provided
        if customer_name and frappe.db.exists("DocType", "Lead"):
            try:
                lead = frappe.get_doc({
                    "doctype": "Lead",
                    "lead_name": customer_name,
                    "phone": customer_phone or "",
                    "notes": f"Interested in Unit {flat_id} (Status updated to {status})"
                })
                lead.insert(ignore_permissions=True)
                frappe.db.commit()
            except Exception as le:
                frappe.log_error(f"Lead creation error: {le}")

        return {"success": True, "flat_id": flat_id, "status": status, "updated_in_db": updated}
    except Exception as e:
        frappe.log_error(f"Error in update_flat_status: {e}")
        return {"success": False, "error": str(e)}

@frappe.whitelist(allow_guest=True)
def create_site_from_brochure(
    site_name,
    location="Prime Waterfront District",
    developer="SR Construction",
    total_towers=2,
    floors_per_tower=14,
    units_per_floor=8,
    brochure_file_url=None
):
    """
    Whitelisted API to create and ingest a new site from a brochure.
    """
    try:
        total_towers = int(total_towers)
        floors_per_tower = int(floors_per_tower)
        units_per_floor = int(units_per_floor)

        local_brochure_path = None
        if brochure_file_url:
            if brochure_file_url.startswith("/private/"):
                local_brochure_path = frappe.get_site_path("private", brochure_file_url.replace("/private/", ""))
            elif brochure_file_url.startswith("/files/"):
                local_brochure_path = frappe.get_site_path("public", "files", brochure_file_url.replace("/files/", ""))

        result = process_and_create_site(
            site_name=site_name,
            location=location,
            developer=developer,
            brochure_path=local_brochure_path,
            total_towers=total_towers,
            floors_per_tower=floors_per_tower,
            units_per_floor=units_per_floor
        )
        return {"success": True, "site": result}
    except Exception as e:
        frappe.log_error(title="Brochure Creation Error", message=str(e))
        return {"success": False, "error": str(e)}

def get_default_multi_site_data(site_id=None):
    from srconst.mock_sites import ALL_SITES
    if site_id:
        filtered = [s for s in ALL_SITES if s.get("id") == site_id or s.get("name") == site_id]
        if filtered:
            return filtered
    return ALL_SITES
