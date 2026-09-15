import {
  Controller,
  Get,
  Headers,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/public.decorator";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  private authorizeDashboardKey(incomingKey?: string) {
    const expectedKey = process.env.DASHBOARD_API_KEY?.trim();
    if (!expectedKey) {
      throw new InternalServerErrorException("Dashboard key is not configured");
    }
    if (incomingKey !== expectedKey) {
      throw new UnauthorizedException("Invalid dashboard key");
    }
  }

  @Public()
  @Get("overview")
  overview(@Headers("x-dashboard-key") dashboardKey?: string) {
    this.authorizeDashboardKey(dashboardKey);
    return this.dashboardService.getOverview();
  }
}
