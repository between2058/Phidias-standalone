'use client';

import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

interface ReactSwaggerProps {
  spec: Record<string, unknown>;
}

const API_KEY = 'PHIDIAS';

function ReactSwagger({ spec }: ReactSwaggerProps) {
  return (
    <SwaggerUI
      spec={spec}
      docExpansion="list"
      deepLinking
      filter
      tryItOutEnabled
      requestInterceptor={(req) => {
        req.headers = { ...req.headers, 'x-api-key': API_KEY };
        return req;
      }}
    />
  );
}

export default ReactSwagger;
