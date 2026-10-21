// Where "Save signed .ipa instead" writes: a folder the user picked on the host (the desktop app's folder dialog).
// The Engine never chooses a folder itself: the path comes from the host, through the RPC server, never the page.

export type SignedIpaFolder = {
  /**
   * Writes `stream` as `name` in `folder`, under a free name ("App (2).ipa" when "App.ipa" is taken), and returns
   * the path it was written to.
   */
  save(
    folder: string,
    name: string,
    stream: ReadableStream<Uint8Array>
  ): Promise<string>
}
