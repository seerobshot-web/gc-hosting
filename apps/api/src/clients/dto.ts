import { IsEmail, IsString } from "class-validator";

export class CreateClientDto {
  @IsString()
  orgId!: string;

  @IsString()
  fossbillingClientId!: string;

  @IsEmail()
  email!: string;
}
