import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DateUtilityService {

  /**
   * Safely parses a UTC string into a Date object
   * Handles various input formats and ensures UTC interpretation
   */
  private parseUtc(utcDateString: string | null | undefined | any): Date | null {
    if (!utcDateString) return null;
    
    // Handle if it's already a Date object
    if (utcDateString instanceof Date) {
      return utcDateString;
    }
    
    // Convert to string and trim
    const dateStr = String(utcDateString).trim();
    if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return null;

    try {
      let normalized = dateStr;
      
      // Handle MySQL datetime format "YYYY-MM-DDTHH:mm:ss.000Z" 
      if (normalized.includes('T') && normalized.includes('.')) {
        // Already ISO format with milliseconds
        if (!normalized.endsWith('Z') && !normalized.match(/[+-]\d{2}:?\d{2}$/)) {
          // Add Z if no timezone specified
          normalized = normalized.replace(/\.\d{3}$/, '.000Z');
        }
      }
      // Handle "YYYY-MM-DD HH:mm:ss" format (common from MySQL)
      else if (normalized.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        // This is UTC time from MySQL, add Z
        normalized = normalized.replace(' ', 'T') + 'Z';
      }
      // Handle "YYYY-MM-DDTHH:mm:ssZ" format (our backend format)
      else if (normalized.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)) {
        // Already in correct format
      }
      // Handle "YYYY-MM-DDTHH:mm:ss" format without Z
      else if (normalized.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
        // Add Z to indicate UTC
        normalized += 'Z';
      }
      // Handle date-only format "YYYY-MM-DD"
      else if (normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Assume start of day in UTC
        normalized += 'T00:00:00Z';
      }
      // Handle other space-separated formats
      else if (normalized.includes(' ') && normalized.match(/\d{4}-\d{2}-\d{2}/)) {
        // Replace space with T and add Z
        normalized = normalized.replace(' ', 'T');
        if (!normalized.endsWith('Z') && !normalized.match(/[+-]\d{2}:?\d{2}$/)) {
          normalized += 'Z';
        }
      }

      console.log(`[DateUtility] Parsing: "${utcDateString}" -> "${normalized}"`);
      const date = new Date(normalized);
      
      // Validate the parsed date
      if (isNaN(date.getTime())) {
        console.warn(`[DateUtility] Failed to parse date: ${utcDateString} (normalized: ${normalized})`);
        return null;
      }

      console.log(`[DateUtility] Parsed successfully: UTC=${date.toISOString()}, Local=${date.toLocaleString('en-IN')}`);
      return date;
    } catch (error) {
      console.error(`[DateUtility] Error parsing date: ${utcDateString}`, error);
      return null;
    }
  }

  /**
   * Converts UTC string to local Date object
   */
  utcToLocal(utcDateString: string | null | undefined): Date | null {
    return this.parseUtc(utcDateString);
  }

  /**
   * Converts UTC string → local formatted string
   */
  formatUtcToLocal(
    utcDateString: string | null | undefined,
    format: 'date' | 'time' | 'datetime' | 'short' | 'medium' | 'long' = 'medium',
    locale: string = 'en-CA' // Default to en-CA for Calgary, Canada timezone
  ): string {
    if (!utcDateString || utcDateString.trim() === '') return '';

    const date = this.parseUtc(utcDateString);
    if (!date) return '';

    try {
      const options: Intl.DateTimeFormatOptions = {};

      switch (format) {
        case 'date':
          options.year = 'numeric';
          options.month = '2-digit';
          options.day = '2-digit';
          break;
        case 'time':
          options.hour = '2-digit';
          options.minute = '2-digit';
          options.second = '2-digit';
          options.hour12 = false; // 24-hour format
          break;
        case 'datetime':
          options.year = 'numeric';
          options.month = '2-digit';
          options.day = '2-digit';
          options.hour = '2-digit';
          options.minute = '2-digit';
          options.second = '2-digit';
          options.hour12 = false; // 24-hour format
          break;
        case 'short':
          options.dateStyle = 'short';
          break;
        case 'medium':
          options.dateStyle = 'medium';
          options.timeStyle = 'short';
          break;
        case 'long':
          options.dateStyle = 'long';
          options.timeStyle = 'long';
          break;
        default:
          options.dateStyle = 'medium';
          options.timeStyle = 'short';
          break;
      }

      return new Intl.DateTimeFormat(locale, options).format(date);
    } catch (error) {
      console.error(`Error formatting date: ${utcDateString}`, error);
      return utcDateString; // Return original string as fallback
    }
  }

  /**
   * Local → UTC string (ISO format)
   */
  localToUtc(localDate: Date | string): string {
    try {
      const date = typeof localDate === 'string' ? new Date(localDate) : localDate;
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }
      return date.toISOString();
    } catch (error) {
      console.error(`Error converting to UTC: ${localDate}`, error);
      return '';
    }
  }

  /**
   * Get current timezone offset in ±HH:MM format
   */
  getTimezoneOffset(): string {
    try {
      const offset = new Date().getTimezoneOffset();
      const abs = Math.abs(offset);
      const hours = Math.floor(abs / 60).toString().padStart(2, '0');
      const minutes = (abs % 60).toString().padStart(2, '0');
      return `${offset <= 0 ? '+' : '-'}${hours}:${minutes}`;
    } catch (error) {
      console.error('Error getting timezone offset', error);
      return '+00:00';
    }
  }

  /**
   * Get timezone abbreviation (e.g., IST, EST, PST)
   */
  getTimezoneAbbreviation(): string {
    try {
      const timeString = new Date().toLocaleTimeString('en-US', { 
        timeZoneName: 'short' 
      });
      const parts = timeString.split(' ');
      return parts[parts.length - 1] || 'UTC';
    } catch (error) {
      console.error('Error getting timezone abbreviation', error);
      return 'UTC';
    }
  }

  /**
   * Get full timezone name (e.g., "Asia/Kolkata")
   */
  getTimezoneName(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch (error) {
      console.error('Error getting timezone name', error);
      return 'UTC';
    }
  }

  /**
   * Format date with custom pattern
   */
  formatWithPattern(
    utcDateString: string | null | undefined,
    pattern: string = 'yyyy-MM-dd HH:mm:ss'
  ): string {
    const date = this.parseUtc(utcDateString);
    if (!date) return '';

    try {
      // Simple pattern replacement
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');

      return pattern
        .replace(/yyyy/g, year.toString())
        .replace(/MM/g, month)
        .replace(/dd/g, day)
        .replace(/HH/g, hours)
        .replace(/mm/g, minutes)
        .replace(/ss/g, seconds);
    } catch (error) {
      console.error(`Error formatting with pattern: ${pattern}`, error);
      return utcDateString || '';
    }
  }

  /**
   * Check if a date string is valid
   */
  isValidDate(dateString: string | null | undefined): boolean {
    if (!dateString) return false;
    const date = this.parseUtc(dateString);
    return date !== null && !isNaN(date.getTime());
  }

  /**
   * Get relative time string (e.g., "2 hours ago", "in 3 days")
   */
  getRelativeTime(utcDateString: string | null | undefined): string {
    const date = this.parseUtc(utcDateString);
    if (!date) return '';

    try {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (Math.abs(diffSeconds) < 60) return 'just now';
      if (Math.abs(diffMinutes) < 60) return `${Math.abs(diffMinutes)} minute${Math.abs(diffMinutes) !== 1 ? 's' : ''} ${diffMinutes < 0 ? 'from now' : 'ago'}`;
      if (Math.abs(diffHours) < 24) return `${Math.abs(diffHours)} hour${Math.abs(diffHours) !== 1 ? 's' : ''} ${diffHours < 0 ? 'from now' : 'ago'}`;
      if (Math.abs(diffDays) < 7) return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} ${diffDays < 0 ? 'from now' : 'ago'}`;
      
      return this.formatUtcToLocal(utcDateString, 'short');
    } catch (error) {
      console.error(`Error calculating relative time: ${utcDateString}`, error);
      return this.formatUtcToLocal(utcDateString, 'short');
    }
  }
}