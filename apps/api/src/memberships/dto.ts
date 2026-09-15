import { IsEmail, IsEnum } from "class-validator";
import { Role } from "@gch/database";

export class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(Role)
  role!: Role;
}

export class ChangeRoleDto {
  @IsEnum(Role)
  role!: Role;
}
