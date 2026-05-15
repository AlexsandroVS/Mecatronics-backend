import type { PrismaClient } from "@prisma/client";

export type CategoryCreateInput = Readonly<{ name: string }>;
export type CategoryUpdateInput = Readonly<{ name: string }>;

export class CategoryRepository {
  constructor(private readonly db: PrismaClient) {}

  list(): Promise<{ id: number; name: string }[]> {
    return this.db.category.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true }
    });
  }

  create(input: CategoryCreateInput): Promise<{ id: number; name: string }> {
    return this.db.category.create({
      data: { name: input.name },
      select: { id: true, name: true }
    });
  }

  update(id: number, input: CategoryUpdateInput): Promise<{ id: number; name: string }> {
    return this.db.category.update({
      where: { id },
      data: { name: input.name },
      select: { id: true, name: true }
    });
  }
}
