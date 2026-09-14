import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ProvisioningService } from "./provisioning.service";
import { PlaceOrderDto } from "./dto";

@ApiTags("provisioning")
@Controller("provisioning")
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  @Post("orders")
  placeOrder(@Body() body: PlaceOrderDto) {
    return this.provisioningService.placeOrder(body);
  }

  @Get("orders/:clientId")
  findByClient(@Param("clientId") clientId: string) {
    return this.provisioningService.findByClient(clientId);
  }
}
