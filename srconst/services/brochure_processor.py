import os
import re
import frappe
from PIL import Image

def process_and_create_site(
    site_name,
    location="Prime Waterfront District",
    developer="SR Construction & Infrastructure",
    brochure_path=None,
    total_towers=2,
    floors_per_tower=14,
    units_per_floor=8,
    tower_names=None
):
    """
    Ingests any brochure PDF or floor plan image, processes it into 3D assets,
    and dynamically builds the entire Property Site, Towers, Floors, and Flats in Frappe DB.
    """
    site_slug = re.sub(r'[^a-zA-Z0-9_]', '_', site_name.lower().strip())
    public_dir = frappe.get_app_path("srconst", "public", "brochure", "sites", site_slug)
    os.makedirs(public_dir, exist_ok=True)
    units_dir = os.path.join(public_dir, "units")
    os.makedirs(units_dir, exist_ok=True)

    master_plan_rel = f"/assets/srconst/brochure/sites/{site_slug}/floor_plan.webp"
    master_plan_dest = os.path.join(public_dir, "floor_plan.webp")

    extracted_img = None

    # Step 1: Extract Floor Plan from PDF or Image
    if brochure_path and os.path.exists(brochure_path):
        if brochure_path.lower().endswith(".pdf"):
            try:
                import pypdf
                reader = pypdf.PdfReader(brochure_path)
                for page in reader.pages:
                    for _, img in page.images.items():
                        extracted_img = img.image.convert("RGB")
                        break
                    if extracted_img:
                        break
            except Exception as e:
                frappe.log_error(f"PDF extraction error: {e}")
        else:
            try:
                extracted_img = Image.open(brochure_path).convert("RGB")
            except Exception as e:
                frappe.log_error(f"Image load error: {e}")

    # Fallback to master brochure if no file provided
    if not extracted_img:
        fallback_path = frappe.get_app_path("srconst", "public", "brochure", "floor_plan_master.webp")
        if os.path.exists(fallback_path):
            extracted_img = Image.open(fallback_path).convert("RGB")
        else:
            fallback_png = frappe.get_app_path("srconst", "public", "brochure", "floor_plan_master.png")
            extracted_img = Image.open(fallback_png).convert("RGB")

    # Save floor plan
    extracted_img.save(master_plan_dest, "WEBP", quality=90)
    w, h = extracted_img.size

    # Step 2: Auto-crop flat units based on units_per_floor
    unit_renders = {}
    if units_per_floor == 4:
        # 4 Quadrants: NW, NE, SW, SE
        quadrants = [
            (1, (0, int(h * 0.48), int(w * 0.48), h)),               # SW
            (2, (0, 0, int(w * 0.48), int(h * 0.48))),               # NW
            (3, (int(w * 0.52), 0, w, int(h * 0.48))),               # NE
            (4, (int(w * 0.52), int(h * 0.48), w, h))                # SE
        ]
        for uidx, box in quadrants:
            crop = extracted_img.crop(box)
            u_path = os.path.join(units_dir, f"flat_{uidx}.webp")
            crop.save(u_path, "WEBP", quality=88)
            unit_renders[uidx] = f"/assets/srconst/brochure/sites/{site_slug}/units/flat_{uidx}.webp"
    else:
        # 8-Unit Layout (Flats 1-8)
        # 4 on Left Wing, 4 on Right Wing
        wing_w = int(w * 0.48)
        right_x = int(w * 0.52)
        step_h = int(h / 4)
        
        cuts = [
            (4, (0, 0, wing_w, step_h)),
            (3, (0, step_h, wing_w, step_h * 2)),
            (2, (0, step_h * 2, wing_w, step_h * 3)),
            (1, (0, step_h * 3, wing_w, h)),
            (5, (right_x, 0, w, step_h)),
            (6, (right_x, step_h, w, step_h * 2)),
            (7, (right_x, step_h * 2, w, step_h * 3)),
            (8, (right_x, step_h * 3, w, h))
        ]
        for uidx, box in cuts:
            crop = extracted_img.crop(box)
            u_path = os.path.join(units_dir, f"flat_{uidx}.webp")
            crop.save(u_path, "WEBP", quality=88)
            unit_renders[uidx] = f"/assets/srconst/brochure/sites/{site_slug}/units/flat_{uidx}.webp"

    # Step 3: Insert / Update Property Site in Frappe DB
    site_doc = None
    if frappe.db.exists("Property Site", site_name):
        site_doc = frappe.get_doc("Property Site", site_name)
    else:
        site_doc = frappe.new_doc("Property Site")
        site_doc.site_name = site_name

    site_doc.location = location
    site_doc.developer = developer
    site_doc.master_plan_image = master_plan_rel
    site_doc.total_blocks = total_towers
    site_doc.status = "Under Construction"
    site_doc.save(ignore_permissions=True)

    # Step 4: Create Towers / Blocks
    tower_colors = ["#38bdf8", "#34d399", "#fbbf24", "#f43f5e", "#a855f7", "#06b6d4"]
    towers_meta = []
    
    if not tower_names:
        tower_names = [f"Tower {chr(65 + i)}" for i in range(total_towers)]

    # Clean existing blocks for this site to rebuild cleanly
    existing_blocks = frappe.get_all("Property Block", filters={"site": site_doc.name}, pluck="name")
    for eb in existing_blocks:
        # Delete flats under this block
        frappe.db.delete("Property Flat", {"block": eb})
        frappe.db.delete("Property Block", {"name": eb})

    for idx, t_name in enumerate(tower_names):
        prefix = chr(65 + idx)
        color = tower_colors[idx % len(tower_colors)]
        pos_x = (idx - (total_towers - 1) / 2) * 18
        pos_z = 0 if idx % 2 == 0 else -4

        block_doc = frappe.new_doc("Property Block")
        block_doc.block_name = t_name
        block_doc.block_prefix = prefix
        block_doc.site = site_doc.name
        block_doc.total_floors = floors_per_tower
        block_doc.units_per_floor = units_per_floor
        block_doc.pos_x = pos_x
        block_doc.pos_z = pos_z
        block_doc.tower_theme = color
        block_doc.save(ignore_permissions=True)

        # Step 5: Create Flats
        flats_list = []
        for fl in range(1, floors_per_tower + 1):
            floor_rise = (fl - 1) * 45000
            for u in range(1, units_per_floor + 1):
                flat_no = f"{prefix}-{fl}{u:02d}"
                status_hash = (fl * 7 + u * 11 + idx * 3) % 10
                status = "Available" if status_hash < 5 else ("In Process" if status_hash < 8 else "Sold")
                
                area = 1450 + (u * 40)
                carpet = int(area * 0.78)
                base_val = 8500000 + (u * 300000)

                facing = "East" if u in [5, 6, 7, 8] else "West"
                flat_type = "4BHK Penthouse" if u in [4, 5] else ("3BHK Luxury" if u in [2, 3, 6, 7] else "3BHK Royal")

                render_url = unit_renders.get(u, f"/assets/srconst/brochure/units/flat_{u}.webp")

                flat_doc = frappe.new_doc("Property Flat")
                flat_doc.flat_number = flat_no
                flat_doc.block = block_doc.name
                flat_doc.site = site_doc.name
                flat_doc.floor_number = fl
                flat_doc.unit_index = u
                flat_doc.status = status
                flat_doc.flat_type = flat_type
                flat_doc.facing = facing
                flat_doc.carpet_area = carpet
                flat_doc.super_builtup_area = area
                flat_doc.base_price = base_val + floor_rise
                flat_doc.inside_3d_render = render_url
                flat_doc.living_dining_dim = "21'6\" x 10'0\""
                flat_doc.master_bedroom_dim = "12'0\" x 10'0\""
                flat_doc.bedroom2_dim = "10'0\" x 10'0\""
                flat_doc.kitchen_dim = "9'6\" x 10'0\""
                flat_doc.balcony_dim = "8'0\" x 10'0\""
                flat_doc.utility_dim = "5'0\" x 11'0\""
                flat_doc.save(ignore_permissions=True)

                flats_list.append({
                    "name": flat_no,
                    "unitIndex": u,
                    "floor": f"Floor {fl:02d}",
                    "floorNumber": fl,
                    "type": flat_type,
                    "facing": facing,
                    "area": area,
                    "carpetArea": carpet,
                    "price": base_val + floor_rise,
                    "status": status,
                    "inside3dRender": render_url,
                    "dims": {
                        "livingDining": "21'6\" x 10'0\"",
                        "masterBedroom": "12'0\" x 10'0\"",
                        "bedroom2": "10'0\" x 10'0\"",
                        "kitchen": "9'6\" x 10'0\"",
                        "balcony": "8'0\" x 10'0\"",
                        "utility": "5'0\" x 11'0\""
                    },
                    "features": ["Vastu Compliant", "Panoramic View", "Double Glazed Balcony", "Smart Access"]
                })

        towers_meta.append({
            "name": t_name,
            "prefix": prefix,
            "totalFloors": floors_per_tower,
            "unitsPerFloor": units_per_floor,
            "posX": pos_x,
            "posZ": pos_z,
            "color": color,
            "flats": flats_list
        })

    frappe.db.commit()

    return {
        "id": site_doc.name,
        "name": site_doc.site_name,
        "location": site_doc.location,
        "developer": site_doc.developer,
        "masterPlan": master_plan_rel,
        "unitsPerFloorDefault": units_per_floor,
        "blocks": towers_meta
    }
