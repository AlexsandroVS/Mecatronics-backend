import type { PrismaClient } from "@prisma/client";
import { throwIfPrismaError } from "../../../shared/errors/prisma-error.js";
import { BrandRepository, type BrandCreateInput, type BrandUpdateInput } from "./brand.repository.js";

export class BrandService {
  private readonly repo: BrandRepository;

  constructor(db: PrismaClient) {
    this.repo = new BrandRepository(db);
  }

  list() {
    return this.repo.list();
  }

  async create(input: BrandCreateInput) {
    try {
      return await this.repo.create(input);
    } catch (err) {
      throwIfPrismaError(err);
      throw err;
    }
  }

  async update(id: number, input: BrandUpdateInput) {
    try {
      return await this.repo.update(id, input);
    } catch (err) {
      throwIfPrismaError(err);
      throw err;
    }
  }
}
