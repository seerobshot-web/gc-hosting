import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class PlaceOrderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @ApiProperty({ description: "Client identifier in ResellPortal" })
  @IsString()
  @IsNotEmpty()
  resellPortalClientId!: string;

  @ApiProperty({ example: "exampleacct" })
  @IsString()
  @IsNotEmpty()
  cpanelUsername!: string;

  @ApiProperty({ example: "example.org" })
  @IsString()
  @IsNotEmpty()
  primaryDomain!: string;

  @ApiPropertyOptional({ description: "Place a non-billable test order" })
  @IsOptional()
  @IsBoolean()
  testMode?: boolean;
}

export class ProvisioningClientParamsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clientId!: string;
}

export class ProvisioningOrderDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  clientId!: string;
  @ApiProperty()
  cpanelUsername!: string;
  @ApiProperty()
  primaryDomain!: string;
  @ApiPropertyOptional({ nullable: true })
  resellPortalOrderId!: string | null;
  @ApiProperty({ enum: ["provisioning", "deployed", "failed"] })
  status!: string;
  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  nextBillingDate!: Date | null;
  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: Date;
  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: Date;
}
