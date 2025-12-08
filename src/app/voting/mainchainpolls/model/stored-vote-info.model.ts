/**
 * Stored vote information for a poll.
 * Shares base content with PollDetails (status, description, startTime, endTime, choices)
 * and adds vote-specific information (pollId, voteAmount, voteTimestamp, option).
 */
export interface StoredVoteInfo {
  pollId: string; // Poll ID
  voteAmount: string; // Vote amount in sELA (smallest unit) as string
  voteTimestamp: number; // Unix timestamp when vote was cast
  option: number; // Selected choice index
}
