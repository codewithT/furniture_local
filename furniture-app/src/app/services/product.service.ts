import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Product } from '../models/product.model';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = `${environment.apiBaseUrl}/u/products`; // Backend API URL

  constructor(private http: HttpClient, private authService : AuthService) {}

 
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: true  
  };

  // Fetch all suppliers
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrl, this.httpOptions)
      .pipe(catchError(this.handleError<Product[]>('getProductDetails', [])));
  }

  
  // Add  add-product
  addProduct(product: Product): Observable<Product> {
    const currentUserEmail = this.authService.getCurrentUser();  
    const productData = { ...product, Created_by: currentUserEmail };  

    return this.http.post<Product>(`${this.apiUrl}/add-product`, productData, this.httpOptions)
      .pipe(catchError(this.handleError<Product>('add Product')));
  }

  // Update an existing supplier
  updateProduct(product: Product): Observable<Product> {
    const currentUserEmail = this.authService.getCurrentUser();
    const productData = { ...product, Changed_by: currentUserEmail };
    return this.http.put<Product>(`${this.apiUrl}/update-product`, productData, this.httpOptions)
      .pipe(catchError(this.handleError<Product>('updateProduct')));
  }
  

  // Delete a supplier
  deleteProduct(productId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${productId}`, this.httpOptions)
      .pipe(catchError(this.handleError<void>('delete Product')));
  }
   // Search Suppliers with Pagination
   searchProducts(query: string): Observable<Product[]> {
    return this.http.get<Product[]>(
      `${this.apiUrl}/search?query=${encodeURIComponent(query)}`,
      this.httpOptions
    ).pipe(catchError(this.handleError<Product[]>('searchSuppliers', [])));
  }
  
  // Check if supplier code is valid
  checkSupplierCode(code: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/supplier/validate-code/${encodeURIComponent(code)}`, this.httpOptions)
      .pipe(catchError(this.handleError<boolean>('checkSupplierCode', false)));
  }
  
  // Get supplier ID by code
  getSupplierIdByCode(code: string): Observable<number> { 
    return this.http.get<number>(`${this.apiUrl}/supplier/id-by-code/${encodeURIComponent(code)}`, this.httpOptions)
      .pipe(catchError(this.handleError<number>('getSupplierIdByCode', 0)));
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
