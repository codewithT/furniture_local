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
    
  sendMails(orders: Order[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/send-mails`, { orders }, this.httpOptions)
      .pipe(catchError(this.handleError<any>('Error sending mails', [])));
  }

  updateOrder(order: Order): Observable<any> {
    const updatePaymentStatus = {
      SalesID: order.SalesID,
      Payment_Status: order.Payment_Status
    };
    return this.http.put(`${this.apiUrl}/update-payment-status`, updatePaymentStatus, this.httpOptions)
      .pipe(catchError(this.handleError<any>('Error updating payment status', [])));
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