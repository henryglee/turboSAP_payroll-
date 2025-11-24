// Chat system types - decoupled from UI components
// These types define the contract between UI and LangGraph backend

// ============================================
// Question Types
// ============================================

export type QuestionType = 'multiple_choice' | 'multiple_select' | 'text';

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: QuestionOption[];
  placeholder?: string;
  // Conditional display - only show if previous answer matches
  showIf?: {
    questionId: string;
    answerId: string | string[];
  };
}

// ============================================
// Message Types (for chat display)
// ============================================

export type MessageType = 'system' | 'user' | 'result';

export interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  timestamp: Date;
  // For system messages that show a question
  question?: Question;
  // For user messages that show their answer
  selectedOptions?: string[];
}

// ============================================
// API Request/Response Types
// ============================================

export interface StartSessionRequest {
  companyName?: string;
}

export interface StartSessionResponse {
  sessionId: string;
  question: Question;
}

export interface SubmitAnswerRequest {
  sessionId: string;
  questionId: string;
  // For multiple_choice: single string
  // For multiple_select: array of strings
  // For text: string
  answer: string | string[];
}

export interface SubmitAnswerResponse {
  sessionId: string;
  done: boolean;
  progress: number; // 0-100
  // Next question (if not done)
  question?: Question;
  // Generated payroll areas (if done)
  payrollAreas?: GeneratedPayrollArea[];
  // Any messages to display
  message?: string;
}

// ============================================
// Generated Output Types
// ============================================

export interface GeneratedPayrollArea {
  code: string;
  description: string;
  frequency: string;
  periodPattern: string;
  payDay: string;
  calendarId: string;
  employeeCount: number;
  businessUnit?: string;
  region?: string;
  reasoning: string[];
}

// ============================================
// Chat State (for UI state management)
// ============================================

export interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  currentQuestion: Question | null;
  answers: Record<string, string | string[]>;
  isComplete: boolean;
  isLoading: boolean;
  progress: number;
  error: string | null;
}

// Initial state factory
export function createInitialChatState(): ChatState {
  return {
    sessionId: null,
    messages: [],
    currentQuestion: null,
    answers: {},
    isComplete: false,
    isLoading: false,
    progress: 0,
    error: null,
  };
}
