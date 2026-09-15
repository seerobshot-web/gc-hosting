import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateClientDto {
  @ApiProperty({ description: "Organization that owns the client" })
  @IsString()
  @IsNotEmpty()
  orgId!: string;

  @ApiProperty({ description: "Client identifier in FOSSBilling" })
  @IsString()
  @IsNotEmpty()
  fossbillingClientId!: string;

  @ApiProperty({ example: "admin@example.org", format: "email" })
  @IsEmail()
  email!: string;
}

export class FindClientsQueryDto {
  @ApiPropertyOptional({ description: "Only return clients in this organization" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  orgId?: string;
}

export class ClientIdParamsDto {
  @ApiProperty({ description: "Client identifier" })
  @IsString()
  @IsNotEmpty()
  clientId!: string;
}

export class ClientDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orgId!: string;

  @ApiProperty()
  fossbillingClientId!: string;

  @ApiProperty({ format: "email" })
  email!: string;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: Date;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: Date;
}
