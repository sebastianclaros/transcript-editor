import brandJson from "../../../brand.json";

/** The ONLY place where the product name lives for TypeScript code (see docs/architecture.md). */
export interface Brand {
  readonly productName: string;
  readonly slug: string;
  readonly appId: string;
  readonly repo: string;
  readonly executableName: string;
  readonly protocols: { readonly app: string; readonly media: string };
}

export const BRAND: Brand = brandJson;
