export interface TwilioConnectedMessage {
  event: "connected";
  protocol: string;
  version: string;
}

export interface TwilioStartMessage {
  event: "start";
  sequenceNumber: string;
  start: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    customParameters?: {
      businessId?: string;
      callerPhone?: string;
      [key: string]: string | undefined;
    };
    mediaFormat: {
      encoding: "audio/x-mulaw";
      sampleRate: 8000;
      channels: 1;
    };
  };
  streamSid: string;
}

export interface TwilioMediaMessage {
  event: "media";
  sequenceNumber: string;
  media: {
    track: "inbound";
    chunk: string;
    timestamp: string;
    payload: string; // Base64 mulaw audio (8000Hz)
  };
  streamSid: string;
}

export interface TwilioStopMessage {
  event: "stop";
  sequenceNumber: string;
  stop: {
    accountSid: string;
    callSid: string;
  };
  streamSid: string;
}

export interface TwilioMarkMessage {
  event: "mark";
  sequenceNumber: string;
  mark: {
    name: string;
  };
  streamSid: string;
}

export type TwilioInboundMessage =
  | TwilioConnectedMessage
  | TwilioStartMessage
  | TwilioMediaMessage
  | TwilioStopMessage
  | TwilioMarkMessage;
