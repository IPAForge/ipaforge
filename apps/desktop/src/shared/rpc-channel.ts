// The one message the main process, the preload and the renderer agree on: the rpc MessagePort handed to the page.
// Main sends it on this IPC channel; the preload forwards the port to the page with this message as its data.
export const RPC_PORT_CHANNEL = 'loadstar:rpc'
