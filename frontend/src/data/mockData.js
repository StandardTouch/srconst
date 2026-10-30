// Dynamic unit template catalog mapped directly to the brochure blueprint
export const unitCatalog = [
  { unitIndex: 1, type: "3BHK Royal", facing: "South-West", area: 1450, carpetArea: 1120, basePrice: 9250000, render: "/assets/srconst/brochure/units/flat_1.webp", dims: { livingDining: "20'0\" x 10'0\"", masterBedroom: "12'0\" x 10'0\"", bedroom2: "10'0\" x 10'0\"", kitchen: "8'0\" x 10'0\"", balcony: "8'0\" x 10'0\"", utility: "4'0\" x 11'0\"" }, features: ["South-West Breeze", "Dual Balconies", "Vastu Compliant"] },
  { unitIndex: 2, type: "3BHK Luxury", facing: "West", area: 1520, carpetArea: 1180, basePrice: 9680000, render: "/assets/srconst/brochure/units/flat_2.webp", dims: { livingDining: "21'6\" x 10'0\"", masterBedroom: "10'0\" x 10'6\"", bedroom2: "10'0\" x 10'6\"", kitchen: "9'6\" x 10'6\"", balcony: "8'0\" x 10'0\"", utility: "5'0\" x 11'0\"" }, features: ["Spacious Master En-suite", "Sunset Balcony", "Granite Kitchen"] },
  { unitIndex: 3, type: "3BHK Luxury", facing: "West", area: 1520, carpetArea: 1180, basePrice: 9720000, render: "/assets/srconst/brochure/units/flat_3.webp", dims: { livingDining: "21'6\" x 10'0\"", masterBedroom: "10'0\" x 10'6\"", bedroom2: "10'0\" x 10'6\"", kitchen: "9'6\" x 10'6\"", balcony: "8'0\" x 10'0\"", utility: "5'0\" x 11'0\"" }, features: ["Central Garden View", "Cross Ventilation", "Italian Marble Provision"] },
  { unitIndex: 4, type: "3BHK Executive", facing: "North-West", area: 1580, carpetArea: 1230, basePrice: 10250000, render: "/assets/srconst/brochure/units/flat_4.webp", dims: { livingDining: "21'6\" x 10'0\"", masterBedroom: "10'0\" x 10'6\"", bedroom2: "10'0\" x 10'6\"", kitchen: "9'6\" x 10'6\"", balcony: "8'0\" x 10'0\"", utility: "5'0\" x 11'0\"" }, features: ["Corner Privacy", "Double Glazed Windows", "Expansive Living Hall"] },
  { unitIndex: 5, type: "3BHK Executive", facing: "North-East", area: 1650, carpetArea: 1290, basePrice: 10850000, render: "/assets/srconst/brochure/units/flat_5.webp", dims: { livingDining: "21'6\" x 10'0\"", masterBedroom: "10'0\" x 10'6\"", bedroom2: "10'0\" x 10'6\"", kitchen: "12'0\" x 12'0\"", balcony: "8'0\" x 10'0\"", utility: "10'0\" x 5'0\"" }, features: ["Morning Sun & East Light", "Chef Kitchen 12x12", "King Size Master Suite"] },
  { unitIndex: 6, type: "3BHK Grand", facing: "East", area: 1590, carpetArea: 1240, basePrice: 10400000, render: "/assets/srconst/brochure/units/flat_6.webp", dims: { livingDining: "21'6\" x 10'0\"", masterBedroom: "12'6\" x 10'0\"", bedroom2: "10'0\" x 10'6\"", kitchen: "10'6\" x 9'0\"", balcony: "8'0\" x 10'0\"", utility: "10'0\" x 5'0\"" }, features: ["East Facing Balcony", "Walk-in Wardrobe Space", "Sliding Soundproof Doors"] },
  { unitIndex: 7, type: "3BHK Grand", facing: "East", area: 1620, carpetArea: 1260, basePrice: 10600000, render: "/assets/srconst/brochure/units/flat_7.webp", dims: { livingDining: "21'6\" x 10'0\"", masterBedroom: "12'6\" x 11'0\"", bedroom2: "10'0\" x 10'6\"", kitchen: "12'0\" x 12'0\"", balcony: "8'0\" x 10'0\"", utility: "10'0\" x 5'0\"" }, features: ["Panoramic Sunrise View", "Smart Home Automation", "Dedicated Utility Room"] },
  { unitIndex: 8, type: "3BHK Royal", facing: "South-East", area: 1480, carpetArea: 1150, basePrice: 9500000, render: "/assets/srconst/brochure/units/flat_8.webp", dims: { livingDining: "21'6\" x 10'0\"", masterBedroom: "12'0\" x 10'0\"", bedroom2: "10'0\" x 10'6\"", kitchen: "7'6\" x 10'0\"", balcony: "8'0\" x 10'0\"", utility: "8'0\" x 4'0\"" }, features: ["South-East Corner Breeze", "Private Corridor Approach", "High Ceilings 10'2\""] }
];

function buildTower(prefix, name, floors, posX, posZ, color, statusSeed) {
  const flats = [];
  for (let floorNum = 1; floorNum <= floors; floorNum++) {
    const floorLabel = `Floor ${String(floorNum).padStart(2, '0')}`;
    const floorRise = (floorNum - 1) * 45000;

    unitCatalog.forEach((tmpl) => {
      const unitIndex = tmpl.unitIndex;
      const flatName = `${prefix}-${floorNum}${String(unitIndex).padStart(2, '0')}`;
      const statusHash = (floorNum * 7 + unitIndex * 11 + statusSeed) % 10;
      let status = "Available";
      if (statusHash >= 5 && statusHash < 8) status = "In Process";
      else if (statusHash >= 8) status = "Sold";

      flats.push({
        name: flatName,
        unitIndex: unitIndex,
        floor: floorLabel,
        floorNumber: floorNum,
        type: tmpl.type,
        facing: tmpl.facing,
        area: tmpl.area,
        carpetArea: tmpl.carpetArea,
        price: tmpl.basePrice + floorRise,
        status: status,
        inside3dRender: tmpl.render,
        dims: tmpl.dims,
        features: tmpl.features,
        view360: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1920&q=80"
      });
    });
  }

  return {
    name,
    prefix,
    totalFloors: floors,
    unitsPerFloor: 8,
    posX,
    posZ,
    color,
    flats
  };
}

export const mockData = [
  {
    id: "site_imperial",
    name: "The Grand Imperial Estates",
    tagline: "Signature Luxury High-Rise Residences",
    location: "Financial District, High-Tech City",
    developer: "SR Construction & Infrastructure",
    masterPlan: "/assets/srconst/brochure/floor_plan_master.webp",
    previewImage: "/assets/srconst/brochure/floor_plan_preview.jpg",
    unitsPerFloorDefault: 8,
    blocks: [
      buildTower("A", "Tower Alpha (Sapphire)", 14, -13, 0, "#38bdf8", 1),
      buildTower("B", "Tower Beta (Emerald)", 16, 0, -6, "#34d399", 4),
      buildTower("C", "Tower Gamma (Diamond)", 14, 13, 1, "#fbbf24", 7)
    ]
  },
  {
    id: "site_azure",
    name: "Azure Coast Waterfront Residences",
    tagline: "Bespoke Ocean-Facing Sky Villas",
    location: "Marine Promenade, Palm Beach Road",
    developer: "SR Construction Luxury Collection",
    masterPlan: "/assets/srconst/brochure/floor_plan_master.webp",
    previewImage: "/assets/srconst/brochure/floor_plan_preview.jpg",
    unitsPerFloorDefault: 8,
    blocks: [
      buildTower("W", "West Marina Tower", 12, -9, 0, "#06b6d4", 2),
      buildTower("E", "East Horizon Tower", 14, 9, -2, "#8b5cf6", 6)
    ]
  },
  {
    id: "site_skyline",
    name: "Skyline Urban Tech Park",
    tagline: "Next-Gen Smart Living Residences",
    location: "Cyber Gateway Sector 5",
    developer: "SR Construction Smart Homes",
    masterPlan: "/assets/srconst/brochure/floor_plan_master.webp",
    previewImage: "/assets/srconst/brochure/floor_plan_preview.jpg",
    unitsPerFloorDefault: 8,
    blocks: [
      buildTower("T1", "Tower 1 (Cyber Hub)", 16, -16, -2, "#f43f5e", 3),
      buildTower("T2", "Tower 2 (Innovation)", 18, 6, -5, 3, "#ec4899", 5),
      buildTower("T3", "Tower 3 (Pinnacle)", 20, 6, 6, -3, "#a855f7", 8),
      buildTower("T4", "Tower 4 (Zenith)", 16, 6, 17, 2, "#6366f1", 2)
    ]
  }
];
