import { getPhidiasRequestConfig } from '@pegaverse/phidias-sdk';

export interface FetchOptions extends RequestInit {
    timeout?: number;
}

export interface ClientConfig extends Omit<FetchOptions, 'body'> {
    body?: unknown;
    /** @deprecated kept for API compatibility — auth is now handled via requestConfig.getAuthToken */
    auth?: boolean;
    /** @deprecated auto-detected from content-type */
    responseType?: string;
}

export interface ClientResponse<T = unknown> {
    response: Response;
    status: number;
    data: T;
    headers: Headers;
    url: string;
}

export async function fetchTimeout(
    url: string,
    { timeout, signal, ...options }: FetchOptions = {},
): Promise<Response> {
    const requestTimeout = timeout ?? getPhidiasRequestConfig().defaultTimeout;
    const controller = new AbortController();
    const promise = fetch(url, { signal: controller.signal, ...options });

    if (signal) signal.addEventListener('abort', () => controller.abort());

    const timeoutId = setTimeout(
        () =>
            controller.abort(
                new Error(`Timeout ${requestTimeout} ms has been reached`),
            ),
        requestTimeout,
    );

    return promise.finally(() => clearTimeout(timeoutId));
}

export async function fetchTimeoutWithRetry(
    url: string,
    options: FetchOptions = {},
    retries = 3,
    delay = 1000,
): Promise<Response> {
    try {
        const response = await fetchTimeout(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
    } catch (error) {
        if (retries > 0) {
            await new Promise((res) => setTimeout(res, delay));
            return fetchTimeoutWithRetry(url, options, retries - 1, delay);
        }
        throw error;
    }
}

export async function client<T = unknown>(
    url: string,
    { body, auth: _auth, timeout, signal, ...customConfig }: ClientConfig = {},
): Promise<ClientResponse<T>> {
    const config = getPhidiasRequestConfig();
    const effectiveTimeout = timeout ?? config.defaultTimeout;

    // ── Auth ────────────────────────────────────────────────────────────────
    let accessToken: string | null = null;
    try {
        accessToken = await config.getAuthToken();
    } catch (authErr) {
        const err = authErr instanceof Error ? authErr : new Error(String(authErr));
        config.onAuthFailure(err);
        throw err;
    }

    // ── Build headers ────────────────────────────────────────────────────────
    const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) baseHeaders.Authorization = `Bearer ${accessToken}`;

    let requestInit: RequestInit = {
        ...customConfig,
        headers: {
            ...baseHeaders,
            ...(customConfig.headers as Record<string, string>),
        },
    };

    // ── Body ─────────────────────────────────────────────────────────────────
    if (body && (requestInit.headers as Record<string, string>)['Content-Type'] === 'application/json') {
        requestInit = { ...requestInit, body: JSON.stringify(body) };
    } else if (body) {
        requestInit = { ...requestInit, body: body as BodyInit };
    }

    // Let the browser set the correct multipart boundary automatically.
    if ((requestInit.headers as Record<string, string>)['Content-Type'] === 'multipart/form-data') {
        const h = { ...(requestInit.headers as Record<string, string>) };
        delete h['Content-Type'];
        requestInit = { ...requestInit, headers: h };
    }

    // ── Request interceptor ───────────────────────────────────────────────────
    requestInit = await config.onRequest(url, requestInit);

    // ── Retry loop ────────────────────────────────────────────────────────────
    let lastError: unknown;

    for (let attempt = 1; ; attempt++) {
        if (attempt > 1) {
            await new Promise((res) => setTimeout(res, config.retryDelay(attempt - 1)));
            // Honour external abort signal between retries.
            if ((signal as AbortSignal | undefined)?.aborted) break;
        }

        try {
            const response = await fetchTimeout(url, {
                ...requestInit,
                signal,
                timeout: effectiveTimeout,
            } as FetchOptions);

            const contentType = response.headers.get('content-type');
            let data: unknown;

            if (response.status === 204) {
                data = '204 No Content';
            } else if (contentType?.includes('application/json')) {
                data = await response.json();
            } else if (
                contentType?.includes('application/octet-stream') ||
                contentType?.includes('application/zip') ||
                contentType?.includes('image/') ||
                contentType?.includes('model/') ||
                contentType?.includes('video/')
            ) {
                data = await response.blob();
            } else {
                data = await response.text();
            }

            if (response.ok) {
                return {
                    response,
                    status: response.status,
                    data: data as T,
                    headers: response.headers,
                    url: response.url,
                };
            }

            let errMessage =
                (data as Record<string, unknown>)?.message ??
                (data as Record<string, unknown>)?.detail ??
                (data as Record<string, unknown>)?.error_msg ??
                response.statusText;
            if (typeof errMessage !== 'string') errMessage = JSON.stringify(errMessage);
            throw new Error(errMessage as string);

        } catch (error: unknown) {
            lastError = error;

            // Never retry on intentional cancellations.
            const isAbort =
                (error as Error).name === 'AbortError' ||
                (error as Error).message?.includes('Timeout');
            if (isAbort || !config.shouldRetry(error, attempt)) break;
        }
    }

    // ── All attempts exhausted ────────────────────────────────────────────────
    const finalError =
        lastError instanceof Error ? lastError : new Error(String(lastError));

    if (finalError.name === 'AbortError' || finalError.message?.includes('Timeout')) {
        console.error('The request has been aborted / timed out');
    }

    config.onError(finalError, {
        url,
        method: String((requestInit as Record<string, unknown>).method ?? 'GET'),
    });

    throw finalError;
}

client.get = function <T = unknown>(url: string, customConfig: ClientConfig = {}) {
    return client<T>(url, { ...customConfig, method: 'GET' });
};
client.post = function <T = unknown>(
    url: string,
    body?: unknown,
    customConfig: ClientConfig = {},
) {
    return client<T>(url, { ...customConfig, body, method: 'POST' });
};
client.put = function <T = unknown>(
    url: string,
    body?: unknown,
    customConfig: ClientConfig = {},
) {
    return client<T>(url, { ...customConfig, body, method: 'PUT' });
};
client.patch = function <T = unknown>(
    url: string,
    body?: unknown,
    customConfig: ClientConfig = {},
) {
    return client<T>(url, { ...customConfig, body, method: 'PATCH' });
};
client.delete = function <T = unknown>(
    url: string,
    body?: unknown,
    customConfig: ClientConfig = {},
) {
    return client<T>(url, { ...customConfig, body, method: 'DELETE' });
};
