import type { PrismaClient } from "@prisma/client";
import { throwIfPrismaError } from "../../../shared/errors/prisma-error.js";
import { CategoryRepository, type CategoryCreateInput, type CategoryUpdateInput } from "./category.repository.js";

export class CategoryService {
  private readonly repo: CategoryRepository;

  constructor(db: PrismaClient) {
    this.repo = new CategoryRepository(db);
  }

  list() {
    return this.repo.list();
  }

  async create(input: CategoryCreateInput) {
    try {
      return await this.repo.create(input);
    } catch (err) {
      throwIfPrismaError(err);
      throw err;
    }
  }

  async update(id: number, input: CategoryUpdateInput) {
    try {
      return await this.repo.update(id, input);
    } catch (err) {
      throwIfPrismaError(err);
      throw err;
    }
  }
}
