import axios, { AxiosInstance } from 'axios';
// @ts-ignore
import { MAL_CLIENT_ID } from '@env';

class MalClient {
  private clientId: string;
  apiClient: AxiosInstance;

  constructor() {
    this.clientId = MAL_CLIENT_ID;
    this.apiClient = axios.create({
      baseURL: 'https://api.myanimelist.net/v2',
      headers: {
        'X-MAL-CLIENT-ID': this.clientId,
      },
    });
  }

  async getTopicDetails(
    id: number,
    fields: string[] = [],
    limit: number = 100
  ): Promise<ForumTopicResponse> {
    try {
      const response = await this.apiClient.get(`/forum/topic/${id}`, {
        params: { fields: fields.join(','), limit },
      });
      return response.data;
    } catch (error) {
      const msg = (error as { response?: { status?: number } })?.response?.status;
      if (__DEV__) console.warn('Topic details failed:', msg ?? (error as Error)?.message);
      throw error;
    }
  }
}

export interface ForumTopicResponse {
  data: ForumTopic; // Contains the main topic data
  paging?: ForumPaging; // Pagination details for navigating through posts
}

export interface ForumTopic {
  title: string; // Title of the forum topic
  poll?: ForumPoll; // Optional poll associated with the topic
  posts: ForumPost[]; // Array of posts in the forum
}

export interface ForumPost {
  id: number; // Post ID
  number: number; // Post number in the thread
  created_at: string; // Date and time of post creation
  created_by: ForumUser; // Details of the user who created the post
  body: string; // Body content of the post
  signature?: string; // Optional signature of the user
}

export interface ForumUser {
  id: number; // User ID
  name: string; // Username
  forum_avator: string; // URL to the user's avatar image
}

export interface ForumPoll {
  id: number; // Poll ID
  question: string; // Poll question
  closed: boolean; // Whether the poll is closed
  options: ForumPollOption[]; // Array of poll options
}

export interface ForumPollOption {
  id: number; // Option ID
  text: string; // Text of the option
  votes: number; // Number of votes for the option
}

export interface ForumPaging {
  next?: string; // URL for the next page of posts, if available
  total?: number; // Total number of posts, if the API provides it
}

export default MalClient;
