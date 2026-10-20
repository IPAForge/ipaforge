/** A JSON document over a `fetch` (Electron's `net.fetch`: the system's proxy and certificates); any non-2xx rejects. */
export const createFetchJson =
  (fetch: (url: string) => Promise<Response>) =>
  async (url: string): Promise<unknown> => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${url} answered ${response.status}`)
    return response.json()
  }
