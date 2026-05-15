import type { Prisma, PrismaClient } from "@prisma/client";

export type BrandCreateInput = Readonly<{ name: string }>;
export type BrandUpdateInput = Readonly<{ name: string }>;

export class BrandRepository {
  constructor(private readonly db: PrismaClient) {}

  list(): Promise<{ id: number; name: string }[]> {
    return this.db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  }

  create(input: BrandCreateInput): Promise<{ id: number; name: string }> {
    return this.db.brand.create({ data: input satisfies Prisma.BrandCreateInput, select: { id: true, name: true } });
  }

  update(id: number, input: BrandUpdateInput): Promise<{ id: number; name: string }> {
    return this.db.brand.update({ where: { id }, data: { name: input.name }, select: { id: true, name: true } });
  }
}
