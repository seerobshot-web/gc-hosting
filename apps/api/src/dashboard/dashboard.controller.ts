import { Controller, Get, Headers, UnauthorizedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  private authorizeDashboardKey(incomingKey?: string) {
    const expectedKey = process.env.DASHBOARD_API_KEY;
    if (!expectedKey) return;
    if (incomingKey !== expectedKey) {
      throw new UnauthorizedException("Invalid dashboard key");
    }
  }

  @Get("overview")
  overview(@Headers("x-dashboard-key") dashboardKey?: string) {
    this.authorizeDashboardKey(dashboardKey);
    return this.dashboardService.getOverview();
  }
}
