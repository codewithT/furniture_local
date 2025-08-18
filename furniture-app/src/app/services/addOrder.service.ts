import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class AddOrderService {
  
  private supplierApiUrl = `${environment.apiBaseUrl}/u/supplier`;
  private addOrderApiUrl = `${environment.apiBaseUrl}/u/addOrders`;
  private orderDetailUrl= `${environment.apiBaseUrl}/u/order-details`;
  private productSearchUrl = `${environment.apiBaseUrl}/u/product-search`;
  
  constructor(private http: HttpClient) {}

  // Set headers for session-based authentication
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: true // Ensures cookies/session persistence
  };

  // Search products by product code (new method)
  searchProductsByCode(searchTerm: string): Observable<any[]> {
    if (!searchTerm.trim()) {
      return of([]);
    }
    return this.http.get<any[]>(`${this.productSearchUrl}/${searchTerm}`, this.httpOptions)
      .pipe(
        catchError(this.handleError<any[]>('searchProductsByCode', []))
      );
  }

  // Get product details by product code (new method)
  getProductDetailsByCode(productCode: string): Observable<any> {
    return this.http.get<any>(`${this.productSearchUrl}/details/${productCode}`, this.httpOptions)
      .pipe(
        catchError(this.handleError<any>('getProductDetailsByCode', null))
      );
  }

  // Fetch supplier details based on productCode
  getSupplierCodesByProductCode(productCode: string): Observable<any> {
    return this.http.get<any>(`${this.supplierApiUrl}/${productCode}`, this.httpOptions)
      .pipe(
        catchError(this.handleError<any>('getSupplierCodes', []))
      );
  }

  // Fetch Product ID based on ProductCode and SupplierID
  getProductID(ProductCode: string, SupplierID: number): Observable<any[]> {
    const data = { ProductCode, SupplierID };
    return this.http.post<any[]>(`${this.supplierApiUrl}/getProductID`, data, this.httpOptions)
      .pipe(
        catchError(this.handleError<any[]>('getProductID', []))  
      );
  }

  // Submit checked order
  submitCheckedOrder(orderData: any): Observable<any> {
    console.log(orderData);
    return this.http.post<any>(`${this.addOrderApiUrl}/submit-purchase`, orderData, this.httpOptions)
      .pipe(
        catchError(this.handleError<any[]>('submit order error', [])) 
      );
  }

  // update orders
  getOrderById(soNumber : string) {
    return this.http.get<any>(`${this.orderDetailUrl}/${soNumber}`, this.httpOptions)
      .pipe(
        catchError(this.handleError<any[]>('order details by SO', []))
      );
  }
 
  // Handle HTTP errors
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      alert(`${operation} failed: ${error.message}`); // Show error to user
      return of(result as T); // Return safe fallback value
    };
  }
}