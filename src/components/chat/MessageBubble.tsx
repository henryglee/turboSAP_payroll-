/**
 * MessageBubble - Displays a single message in the chat interface.
 *
 * System messages appear on the left with question content.
 * User messages appear on the right with selected answer.
 */

import type { ChatMessage, Question } from '../../types/chat';
import './chat.css';

interface MessageBubbleProps {
  message: ChatMessage;
  onSelectOption?: (questionId: string, answer: string | string[]) => void;
  isLatest?: boolean;
}

export function MessageBubble({ message, onSelectOption, isLatest }: MessageBubbleProps) {
  // User message (answer) - right side
  if (message.type === 'user') {
    return (
      <div className="message message-user">
        <div className="bubble bubble-user">
          {Array.isArray(message.selectedOptions)
            ? message.selectedOptions.join(', ')
            : message.content}
        </div>
      </div>
    );
  }

  // Result message
  if (message.type === 'result') {
    return (
      <div className="message message-system">
        <div className="bubble bubble-result">
          {message.content}
        </div>
      </div>
    );
  }

  // System message (question) - left side
  const question = message.question;

  return (
    <div className="message message-system">
      <div className="bubble bubble-system">
        <p className="question-text">{message.content}</p>

        {/* Show option buttons only for the latest question */}
        {isLatest && question && onSelectOption && (
          <QuestionOptions
            question={question}
            onSelect={(answer) => onSelectOption(question.id, answer)}
          />
        )}
      </div>
    </div>
  );
}

interface QuestionOptionsProps {
  question: Question;
  onSelect: (answer: string | string[]) => void;
}

function QuestionOptions({ question, onSelect }: QuestionOptionsProps) {
  // Multiple select - checkboxes
  if (question.type === 'multiple_select') {
    return (
      <MultiSelectOptions
        options={question.options || []}
        onSubmit={onSelect}
      />
    );
  }

  // Text input
  if (question.type === 'text') {
    return (
      <TextInput
        placeholder={question.placeholder}
        onSubmit={(text) => onSelect(text)}
      />
    );
  }

  // Multiple choice - buttons
  return (
    <div className="options-container">
      {question.options?.map((option) => (
        <button
          key={option.id}
          className="option-button"
          onClick={() => onSelect(option.id)}
        >
          <span className="option-label">{option.label}</span>
          {option.description && (
            <span className="option-description">{option.description}</span>
          )}
        </button>
      ))}
    </div>
  );
}

interface MultiSelectOptionsProps {
  options: Array<{ id: string; label: string; description?: string }>;
  onSubmit: (selected: string[]) => void;
}

function MultiSelectOptions({ options, onSubmit }: MultiSelectOptionsProps) {
  const [selected, setSelected] = React.useState<string[]>([]);

  const toggleOption = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  return (
    <div className="options-container">
      {options.map((option) => (
        <button
          key={option.id}
          className={`option-button option-checkbox ${
            selected.includes(option.id) ? 'selected' : ''
          }`}
          onClick={() => toggleOption(option.id)}
        >
          <span className="checkbox-indicator">
            {selected.includes(option.id) ? '✓' : '○'}
          </span>
          <span className="option-label">{option.label}</span>
          {option.description && (
            <span className="option-description">{option.description}</span>
          )}
        </button>
      ))}
      <button
        className="submit-button"
        disabled={selected.length === 0}
        onClick={() => onSubmit(selected)}
      >
        Continue ({selected.length} selected)
      </button>
    </div>
  );
}

interface TextInputProps {
  placeholder?: string;
  onSubmit: (text: string) => void;
}

function TextInput({ placeholder, onSubmit }: TextInputProps) {
  const [value, setValue] = React.useState('');

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <div className="text-input-container">
      <input
        type="text"
        className="text-input"
        placeholder={placeholder || 'Type your answer...'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
        }}
      />
      <button
        className="submit-button"
        disabled={!value.trim()}
        onClick={handleSubmit}
      >
        Submit
      </button>
    </div>
  );
}

// Need to import React for useState
import React from 'react';
