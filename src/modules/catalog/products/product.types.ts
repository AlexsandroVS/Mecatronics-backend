export const productKindValues = ["MACHINE", "PART", "CONSUMABLE", "ACCESSORY"] as const;
export type ProductKind = (typeof productKindValues)[number];

export type ProductDTO = Readonly<{
  id: number;
  skuInternal: string;
  name: string;
  description: string | null;
  kind: ProductKind;
  brandId: number;
  categoryId: number;
  technicalSpecs: unknown | null;
  imageUrls: readonly string[];
  stockMin: number;
  priceCost: string;
  priceSell: string;
  currentStock: number;
  createdAt: string;
  updatedAt: string;
}>;

export type ProductListItemDTO = Readonly<{
  id: number;
  skuInternal: string;
  name: string;
  kind: ProductKind;
  currentStock: number;
  stockMin: number;
  priceSell: string;
}>;

export type ProductSearchItemDTO = Readonly<{
  id: number;
  skuInternal: string;
  name: string;
  kind: ProductKind;
}>;
