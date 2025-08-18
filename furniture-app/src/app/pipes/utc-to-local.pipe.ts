import { Pipe, PipeTransform } from '@angular/core';
import { DateUtilityService } from '../services/date-utility.service';

@Pipe({
  name: 'utcToLocal',
  pure: true // Mark as pure for better performance
})
export class UtcToLocalPipe implements PipeTransform {

  constructor(private dateUtilityService: DateUtilityService) {}

  /**
   * Transform UTC date string to local formatted string
   * @param value - UTC date string
   * @param format - Format type
   * @param locale - Locale for formatting (optional)
   * @returns Formatted local date string
   */
  transform(
    value: string | null | undefined, 
    format: 'date' | 'time' | 'datetime' | 'short' | 'medium' | 'long' | 'relative' | 'custom' = 'medium',
    customPattern?: string,
    locale?: string
  ): string {
    
    // Handle null/undefined/empty values
    if (!value || value.trim() === '') {
      return '';
    }

    try {
      // Handle special formats
      if (format === 'relative') {
        return this.dateUtilityService.getRelativeTime(value);
      }

      if (format === 'custom' && customPattern) {
        return this.dateUtilityService.formatWithPattern(value, customPattern);
      }

      // Use the service for standard formatting
      if (format === 'custom') {
        // Should not reach here, but fallback just in case
        return customPattern ? this.dateUtilityService.formatWithPattern(value, customPattern) : value;
      }
      return this.dateUtilityService.formatUtcToLocal(value, format as 'date' | 'time' | 'datetime' | 'short' | 'medium' | 'long', locale);
      
    } catch (error) {
      console.error('UtcToLocalPipe error:', error);
      // Return original value as fallback
      return value;
    }
  }
}