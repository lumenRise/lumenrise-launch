import type { ConfirmChannel, ConsumeMessage } from 'amqplib';

import type { DomainRequest, DomainHandler } from '../../types/messaging/domain';

const handleDomainMessage = async (
  channel: ConfirmChannel,
  message: ConsumeMessage,
  handler: DomainHandler,
): Promise<void> => {
  let request: DomainRequest;

  try {
    request = JSON.parse(message.content.toString()) as DomainRequest;

    if (
      !message.properties.replyTo ||
      !message.properties.correlationId ||
      !Number.isFinite(request.deadline) ||
      request.deadline <= Date.now() ||
      request.deadline > Date.now() + 30000 ||
      typeof request.operation !== 'string' ||
      !request.parameters ||
      typeof request.parameters !== 'object' ||
      Array.isArray(request.parameters) ||
      message.content.length > 1048576
    ) {
      channel.ack(message);

      return;
    }
  } catch {
    channel.ack(message);

    return;
  }

  let reply;

  try {
    reply = { ok: true, result: await handler(request) };
  } catch (error) {
    reply = { ok: false, error: error instanceof Error ? error.message : 'Domain request failed' };
  }

  if (Date.now() < request.deadline) {
    channel.sendToQueue(message.properties.replyTo!, Buffer.from(JSON.stringify(reply)), {
      correlationId: message.properties.correlationId,
      contentType: 'application/json',
      expiration: String(Math.max(1, request.deadline - Date.now())),
    });

    await channel.waitForConfirms();
  }

  channel.ack(message);
};

export default handleDomainMessage;
