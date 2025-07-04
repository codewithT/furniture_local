import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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

  getReceivedProducts(page = 1, limit = 10): Observable<{
  data: ReceivedProduct[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
}> {
  return this.http.get<{
    data: ReceivedProduct[];
    totalItems: number;
    totalPages: number;
    currentPage: number;
    itemsPerPage: number;
  }>(`${this.apiUrl}?page=${page}&limit=${limit}`, this.httpOptions)
  .pipe(catchError(this.handleError<any>('Get about to receive products', {
    data: [],
    totalItems: 0,
    totalPages: 0,
    currentPage: page,
    itemsPerPage: limit
  })));
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
