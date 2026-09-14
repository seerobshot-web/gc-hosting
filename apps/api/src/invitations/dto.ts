import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { Role } from "@gch/database";

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsEnum(Role)
  role!: Role;
}

export class AcceptInvitationDto {
  /** Required unless the request carries a bearer token for the invited email. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
