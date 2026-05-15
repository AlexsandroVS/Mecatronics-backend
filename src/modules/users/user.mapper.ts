import type { UserDTO } from "./user.types.js";

type UserLike = Readonly<{
  id: number;
  email: string;
  role: "ADMIN" | "STAFF";
  createdAt: Date;
}>;

export function toUserDTO(u: UserLike): UserDTO {
  return { id: u.id, email: u.email, role: u.role, createdAt: u.createdAt.toISOString() };
}

