import { Vote } from './vote.model';

export interface VotingDetails {
  status: string; // Status of voting
  description: string; // Description of voting
  startTime: number; // int64 - Unix timestamp
  endTime: number; // int64 - Unix timestamp
  choices: string[]; // Choices of voting
  votes: Vote[]; // Votes of voting
}

