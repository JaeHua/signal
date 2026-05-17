export interface ChannelMessage {
  title: string
  content: string
  url?: string
}

export interface ChannelProvider {
  name: string
  send(message: ChannelMessage): Promise<void>
}
