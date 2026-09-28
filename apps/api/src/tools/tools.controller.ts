import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../auth/public.decorator";
import { ToolSlugParamsDto } from "./dto";
import { ToolsService } from "./tools.service";

const TOOLS_THROTTLE = { default: { limit: 30, ttl: 60_000 } };

@ApiTags("tools")
@Public()
@Throttle(TOOLS_THROTTLE)
@Controller("v1/tools")
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  list() {
    return this.toolsService.list();
  }

  @Get(":slug")
  detail(@Param() params: ToolSlugParamsDto) {
    const tool = this.toolsService.getBySlug(params.slug);
    if (!tool) throw new NotFoundException("Tool not found");
    return { source: this.toolsService.list().source, item: tool };
  }
}
