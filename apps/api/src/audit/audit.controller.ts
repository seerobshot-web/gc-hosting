import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuditService } from "./audit.service";

@ApiTags("audit")
@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  recent(@Query("limit") limit?: string) {
    return this.auditService.recent(limit ? Number(limit) : undefined);
  }
}
