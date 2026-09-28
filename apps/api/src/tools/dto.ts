import { Matches } from "class-validator";

export class ToolSlugParamsDto {
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "slug must be a lowercase kebab-case identifier",
  })
  slug!: string;
}
