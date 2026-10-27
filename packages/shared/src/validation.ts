import { clientMessageSchema } from './protocol';
export function parseClientMessage(raw: string) {
  try {
    return clientMessageSchema.safeParse(JSON.parse(raw));
  } catch {
    return { success: false as const };
  }
}
