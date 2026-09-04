/**
 * Canonical civic interest categories.
 * These match the `category` field values used in Problem submissions.
 * Used for the Citizen profile "Areas of Concern" selector.
 */

export const CIVIC_INTEREST_CATEGORIES = [
  'Water & Sanitation',
  'Roads & Transport',
  'Education',
  'Healthcare',
  'Agriculture',
  'Environment',
  'Electricity',
  'Public Safety',
  'Waste Management',
  'Digital Services',
  'Housing',
  'Employment',
  'Women & Child Welfare',
  'Senior Citizens',
  'Other',
] as const;

export type CivicInterestCategory = typeof CIVIC_INTEREST_CATEGORIES[number];

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिंदी (Hindi)' },
  { value: 'bn', label: 'বাংলা (Bengali)' },
  { value: 'ta', label: 'தமிழ் (Tamil)' },
  { value: 'te', label: 'తెలుగు (Telugu)' },
  { value: 'mr', label: 'मराठी (Marathi)' },
  { value: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { value: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { value: 'ml', label: 'മലയാളം (Malayalam)' },
  { value: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
] as const;
