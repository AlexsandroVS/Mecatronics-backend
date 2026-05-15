export type UserRole = "ADMIN" | "STAFF";

export type UserDTO = Readonly<{
  id: number;
  email: string;
  role: UserRole;
  createdAt: string;
}>;

