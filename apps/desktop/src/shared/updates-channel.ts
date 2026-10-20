// The update channel's MessagePort, handed to the page like the rpc one: main sends it on this IPC channel, the
// preload forwards the port to the page with this message as its data.
export const UPDATES_PORT_CHANNEL = 'ipaforge:updates'
