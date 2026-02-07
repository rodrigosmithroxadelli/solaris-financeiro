import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FormattingService {

  constructor() { }

  /**
   * Formats a number as a Brazilian currency string (BRL).
   * @param value The number to format.
   * @returns A string like "R$ 1.234,56".
   */
  formatCurrency(value: number): string {
    if (typeof value !== 'number') {
      value = 0;
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  /**
   * Formats a date-like value into a Brazilian date string.
   * @param date The date value (can be Date, string, or timestamp).
   * @returns A string like "dd/mm/aaaa".
   */
  formatDate(date: any): string {
    if (!date) {
      return '';
    }

    let dateObj: Date;
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
      dateObj = new Date(date);
    } else if (date.toDate && typeof date.toDate === 'function') {
      // Handle Firestore Timestamps
      dateObj = date.toDate();
    } else {
      return '';
    }

    if (isNaN(dateObj.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(dateObj);
  }
}
