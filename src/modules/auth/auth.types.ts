import type { UserRole } from "@prisma/client";

export type JwtPayload = Readonly<{
  uid: number;
  role: UserRole;
}>;

