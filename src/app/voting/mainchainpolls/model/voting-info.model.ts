export interface VotingInfo {
  id: string; // uint256 - hex string
  status: string; // Status of voting
  description: string; // Description of voting
  startTime: number; // uint64 - Unix timestamp
  endTime: number; // uint64 - Unix timestamp
  choices: string[]; // Choices of voting
}
