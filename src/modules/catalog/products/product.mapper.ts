import type { ProductDTO, ProductListItemDTO, ProductSearchItemDTO } from "./product.types.js";

type ProductLike = Readonly<{
  id: number;
  skuInternal: string;
  name: string;
  description: string | null;
  kind: ProductDTO["kind"];
  brandId: number;
  categoryId: number;
  technicalSpecs: unknown | null;
  stockMin: number;
  priceCost: { toString(): string };
  priceSell: { toString(): string };
  currentStock: number;
  createdAt: Date;
  updatedAt: Date;
  images?: readonly Readonly<{ url: string }>[];
}>;

export function toProductDTO(product: ProductLike): ProductDTO {
  const imageUrls = product.images?.map((i) => i.url) ?? [];

  return {
    id: product.id,
    skuInternal: product.skuInternal,
    name: product.name,
    description: product.description,
    kind: product.kind,
    brandId: product.brandId,
    categoryId: product.categoryId,
    technicalSpecs: product.technicalSpecs,
    imageUrls,
    stockMin: product.stockMin,
    priceCost: product.priceCost.toString(),
    priceSell: product.priceSell.toString(),
    currentStock: product.currentStock,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString()
  };
}

type ProductListLike = Readonly<{
  id: number;
  skuInternal: string;
  name: string;
  kind: ProductDTO["kind"];
  currentStock: number;
  stockMin: number;
  priceSell: { toString(): string };
}>;

export function toProductListItemDTO(product: ProductListLike): ProductListItemDTO {
  return {
    id: product.id,
    skuInternal: product.skuInternal,
    name: product.name,
    kind: product.kind,
    currentStock: product.currentStock,
    stockMin: product.stockMin,
    priceSell: product.priceSell.toString()
  };
}

type ProductSearchLike = Readonly<{
  id: number;
  skuInternal: string;
  name: string;
  kind: ProductDTO["kind"];
}>;

export function toProductSearchItemDTO(product: ProductSearchLike): ProductSearchItemDTO {
  return {
    id: product.id,
    skuInternal: product.skuInternal,
    name: product.name,
    kind: product.kind
  };
}
