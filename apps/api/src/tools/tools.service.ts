import { Injectable } from "@nestjs/common";
import { publicTools, publicToolsSource } from "./tools.catalog";

@Injectable()
export class ToolsService {
  list() {
    return { source: publicToolsSource, items: publicTools };
  }

  getBySlug(slug: string) {
    return publicTools.find((tool) => tool.slug === slug);
  }
}
