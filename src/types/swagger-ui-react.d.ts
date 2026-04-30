declare module 'swagger-ui-react' {
  import type { FC } from 'react';

  interface SwaggerRequest {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }

  interface SwaggerUIProps {
    spec?: Record<string, unknown>;
    url?: string;
    layout?: string;
    docExpansion?: string;
    deepLinking?: boolean;
    filter?: boolean;
    tryItOutEnabled?: boolean;
    showMutatedRequest?: boolean;
    persistAuthorization?: boolean;
    presets?: unknown[];
    plugins?: unknown[];
    requestInterceptor?: (req: SwaggerRequest) => SwaggerRequest | Promise<SwaggerRequest>;
    responseInterceptor?: (res: Response) => Response | Promise<Response>;
  }

  const SwaggerUI: FC<SwaggerUIProps>;
  export default SwaggerUI;
}
