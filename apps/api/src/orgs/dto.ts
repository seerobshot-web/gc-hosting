import { IsFQDN, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

export class CreateOrgDto {
  @IsString()
  name!: string;
}

export class UpdateOrgDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  /** A verified domain of this org, or null to switch auto-join off. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsFQDN()
  autoJoinDomain?: string | null;
}

export class AddDomainDto {
  @IsFQDN()
  domain!: string;
}
