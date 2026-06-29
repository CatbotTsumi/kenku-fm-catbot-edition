import { Guild, VoiceChannel } from "./outputSlice";

export function applyGuildOrder(guilds: Guild[], order: string[]): Guild[] {
  if (order.length === 0) {
    return guilds;
  }
  const byId = Object.fromEntries(guilds.map((g) => [g.id, g]));
  const ordered = order.filter((id) => byId[id]).map((id) => byId[id]);
  const rest = guilds.filter((g) => !order.includes(g.id));
  return [...ordered, ...rest];
}

export function guildMatchesSearch(
  guild: Guild,
  query: string,
): boolean {
  if (!query) {
    return true;
  }
  if (guild.name.toLowerCase().includes(query)) {
    return true;
  }
  return guild.voiceChannels.some((channel: VoiceChannel) =>
    channel.name.toLowerCase().includes(query),
  );
}
