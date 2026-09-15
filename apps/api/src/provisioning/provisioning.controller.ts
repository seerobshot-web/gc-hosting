import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { ProvisioningService } from "./provisioning.service";
import { PlaceOrderDto } from "./dto";

@ApiTags("provisioning")
@ApiBearerAuth()
@Controller("provisioning")
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  @Post("orders")
  @RequirePermission("provisioning:write", "client")
  placeOrder(@Body() body: PlaceOrderDto) {
    return this.provisioningService.placeOrder(body);
  }

  @Get("orders/:clientId")
  @RequirePermission("provisioning:read", "client")
  findByClient(@Param("clientId") clientId: string) {
    return this.provisioningService.findByClient(clientId);
  }
}
