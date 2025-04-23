import { Injectable } from '@angular/core';
import { catchError, Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Purchase } from '../models/purchases.model';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ShowToSupplierService {
 
  private supplierApiUrl = `${environment.supplierApiUrl}`; 
  
  constructor(private http: HttpClient) {}

   
  
  // Get purchase orders for supplier
  getPurchaseOrders(email: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.supplierApiUrl}/confirm/${encodeURIComponent(email)}`)
      .pipe(catchError(this.handleError<any[]>('Error on getting purchase requests', [])));
  }

  // Send confirmations to backend
  sendConfirmations(email: string, confirmations: { [key: string]: { status: string, delayedDate?: string } }): Observable<any> {
    return this.http.post(`${this.supplierApiUrl}/confirm/${encodeURIComponent(email)}`, confirmations)
      .pipe(catchError(this.handleError<any>('Error on sending confirmations', {})));
  }
  
  // Handle HTTP errors
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      alert(`${operation} failed: ${error.message}`); // Show error to user
      return new Observable<T>((observer) => {
        observer.next(result as T);
        observer.complete();
      });
    };
  }
}