/** Preset labels stored as `product_categories.name` when chosen from the admin UI. */
export const PRESET_PRODUCT_CATEGORY_NAMES = [
  "Burgers",
  "Pizza",
  "Lasagna",
  "Traditional Foods",
  "Desserts",
  "Beverages",
  "Salads",
  "Seafood",
  "Sandwiches",
] as const;

export type PresetProductCategoryName =
  (typeof PRESET_PRODUCT_CATEGORY_NAMES)[number];
