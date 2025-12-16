/**
 * Utility functions for payment method page
 * Used by Lovable components for combining Tailwind classes
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes without conflicts
 * Example: cn('px-2 py-1', 'px-4') => 'py-1 px-4'
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string to a precise, readable format with timezone conversion
 * Handles SQLite timestamp format (YYYY-MM-DD HH:MM:SS) and ISO 8601 format
 * 
 * @param dateString - Date string from server (e.g., "2024-12-15 17:30:45" or "2024-12-15T17:30:45.123Z")
 * @param options - Formatting options
 * @returns Formatted date string (e.g., "Dec 15, 2024, 5:30:45 PM PST" or "Never" if invalid)
 */
export function formatDateTime(
  dateString?: string | null,
  options?: {
    includeTime?: boolean; // Include time (default: true)
    format?: 'full' | 'short' | 'dateOnly'; // Format style
  }
): string {
  if (!dateString) return 'Never';

  try {
    let date: Date;
    
    // Handle SQLite timestamp format: "YYYY-MM-DD HH:MM:SS" (no timezone)
    // SQLite CURRENT_TIMESTAMP typically returns UTC time in this format
    // Parse and convert to local timezone for correct display
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
      // SQLite format: "YYYY-MM-DD HH:MM:SS"
      // First, try treating as UTC (most common case)
      // Replace space with 'T' and add 'Z' to indicate UTC
      const utcDate = new Date(dateString.replace(' ', 'T') + 'Z');
      
      if (!isNaN(utcDate.getTime())) {
        date = utcDate;
      } else {
        // Fallback: parse as local time
        const [datePart, timePart] = dateString.split(' ');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes, seconds] = timePart.split(':').map(Number);
        date = new Date(year, month - 1, day, hours, minutes, seconds);
      }
    } else {
      // ISO format (e.g., "2024-12-15T17:30:45.123Z") or other formats
      date = new Date(dateString);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    const { includeTime = true, format = 'full' } = options || {};

    // Date only format
    if (format === 'dateOnly') {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }

    // Full format with time (includes seconds and timezone)
    if (format === 'full' && includeTime) {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZoneName: 'short',
      });
    }

    // Short format (without seconds, includes timezone)
    if (format === 'short') {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short',
      });
    }

    // Default: full format with timezone
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
  } catch (error) {
    return dateString; // Return original string if parsing fails
  }
}
