import { GLinkModuleType } from "@gch/database";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from "class-validator";

export class CreateGLinkDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orgId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @ApiProperty({ enum: GLinkModuleType, enumName: "GLinkModuleType" })
  @IsEnum(GLinkModuleType)
  moduleType!: GLinkModuleType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional({ example: "https://example.org/give", format: "uri" })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  url?: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class ReorderGLinksDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @ApiProperty({ type: [String], description: "GLink IDs in their desired order" })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  orderedIds!: string[];
}

export class GLinkClientQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clientId!: string;
}

export class GLinkIdParamsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id!: string;
}

export class GLinkDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  orgId!: string;
  @ApiProperty()
  clientId!: string;
  @ApiProperty({ enum: GLinkModuleType, enumName: "GLinkModuleType" })
  moduleType!: GLinkModuleType;
  @ApiProperty()
  label!: string;
  @ApiPropertyOptional({ nullable: true, format: "uri" })
  url!: string | null;
  @ApiProperty()
  position!: number;
  @ApiProperty()
  isActive!: boolean;
  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: Date;
  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: Date;
}
