"""Categorization prompt templates and version constants."""

CATEGORIZATION_PROMPT_VERSION = "v1"

CATEGORIZATION_GUIDELINES = """When selecting a category:
- Prefer specific engineering domains (e.g. 'Water & Sanitation' over 'Environment' when dealing with drinking water or sewage).
- Use 'Smart Infrastructure & Roads' for civic physical transport, footpaths, and street lighting.
- Use 'Clean Energy & Solar' for power grid, solar installations, and energy access issues.
- Fall back to 'Other' only when the civic issue does not fit standard categories.
"""
