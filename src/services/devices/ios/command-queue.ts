import { v4 as uuidv4 } from 'uuid';

export enum CommandStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  ACKNOWLEDGED = 'acknowledged',
  ERROR = 'error',
  NOT_NOW = 'not_now',
  COMMAND_ERROR = 'command_error'
}

export interface MDMCommand {
  id: string;
  deviceId: string;
  commandUUID: string;
  commandType: string;
  payload: any;
  status: CommandStatus;
  priority: number;
  createdAt: Date;
}

//TODO:  Commands need to go into db later.  Maybe need redis as buffer.

// in-memory command queues keyed by device UDID
const commandQueues: Map<string, MDMCommand[]> = new Map();

function ensureQueue(deviceId: string): MDMCommand[] {
  let queue = commandQueues.get(deviceId);
  if (!queue) {
    queue = [];
    commandQueues.set(deviceId, queue);
  }
  return queue;
}

/**
 * Add a command to a device's queue.  Commands are sorted by priority (desc)
 * then by creation time.
 */
export function addCommand(
  deviceId: string,
  commandType: string,
  payload: any,
  priority = 1
): MDMCommand {
  const queue = ensureQueue(deviceId);
  //TODO Need to check if same command get put in.
  const command: MDMCommand = {
    id: uuidv4(),
    deviceId,
    commandUUID: uuidv4(),
    commandType,
    payload,
    status: CommandStatus.QUEUED,
    priority,
    createdAt: new Date()
  };
  queue.push(command);
  queue.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return command;
}

export function getCommands(deviceId: string): MDMCommand[] {
  return ensureQueue(deviceId);
}

//TODO : Need to get Next Not now command if its already in queue for N seconds
export function getNextCommand(deviceId: string): MDMCommand | null {
  const queue = ensureQueue(deviceId);
  const cmd = queue.find(c => c.status === CommandStatus.QUEUED);
  return cmd || null;
}

/**
 * Update command status.
 * Remove command from the queue if status is ACKNOWLEDGED or ERROR
 * */
export function updateCommandStatus(
  deviceId: string,
  commandUUID: string,
  status: CommandStatus
): MDMCommand | null {
  const queue = ensureQueue(deviceId);
  const cmd = queue.find(c => c.commandUUID === commandUUID);
  if (!cmd) return null;
  cmd.status = status;
  if (
    status === CommandStatus.ACKNOWLEDGED ||
    status === CommandStatus.ERROR
  ) {
    const idx = queue.indexOf(cmd);
    if (idx !== -1) queue.splice(idx, 1);
  }
  return cmd;
}
