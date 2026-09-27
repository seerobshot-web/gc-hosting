import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export const AUDIT_LIST_DEFAULT_LIMIT = 50;
export const AUDIT_LIST_MAX_LIMIT = 100;

export class AuditListQueryDto {
  /** Opaque, from a previous page's `nextCursor` — never orgId or a raw id. */
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(AUDIT_LIST_MAX_LIMIT)
  limit?: number;
}
