import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  
  private apiUrl = `${environment.apiBaseUrl}/u/dashboard`; // Backend API URL

  constructor(private http: HttpClient, private authService: AuthService) {}
  
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: true  
  };

  // Updated method for pagination - accepts request data object
  getPurchaseOrderData(requestData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/fetch-purchase-orders`, requestData, this.httpOptions)
      .pipe(
        retry(1),
        catchError(this.handleError<any>('getPurchaseOrderData'))
      );
  }
getProductReportsData(requestData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/fetch-product-reports`, requestData, this.httpOptions)
      .pipe(
        retry(1),
        catchError(this.handleError<any>('getProductReportsData'))
      );
  }

  
getSalesReportsData(requestData: any): Observable<any> {
  return this.http.post<any>(`${this.apiUrl}/fetch-sales-reports`, requestData, this.httpOptions)
    .pipe(
      retry(1),
      catchError(this.handleError<any>('getSalesReportsData'))
    );
}
 getSalesProductsReportsData(requestData: any): Observable<any> {
  return this.http.post<any>(`${this.apiUrl}/fetch-sales-products-reports`, requestData, this.httpOptions)  
    .pipe(
      retry(1),
      catchError(this.handleError<any>('getSalesProductsReportsData'))
    );
  }

  // Updated error handler with better error handling
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      
      let errorMessage = 'An unknown error occurred';
      
      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = `Client Error: ${error.error.message}`;
      } else {
        // Server-side error
        switch (error.status) {
          case 401:
            errorMessage = 'Unauthorized. Please log in again.';
            // Optionally redirect to login
            // this.authService.logout();
            break;
          case 403:
            errorMessage = 'Access forbidden. You do not have permission.';
            break;
          case 404:
            errorMessage = 'Resource not found.';
            break;
          case 500:
            errorMessage = 'Internal server error. Please try again later.';
            break;
          default:
            errorMessage = error.error?.message || error.message || errorMessage;
        }
      }

      // Show user-friendly error message
      alert(`${operation} failed: ${errorMessage}`);
      
      // Return error observable instead of empty result for proper error handling
      return throwError(() => new Error(errorMessage));
    };
  }
}