import type { PrismaClient } from "@prisma/client";
import type { ProductKind } from "./product.types.js";

type JsonLike = unknown;
type DecimalLike = { toString(): string };

export type ProductCreateInput = Readonly<{
  skuInternal: string;
  name: string;
  description?: string | null;
  kind: ProductKind;
  brandId: number;
  categoryId: number;
  technicalSpecs?: JsonLike;
  imageUrls?: readonly string[];
  stockMin: number;
  priceCost: DecimalLike;
  priceSell: DecimalLike;
}>;

export type ProductUpdateInput = Readonly<{
  name?: string;
  description?: string | null;
  kind?: ProductKind;
  brandId?: number;
  categoryId?: number;
  technicalSpecs?: JsonLike;
  imageUrls?: readonly string[];
  stockMin?: number;
  priceCost?: DecimalLike;
  priceSell?: DecimalLike;
}>;

export class ProductRepository {
  constructor(private readonly db: PrismaClient) {}

  async listPage(input: {
    q?: string;
    limit: number;
    offset: number;
    kind?: ProductKind;
    lowStock?: boolean;
    sort?: "NAME" | "STOCK" | "PRICE_SELL";
    dir?: "ASC" | "DESC";
  }) {
    const sort = input.sort ?? "NAME";
    const dir = input.dir === "DESC" ? "DESC" : "ASC";

    const orderBy =
      sort === "STOCK" ? `"currentStock"` : sort === "PRICE_SELL" ? `"priceSell"` : `"name"`;

    const whereParts: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    whereParts.push(`"deletedAt" IS NULL`);

    if (input.q && input.q.trim()) {
      const like = `%${input.q.trim().toLowerCase()}%`;
      whereParts.push(`(lower("name") LIKE $${p} OR lower("skuInternal") LIKE $${p})`);
      params.push(like);
      p += 1;
    }

    if (input.kind) {
      whereParts.push(`"kind" = ($${p}::"ProductKind")`);
      params.push(input.kind);
      p += 1;
    }

    if (input.lowStock) {
      whereParts.push(`"currentStock" <= "stockMin"`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const sql = `
      SELECT "id", "skuInternal", "name", "kind", "currentStock", "stockMin", "priceSell"
      FROM "Product"
      ${whereSql}
      ORDER BY ${orderBy} ${dir}, "id" ASC
      OFFSET $${p}
      LIMIT $${p + 1}
    `;

    params.push(input.offset, input.limit);
    const rows = await this.db.$queryRawUnsafe(sql, ...params);
    return rows as Array<{
      id: number;
      skuInternal: string;
      name: string;
      kind: ProductKind;
      currentStock: number;
      stockMin: number;
      priceSell: DecimalLike;
    }>;
  }

  async listForExport(input: {
    q?: string;
    limit: number;
    kind?: ProductKind;
    lowStock?: boolean;
    sort?: "NAME" | "STOCK";
    dir?: "ASC" | "DESC";
  }) {
    const sort = input.sort ?? "NAME";
    const dir = input.dir === "DESC" ? "DESC" : "ASC";
    const orderBy = sort === "STOCK" ? `p."currentStock"` : `p."name"`;

    const whereParts: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    whereParts.push(`p."deletedAt" IS NULL`);

    if (input.q && input.q.trim()) {
      const like = `%${input.q.trim().toLowerCase()}%`;
      whereParts.push(`(lower(p."name") LIKE $${p} OR lower(p."skuInternal") LIKE $${p})`);
      params.push(like);
      p += 1;
    }

    if (input.kind) {
      whereParts.push(`p."kind" = ($${p}::"ProductKind")`);
      params.push(input.kind);
      p += 1;
    }

    if (input.lowStock) {
      whereParts.push(`p."currentStock" <= p."stockMin"`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const sql = `
      SELECT
        p."id",
        p."skuInternal",
        p."name",
        p."kind",
        p."currentStock",
        p."stockMin",
        b."name" AS "brandName",
        c."name" AS "categoryName"
      FROM "Product" p
      JOIN "Brand" b ON b."id" = p."brandId"
      JOIN "Category" c ON c."id" = p."categoryId"
      ${whereSql}
      ORDER BY ${orderBy} ${dir}, p."id" ASC
      LIMIT $${p}
    `;

    params.push(input.limit);
    const rows = await this.db.$queryRawUnsafe(sql, ...params);
    return rows as Array<{
      id: number;
      skuInternal: string;
      name: string;
      kind: ProductKind;
      currentStock: number;
      stockMin: number;
      brandName: string;
      categoryName: string;
    }>;
  }

  async search(input: { q: string; limit: number; kind?: ProductKind; machineSubtype?: string }) {
    const q = input.q.trim().toLowerCase();
    const like = `%${q}%`;

    if (input.kind) {
      if (input.kind === "MACHINE" && input.machineSubtype) {
        const rows = await this.db.$queryRaw`
          SELECT "id", "skuInternal", "name", "kind"
          FROM "Product"
          WHERE (lower("name") LIKE ${like} OR lower("skuInternal") LIKE ${like})
            AND "kind" = (${input.kind}::"ProductKind")
            AND (("technicalSpecs"->>'machine_subtype') = ${input.machineSubtype} OR ("technicalSpecs"->>'machineSubtype') = ${input.machineSubtype})
            AND "deletedAt" IS NULL
          ORDER BY "name" ASC, "id" ASC
          LIMIT ${input.limit}
        `;
        return rows as Array<{ id: number; skuInternal: string; name: string; kind: ProductKind }>;
      }

      const rows = await this.db.$queryRaw`
        SELECT "id", "skuInternal", "name", "kind"
        FROM "Product"
        WHERE (lower("name") LIKE ${like} OR lower("skuInternal") LIKE ${like})
          AND "kind" = (${input.kind}::"ProductKind")
          AND "deletedAt" IS NULL
        ORDER BY "name" ASC, "id" ASC
        LIMIT ${input.limit}
      `;
      return rows as Array<{ id: number; skuInternal: string; name: string; kind: ProductKind }>;
    }

    const rows = await this.db.$queryRaw`
      SELECT "id", "skuInternal", "name", "kind"
      FROM "Product"
      WHERE lower("name") LIKE ${like} OR lower("skuInternal") LIKE ${like}
        AND "deletedAt" IS NULL
      ORDER BY "name" ASC, "id" ASC
      LIMIT ${input.limit}
    `;

    return rows as Array<{ id: number; skuInternal: string; name: string; kind: ProductKind }>;
  }

  async getById(id: number) {
    return this.db.product.findFirst({
      where: { id, deletedAt: null } as never,
      include: { images: { select: { url: true }, orderBy: { id: "asc" } } }
    });
  }

  async softDelete(id: number) {
    return this.db.product.update({ where: { id }, data: { deletedAt: new Date() } as never, select: { id: true } });
  }

  create(input: ProductCreateInput) {
    return this.db.product.create({
      data: {
        skuInternal: input.skuInternal,
        name: input.name,
        description: input.description ?? null,
        kind: input.kind,
        brandId: input.brandId,
        categoryId: input.categoryId,
        technicalSpecs: input.technicalSpecs as never,
        stockMin: input.stockMin,
        priceCost: input.priceCost as never,
        priceSell: input.priceSell as never,
        images: input.imageUrls?.length ? { create: input.imageUrls.map((url) => ({ url })) } : undefined
      }
    });
  }

  update(id: number, input: ProductUpdateInput) {
    return this.db.product.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        kind: input.kind,
        brandId: input.brandId,
        categoryId: input.categoryId,
        technicalSpecs: input.technicalSpecs as never,
        stockMin: input.stockMin,
        priceCost: input.priceCost as never,
        priceSell: input.priceSell as never,
        images: input.imageUrls
          ? {
              deleteMany: {},
              create: input.imageUrls.map((url) => ({ url }))
            }
          : undefined
      }
    });
  }
}
