import { Injectable } from '@angular/core';
import { Logger } from 'src/app/logger';
import { App } from 'src/app/model/app.enum';
import { GlobalStorageService } from 'src/app/services/global.storage.service';
import { DIDSessionsStore } from 'src/app/services/stores/didsessions.store';
import { NetworkTemplateStore } from 'src/app/services/stores/networktemplate.store';
import { StoredVoteInfo } from '../model/stored-vote-info.model';

/**
 * Local storage service for mainchain polls.
 * Stores voted poll information.
 */
@Injectable({
  providedIn: 'root'
})
export class LocalStorage {
  public static instance: LocalStorage = null;

  constructor(private storage: GlobalStorageService) {
    LocalStorage.instance = this;
  }

  /**
   * Save vote information for a poll
   */
  public async saveVote(voteInfo: StoredVoteInfo): Promise<void> {
    try {
      const votes = await this.getAllVotes();
      // Update or add vote for this poll
      const existingIndex = votes.findIndex(v => v.pollId === voteInfo.pollId);
      if (existingIndex >= 0) {
        votes[existingIndex] = voteInfo;
      } else {
        votes.push(voteInfo);
      }
      await this.set('voted-polls', JSON.stringify(votes));
      Logger.log(App.MAINCHAIN_POLLS, 'Vote saved to local storage:', voteInfo.pollId);
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'Error saving vote to local storage:', err);
      throw err;
    }
  }

  /**
   * Get vote information for a specific poll
   */
  public async getVote(pollId: string): Promise<StoredVoteInfo | null> {
    try {
      const votes = await this.getAllVotes();
      return votes.find(v => v.pollId === pollId) || null;
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'Error getting vote from local storage:', err);
      return null;
    }
  }

  /**
   * Get all stored votes
   */
  public async getAllVotes(): Promise<StoredVoteInfo[]> {
    try {
      const rawVotes = await this.get('voted-polls');
      if (!rawVotes) {
        return [];
      }
      if (typeof rawVotes === 'string') {
        return JSON.parse(rawVotes);
      }
      return rawVotes;
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'Error getting all votes from local storage:', err);
      return [];
    }
  }

  /**
   * Remove vote information for a specific poll
   */
  public async removeVote(pollId: string): Promise<void> {
    try {
      const votes = await this.getAllVotes();
      const filteredVotes = votes.filter(v => v.pollId !== pollId);
      await this.set('voted-polls', JSON.stringify(filteredVotes));
      Logger.log(App.MAINCHAIN_POLLS, 'Vote removed from local storage:', pollId);
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'Error removing vote from local storage:', err);
      throw err;
    }
  }

  /**
   * Check if a poll has been voted on
   */
  public async hasVoted(pollId: string): Promise<boolean> {
    const vote = await this.getVote(pollId);
    return vote !== null;
  }

  private set(key: string, value: any): Promise<void> {
    return this.storage.setSetting(
      DIDSessionsStore.signedInDIDString,
      NetworkTemplateStore.networkTemplate,
      'mainchainpolls',
      key,
      value,
      'browserlocalstorage'
    );
  }

  private async get(key: string): Promise<any> {
    const val = await this.storage.getSetting(
      DIDSessionsStore.signedInDIDString,
      NetworkTemplateStore.networkTemplate,
      'mainchainpolls',
      key,
      null,
      'browserlocalstorage'
    );
    if (val === null) return null;
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch (e) {
        // Do nothing. Saved value is probably a real string
        return val;
      }
    }
    return val;
  }
}
