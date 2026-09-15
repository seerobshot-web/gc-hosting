import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
} from "class-validator";
import { GLinkModuleType } from "@gch/database";

export class CreateGLinkDto {
  @IsString()
  orgId!: string;

  @IsString()
  clientId!: string;

  @IsEnum(GLinkModuleType)
  moduleType!: GLinkModuleType;

  @IsString()
  label!: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsInt()
  position?: number;
}

export class ReorderGLinksDto {
  @IsString()
  clientId!: string;

  @IsArray()
  @IsString({ each: true })
  orderedIds!: string[];
}
