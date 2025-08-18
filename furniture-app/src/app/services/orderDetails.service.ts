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
export class OrderDetailsService {
  private apiUrl = `${environment.apiBaseUrl}/u/order-details`;  

  constructor(private http: HttpClient, private authService: AuthService) {}

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: true  
  };
 

  updateOrder(order: Order): Observable<any> {
    const updatePaymentStatus = {
      SalesID: order.SalesID,
      Payment_Status: order.Payment_Status
    };
    return this.http.put(`${this.apiUrl}/update-payment-status`, updatePaymentStatus, this.httpOptions)
      .pipe(catchError(this.handleError<any>('Error updating payment status', [])));
  }
  
  deleteProductFromOrder(soNumber: string, productCode: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${soNumber}/product/${productCode}`, this.httpOptions)
      .pipe(catchError(this.handleError<any>('Error deleting product from order', [])));
  }
   // Update order by SONumber
    completeUpdateOrder(soNumber: string, updateData: any): Observable<any> {
      return this.http.put<any>(`${this.apiUrl}/${soNumber}`, updateData, this.httpOptions)
        .pipe(
          catchError(this.handleError<any>('update order', null))
        );
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