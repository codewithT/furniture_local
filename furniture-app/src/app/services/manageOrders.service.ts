import { Injectable } from '@angular/core';
import { catchError, Observable } from 'rxjs';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Order } from '../models/order.model';
import { environment } from '../../environments/environment';

export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  sortField?: string;
  sortOrder?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalRecords: number;
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ManageOrderService {
  private apiUrl = `${environment.apiBaseUrl}/u/manageOrders`;  

  constructor(private http: HttpClient, private authService: AuthService) {}

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: true  
  };

  getOrders(params?: PaginationParams): Observable<PaginatedResponse<Order>> {
    let httpParams = new HttpParams();

    if (params) {
      httpParams = httpParams.set('page', params.page.toString());
      httpParams = httpParams.set('limit', params.limit.toString());
      
      if (params.search && params.search.trim()) {
        httpParams = httpParams.set('search', params.search.trim());
      }
      
      if (params.sortField) {
        httpParams = httpParams.set('sortField', params.sortField);
      }
      
      if (params.sortOrder) {
        httpParams = httpParams.set('sortOrder', params.sortOrder);
      }
    }

    const options = {
      ...this.httpOptions,
      params: httpParams
    };

    // Debug log to see what's being sent
    console.log('API Request URL:', this.apiUrl);
    console.log('API Request Params:', {
      page: params?.page,
      limit: params?.limit,
      search: params?.search,
      sortField: params?.sortField,
      sortOrder: params?.sortOrder
    });

    return this.http.get<PaginatedResponse<Order>>(this.apiUrl, options)
      .pipe(catchError(this.handleError<PaginatedResponse<Order>>('get orders', {
        data: [],
        totalRecords: 0,
        currentPage: 1,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      })));
  }

  removeOrder(order: Order): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${order.SalesID}`, this.httpOptions)
      .pipe(catchError(this.handleError<any>('Error Deleting Sale Order', [])));
  }
    
  /**
   * Send generic order emails (existing)
   */
  sendMails(orders: Order[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/send-mails`, { orders }, this.httpOptions)
      .pipe(catchError(this.handleError<any>('Error sending mails', [])));
  }

  /**
   * Send payment reminder emails for selected orders
   */
  sendPaymentReminders(orders: Order[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/send-payment-reminders`, { orders }, this.httpOptions)
      .pipe(catchError(this.handleError<any>('Error sending payment reminders', [])));
  }

  updateOrder(order: Order): Observable<any> {
    const updatePaymentStatus = {
      SalesID: order.SalesID,
      Payment_Status: order.Payment_Status
    };
    return this.http.put(`${this.apiUrl}/update-payment-status`, updatePaymentStatus, this.httpOptions)
      .pipe(catchError(this.handleError<any>('Error updating payment status', [])));
  }
  
  deleteProductFromOrder(soNumber: string, productCode: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/order-details/${soNumber}/product/${productCode}`, this.httpOptions)
      .pipe(catchError(this.handleError<any>('Error deleting product from order', [])));
  }

    
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      alert(`${operation} failed: ${error.message}`);
      return new Observable<T>((observer) => {
        observer.next(result as T);
        observer.complete();
      });
    };
  }
}