import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@gch/database";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { TenancyService } from "../tenancy/tenancy.service";
import { ProvisioningService } from "./provisioning.service";
import { PlaceOrderDto } from "./dto";

@ApiTags("provisioning")
@ApiBearerAuth()
@Controller("provisioning")
export class ProvisioningController {
  constructor(
    private readonly provisioningService: ProvisioningService,
    private readonly tenancy: TenancyService,
  ) {}

  @Post("orders")
  async placeOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PlaceOrderDto,
  ) {
    await this.tenancy.requireClientAccess(user.userId, body.clientId, [
      Role.OWNER,
      Role.ADMIN,
    ]);
    return this.provisioningService.placeOrder(body);
  }

  @Get("orders/:clientId")
  async findByClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param("clientId") clientId: string,
  ) {
    await this.tenancy.requireClientAccess(user.userId, clientId);
    return this.provisioningService.findByClient(clientId);
  }
}
