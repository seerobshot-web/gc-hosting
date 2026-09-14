import { IsBoolean, IsOptional, IsString } from "class-validator";

export class PlaceOrderDto {
  @IsString()
  clientId!: string;

  @IsString()
  resellPortalClientId!: string;

  @IsString()
  cpanelUsername!: string;

  @IsString()
  primaryDomain!: string;

  @IsOptional()
  @IsBoolean()
  testMode?: boolean;
}
