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
  module?: 'payroll_area' | 'payment_method'; // Which module to configure
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
  // Generated payroll areas (if done and module=payroll_area)
  payrollAreas?: GeneratedPayrollArea[];
  // Generated payment methods (if done and module=payment_method)
  paymentMethods?: PaymentMethodConfig[];
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
// Payment Method Types
// ============================================

export interface PaymentMethodConfig {
  code: string;
  description: string;
  used?: boolean;
  house_banks?: string;
  ach_file_spec?: string;
  check_volume?: string;
  check_number_range?: string;
  agree_no_pre_note?: boolean;
  raw_answer?: string;
  reasoning?: string[];
}

/**
 * @deprecated Use StartSessionResponse instead. Payment sessions now use the unified API.
 */
export interface StartPaymentSessionResponse {
  sessionId: string;
  question: Question;
}

/**
 * @deprecated Use SubmitAnswerRequest instead. Payment sessions now use the unified API.
 */
export interface SubmitPaymentAnswerRequest {
  sessionId: string;
  questionId: string;
  answer: string | string[];
}

/**
 * @deprecated Use SubmitAnswerResponse instead. Payment sessions now use the unified API.
 */
export interface SubmitPaymentAnswerResponse {
  sessionId: string;
  done: boolean;
  progress: number;
  question?: Question;
  paymentMethods?: PaymentMethodConfig[];
  message?: string;
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
