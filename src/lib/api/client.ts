import { usePhidiasStore } from '../../store/phidias-store';

const REQUEST_TIMEOUT_MS = 60000;

export interface FetchOptions extends RequestInit {
    timeout?: number;
}

export interface ClientConfig extends Omit<FetchOptions, 'body'> {
    body?: unknown;
    auth?: boolean;
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
    const requestTimeout = timeout ?? REQUEST_TIMEOUT_MS;
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

async function getAccessToken(): Promise<string | null> {
    // Basic implementation for auth=true.
    // In real usage, this should handle token refresh logic
    return usePhidiasStore.getState().accessToken;
}

export async function client<T = unknown>(
    url: string,
    { body, auth = false, ...customConfig }: ClientConfig = {},
): Promise<ClientResponse<T>> {
    const controller = new AbortController();
    let data: unknown;
    let headers: Record<string, string> = {};

    try {
        if (auth === false) {
            const { accessToken } = usePhidiasStore.getState();
            if (accessToken) {
                headers = {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                };
            } else {
                headers = {
                    'Content-Type': 'application/json',
                };
            }
        } else {
            const accessToken = await getAccessToken();
            headers = {
                'Content-Type': 'application/json',
            };
            if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        }

        const config: RequestInit & { timeout?: number } = {
            signal: controller.signal,
            ...customConfig,
            headers: {
                ...headers,
                ...(customConfig.headers as Record<string, string>),
            },
        };

        if (
            body &&
            (config.headers as Record<string, string>)['Content-Type'] === 'application/json'
        ) {
            config.body = JSON.stringify(body);
        } else if (body) {
            config.body = body as BodyInit;
        }

        // let browser add boundary automatically for FormData
        if ((config.headers as Record<string, string>)['Content-Type'] === 'multipart/form-data') {
            delete (config.headers as Record<string, string>)['Content-Type'];
        }

        // We use fetchTimeoutWithRetry optionally? The JS client used fetchTimeout natively.
        // We'll stick to fetchTimeout for parity, user can opt-in to fetchTimeoutWithRetry if needed.
        const response = await fetchTimeout(url, config as FetchOptions);
        const contentType = response.headers.get('content-type');

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
            (data as Record<string, unknown>)?.message ?? (data as Record<string, unknown>)?.detail ?? (data as Record<string, unknown>)?.error_msg ?? response.statusText;
        if (typeof errMessage !== 'string') {
            errMessage = JSON.stringify(errMessage);
        }

        throw new Error(errMessage as string);
    } catch (error: unknown) {
        if ((error as Error).name === 'AbortError' || (error as Error).message?.includes('Timeout')) {
            console.error('The request has been aborted / timed out');
        }
        controller.abort();
        throw new Error((error as Error).message ? (error as Error).message : String(data));
    }
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
