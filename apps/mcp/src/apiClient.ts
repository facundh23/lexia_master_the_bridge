export interface ApiClientConfig {
  baseUrl: string;
  pat: string;
}

export class LexiaApiClient {
  private readonly headers: Record<string, string>;

  constructor(private readonly config: ApiClientConfig) {
    this.headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.pat}`,
    };
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }
}
