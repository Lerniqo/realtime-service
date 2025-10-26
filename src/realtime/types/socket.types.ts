export interface UserData {
  userId: string;
  role: string;
  email: string;
}

export interface CustomSocketData extends Record<string, unknown> {
  user?: UserData;
}

export interface PlayerStatus {
  timer?: number;
  score?: number;
  activeQuestionIndex?: number;
}

import { Socket } from 'socket.io';

export interface MatchAnswers {
  [questionId: string]: string;
}

export interface TypedSocket extends Socket {
  user?: UserData;
}

export interface QuestionData {
  id: number | string;
  question?: string;
  options?: string[];
  concepts?: string[];
}

export type GameQuestions = QuestionData[];
