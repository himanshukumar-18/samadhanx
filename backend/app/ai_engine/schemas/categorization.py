"""Canonical category taxonomy and subcategory mapping for SamadhanX."""

from typing import Literal

# Canonical Civic Problem Categories matching SamadhanX system
CANONICAL_CATEGORIES: list[str] = [
    "Water & Sanitation",
    "Clean Energy & Solar",
    "Waste Management",
    "Agriculture & Rural Tech",
    "Healthcare & Medical Devices",
    "Education & Skill Development",
    "Smart Infrastructure & Roads",
    "Disaster Management & Safety",
    "Public Safety",
    "Digital Services",
    "Environment",
    "Housing",
    "Employment",
    "Women & Child Welfare",
    "Senior Citizens",
    "Other",
]

# Canonical subcategories per primary category
SUBCATEGORIES_MAP: dict[str, list[str]] = {
    "Water & Sanitation": [
        "Drinking Water Supply",
        "Drainage & Sewage",
        "Water Contamination",
        "Groundwater Depletion",
        "Public Toilet Sanitation",
        "Other",
    ],
    "Clean Energy & Solar": [
        "Solar Streetlights",
        "Renewable Microgrids",
        "Energy Storage & Efficiency",
        "Power Outages",
        "Other",
    ],
    "Waste Management": [
        "Garbage Dumping",
        "Plastic Waste",
        "E-Waste Disposal",
        "Composting & Organic Waste",
        "Segregation at Source",
        "Other",
    ],
    "Agriculture & Rural Tech": [
        "Crop Pest Management",
        "Irrigation Automation",
        "Post-Harvest Storage",
        "Soil Health",
        "Market Linkage & Pricing",
        "Other",
    ],
    "Healthcare & Medical Devices": [
        "Primary Health Center Access",
        "Maternal & Child Health",
        "Affordable Diagnostics",
        "Medicine Availability",
        "Emergency Response",
        "Other",
    ],
    "Education & Skill Development": [
        "School Infrastructure",
        "Digital Classrooms",
        "Vocational Skill Training",
        "Teacher Shortage",
        "STEM Education",
        "Other",
    ],
    "Smart Infrastructure & Roads": [
        "Potholes & Road Damage",
        "Pedestrian Footpaths",
        "Bridges & Overpasses",
        "Street Lighting",
        "Traffic Congestion",
        "Other",
    ],
    "Disaster Management & Safety": [
        "Flood Warning & Control",
        "Landslide Mitigation",
        "Fire Safety",
        "Cyclone Preparedness",
        "Earthquake Resilience",
        "Other",
    ],
    "Public Safety": [
        "Street Security & Surveillance",
        "Night Lighting in High-Risk Zones",
        "Emergency Hotlines",
        "Women's Safety",
        "Other",
    ],
    "Digital Services": [
        "Citizen E-Governance",
        "Internet Connectivity",
        "Digital Literacy",
        "Cyber Fraud Awareness",
        "Other",
    ],
    "Environment": [
        "Air Quality & Pollution",
        "Deforestation & Tree Cover",
        "River & Lake Cleaning",
        "Noise Pollution",
        "Other",
    ],
    "Housing": [
        "Affordable Shelter",
        "Slum Redevelopment",
        "Building Safety & Compliance",
        "Other",
    ],
    "Employment": [
        "Rural Livelihoods",
        "Youth Apprenticeships",
        "Artisan & Handloom Support",
        "Other",
    ],
    "Women & Child Welfare": [
        "Child Nutrition & Anganwadi",
        "Women Self Help Groups",
        "Sanitary Hygiene Access",
        "Other",
    ],
    "Senior Citizens": [
        "Elder Care Infrastructure",
        "Universal Accessibility & Ramps",
        "Pension Support Assistance",
        "Other",
    ],
    "Other": [
        "Community Amenities",
        "Civic Tech",
        "Other",
    ],
}


def normalize_category(category_name: str | None) -> str:
    """Normalize input category string to closest canonical category."""
    if not category_name:
        return "Other"

    cat_clean = category_name.strip().lower()
    for canonical in CANONICAL_CATEGORIES:
        if canonical.lower() == cat_clean:
            return canonical

    # Heuristic substring matching
    if "water" in cat_clean or "drain" in cat_clean or "sanitat" in cat_clean:
        return "Water & Sanitation"
    if "energy" in cat_clean or "solar" in cat_clean or "electric" in cat_clean:
        return "Clean Energy & Solar"
    if "waste" in cat_clean or "garbage" in cat_clean or "trash" in cat_clean:
        return "Waste Management"
    if "agri" in cat_clean or "farm" in cat_clean or "crop" in cat_clean:
        return "Agriculture & Rural Tech"
    if "health" in cat_clean or "med" in cat_clean or "hospital" in cat_clean:
        return "Healthcare & Medical Devices"
    if "edu" in cat_clean or "school" in cat_clean or "college" in cat_clean or "skill" in cat_clean:
        return "Education & Skill Development"
    if (
        "road" in cat_clean
        or "transport" in cat_clean
        or "traffic" in cat_clean
        or "infra" in cat_clean
        or "pothole" in cat_clean
        or "highway" in cat_clean
        or "bridge" in cat_clean
        or "street" in cat_clean
    ):
        return "Smart Infrastructure & Roads"
    if "disaster" in cat_clean or "flood" in cat_clean:

        return "Disaster Management & Safety"
    if "safety" in cat_clean or "crime" in cat_clean:
        return "Public Safety"
    if "digital" in cat_clean or "tech" in cat_clean:
        return "Digital Services"
    if "environ" in cat_clean or "pollut" in cat_clean:
        return "Environment"

    return "Other"


def normalize_subcategory(category: str, subcategory_name: str | None) -> str:
    """Normalize subcategory against canonical subcategory taxonomy for the given category."""
    valid_subs = SUBCATEGORIES_MAP.get(category, ["Other"])
    if not subcategory_name:
        return "Other"

    sub_clean = subcategory_name.strip().lower()
    for sub in valid_subs:
        if sub.lower() == sub_clean:
            return sub

    for sub in valid_subs:
        if sub_clean in sub.lower() or sub.lower() in sub_clean:
            return sub

    return "Other"
