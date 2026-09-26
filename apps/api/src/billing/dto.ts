import { IsNotEmpty, IsString } from "class-validator";

export class CreateCheckoutSessionDto {
  @IsString()
  planId!: string;
}

export class CreateProductCheckoutSessionDto {
  @IsString()
  @IsNotEmpty()
  gchSlug!: string;

  @IsString()
  @IsNotEmpty()
  billingCycle!: string;
}
