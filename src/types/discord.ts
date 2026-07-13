export type VoiceChannelMember = {
  id: string;
  name: string;
  avatarUrl: string;
};

export type VoiceChannel = {
  id: string;
  name: string;
  members?: VoiceChannelMember[];
};

export type Guild = {
  id: string;
  name: string;
  icon: string;
  voiceChannels: VoiceChannel[];
};
