import { PollStatus } from './poll-status.enum';
import { Vote } from './vote.model';

export interface PollDetails {
  status: PollStatus; // Status of poll
  description: string; // Description of poll
  startTime: number; // int64 - Unix timestamp
  endTime: number; // int64 - Unix timestamp
  choices: string[]; // Choices of poll
  votes: Vote[]; // Votes of poll
}
