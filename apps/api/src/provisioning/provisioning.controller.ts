import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ProvisioningService, PlaceOrderInput } from "./provisioning.service";

@ApiTags("provisioning")
@Controller("provisioning")
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  @Post("orders")
  placeOrder(@Body() body: PlaceOrderInput) {
    return this.provisioningService.placeOrder(body);
  }

  @Get("orders/:clientId")
  findByClient(@Param("clientId") clientId: string) {
    return this.provisioningService.findByClient(clientId);
  }
}
