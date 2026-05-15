import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../../shared/errors/app-error.js";
import { throwIfPrismaError } from "../../../shared/errors/prisma-error.js";
import { generateSkuInternal } from "../../../shared/utils/sku.js";
import { toProductDTO, toProductListItemDTO, toProductSearchItemDTO } from "./product.mapper.js";
import { ProductRepository, type ProductCreateInput, type ProductUpdateInput } from "./product.repository.js";

export class ProductService {
  private readonly repo: ProductRepository;

  constructor(private readonly db: PrismaClient) {
    this.repo = new ProductRepository(db);
  }

  async list(input: {
    q?: string;
    limit: number;
    offset: number;
    kind?: "MACHINE" | "PART" | "CONSUMABLE" | "ACCESSORY";
    lowStock?: boolean;
    sort?: "NAME" | "STOCK" | "PRICE_SELL";
    dir?: "ASC" | "DESC";
  }) {
    const items = await this.repo.listPage(input);
    return items.map(toProductListItemDTO);
  }

  async listForExport(input: {
    q?: string;
    kind?: "MACHINE" | "PART" | "CONSUMABLE" | "ACCESSORY";
    lowStock?: boolean;
    sort?: "NAME" | "STOCK";
    dir?: "ASC" | "DESC";
    limit: number;
  }) {
    return this.repo.listForExport(input);
  }

  async search(input: { q: string; limit: number; kind?: "MACHINE" | "PART" | "CONSUMABLE" | "ACCESSORY"; machineSubtype?: string }) {
    const items = await this.repo.search({ q: input.q, limit: input.limit, kind: input.kind, machineSubtype: input.machineSubtype });
    return items.map(toProductSearchItemDTO);
  }

  async getById(id: number) {
    const item = await this.repo.getById(id);
    if (!item) throw new NotFoundError({ message: "Producto no encontrado" });
    return toProductDTO(item);
  }

  async create(input: Omit<ProductCreateInput, "skuInternal">) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const skuInternal = generateSkuInternal();
      try {
        const created = await this.repo.create({ ...input, skuInternal });
        return this.getById(created.id);
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
        throwIfPrismaError(err);
        throw err;
      }
    }

    throw new ConflictError({ message: "No se pudo generar un SKU interno único" });
  }

  async update(id: number, input: ProductUpdateInput) {
    try {
      await this.repo.update(id, input);
      return await this.getById(id);
    } catch (err) {
      throwIfPrismaError(err);
      throw err;
    }
  }

  async softDelete(id: number) {
    try {
      await this.repo.softDelete(id);
    } catch (err) {
      throwIfPrismaError(err);
      throw err;
    }
  }
}
