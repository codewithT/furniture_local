import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
export interface ReceivedProduct {
    PurchaseID: number;
  SupplierCode: string;
  Supplier_Date: string; // pick up date
  PONumber: string;
  ProductCode: string;
  ProductName: string;
  POStatus: string;
  SONumber?: string;
  Customer_name?: string;
  ShipToParty?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReceiveProductsService {
private apiUrl = `${environment.apiBaseUrl}/u/receive`;

  constructor(private http: HttpClient) {}
 private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: true  
  };

  getReceivedProducts(
    page: number = 1, 
    limit: number = 10, 
    search: string = '', 
    sortField: string = '', 
    sortDirection: 'asc' | 'desc' = 'asc'
  ): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    
    if (search.trim()) {
      params = params.set('search', search.trim());
    }
    
    if (sortField) {
      params = params.set('sortField', sortField);
      params = params.set('sortDirection', sortDirection);
    }

    return this.http.get<any>(
      `${this.apiUrl}/received-products`,
      { ...this.httpOptions, params }
    )
      .pipe(catchError(this.handleError<any>('getReceivedProducts', { data: [], totalItems: 0, totalPages: 0, currentPage: 1 })));   
  }
    updateStatus(product: ReceivedProduct): Observable<any> {
        return this.http.put(`${this.apiUrl}/${product.PurchaseID}`, product, this.httpOptions)
          .pipe(catchError(this.handleError<any>('Update product Status', [])));
    }

     // Handle HTTP errors
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
