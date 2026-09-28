import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/public.decorator";

@ApiTags("health")
@Public()
@Controller()
export class HealthController {
  @Get("health")
  health() {
    return { status: "ok" as const };
  }

  @Get("ready")
  ready() {
    // Reaching this handler means environment validation and Nest bootstrap
    // already succeeded. It deliberately performs no provider or DB writes.
    return { status: "ready" as const };
  }
}
