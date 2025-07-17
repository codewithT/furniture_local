import { Injectable } from '@angular/core';
import { catchError, Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Purchase } from '../models/purchases.model';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { PaginationResponse } from '../models/supplier.model';
import { HttpParams } from '@angular/common/http';
@Injectable({
  providedIn: 'root'
})
export class PurchaseService {
  private apiUrl = `${environment.apiBaseUrl}/u/purchase`; // Adjust URL if needed
  private supplierApiUrl =  `${environment.supplierApiUrl}`; 
  constructor(private http: HttpClient, private authService : AuthService) {}

  // Set headers for session-based authentication
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: true // Ensures cookies/session persistence
  };
  
  getPurchases(page: number, limit: number,sortBy: string = 'PurchaseID', sortOrder: string = 'desc'): Observable<PaginationResponse<Purchase>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('sortBy', sortBy)
      .set('sortOrder', sortOrder);

    return this.http.get<PaginationResponse<Purchase>>(
      this.apiUrl,
      { ...this.httpOptions, params }
    ).pipe(
      catchError(this.handleError<PaginationResponse<Purchase>>('getPurchases', {
        data: [],
        pagination: {
          total: 0,
          per_page: limit,
          current_page: page,
          last_page: 0,
          from: 0,
          to: 0,
          has_more_pages: false
        }
      }))
    );
}

  // mails senders
 

// add purchase : 
addPurchase(purchase : Purchase) : Observable<any>{ 
  console.log(" hitting purchase ", purchase);
  return this.http.post<any>(`${this.apiUrl}/addPurchase`, purchase, this.httpOptions)
  .pipe(catchError(this.handleError<any>('Error on adding purchase', [])));
}

  editPurchase(purchase : Purchase) : Observable<any>{
    const currentUserEmail = this.authService.getCurrentUser();
    console.log("currentUserEmail", currentUserEmail);
    const purchaseData= {... purchase, Changed_by : currentUserEmail};
    return this.http.put<any>(`${this.apiUrl}/${purchase.PurchaseID}`,purchaseData,  this.httpOptions)
    .pipe(catchError(this.handleError<any>('Error on updating purchase', [])));
  }

  deletePurchase(purchaseID: number) : Observable<any> {
    
    return this.http.delete<any> (`${this.apiUrl}/${purchaseID}`,this.httpOptions).
    pipe(catchError(this.handleError<any>('Error on delete purchase', [])));
  }

  searchPurchases(query: string, page: number, limit: number, sortBy: string, sortOrder: string) : Observable<Purchase[]> {
    const params = new HttpParams()
      .set('query', query)
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<Purchase[]>(
      `${this.apiUrl}/search`,
      { ...this.httpOptions, params }
    ).pipe(
      catchError(this.handleError<any>('Error on searching purchases', []))
    );
     
  }


  sendMail(purchases : Purchase[]):Observable<any>{
    return this.http.post<any>(`${this.apiUrl}/send-mails`, purchases,  this.httpOptions)
    .pipe(catchError(this.handleError<any>('error sending mails', [])));
  }

  saveToSendMail(purchases : Purchase[]) : Observable<any>{
     return this.http.post<any>(`${this.apiUrl}/save-ToSendMail`, purchases, this.httpOptions)
     .pipe(catchError(this.handleError<any>('Error creating PO number', [])));
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
