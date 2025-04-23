import { Injectable } from '@angular/core';
import { catchError, Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Order } from '../models/order.model';
import { environment } from '../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class ManageOrderService{
    private apiUrl = `${environment.apiBaseUrl}/u/manageOrders`;  
    constructor(private http: HttpClient, private authService : AuthService) {}
    private httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        }),
        withCredentials: true  
      };
    getOrders() : Observable<any> {
        return this.http.get<any>(this.apiUrl, this.httpOptions)
    .pipe(catchError(this.handleError<any>('get orders', [])));
    }

    removeOrder(order : Order):Observable<any>{
      return this.http.delete<any>(`${this.apiUrl}/${order.SalesID}` , this.httpOptions)
      .pipe(catchError(this.handleError<any>('Error Deleting Sale Order',[])));
    }
    
    sendMails(orders: Order[]) : Observable<any>{
        return this.http.post<any>(`${this.apiUrl}/send-mails`,{ orders} , this.httpOptions)
        .pipe(catchError(this.handleError<any>('Error sending mails',[])));
    }
    updateOrder(order : Order): Observable<any> {
      const updatePaymentStatus = {
        SalesID : order.SalesID,
        Payment_Status : order.Payment_Status
      }
      return this.http.put(`${this.apiUrl}/update-payment-status`, updatePaymentStatus , this.httpOptions).
      pipe(catchError(this.handleError<any>('Error updating payment status',[])))
    }
    
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