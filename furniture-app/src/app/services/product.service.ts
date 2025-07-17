import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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

  constructor(private http: HttpClient, private authService: AuthService) {}

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: true  
  };

  // Excel upload methods
  uploadProductExcel(formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/upload-excel`, formData, {
      withCredentials: true
      
    }).pipe(catchError(this.handleError<any>('uploadProductExcel')));
  }

  checkUploadProgress(jobId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/job-progress/${jobId}`, this.httpOptions)
      .pipe(catchError(this.handleError<any>('checkUploadProgress')));
  }

  cancelUploading(jobId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cancel-job`, { jobId }, this.httpOptions)
      .pipe(catchError(this.handleError<any>('cancelUpload')));
  }

  // Fetch all products
  getProducts(paginationParams: any): Observable<Product[]> {
    
    const httpParams = new HttpParams()
      .set('page', paginationParams.page.toString())
      .set('limit', paginationParams.limit.toString())
      .set('sortColumn', paginationParams.sortColumn || 'created_date')
      .set('sortDirection', paginationParams.sortDirection || 'desc');

    return this.http.get<any>(`${this.apiUrl}`, { params: httpParams, ...this.httpOptions })
      .pipe(catchError(this.handleError<any>('getProducts', { data: [], pagination: {} })));
  }

  // Add product
  addProduct(product: Product): Observable<Product> {
    const currentUserEmail = this.authService.getCurrentUser();  
    const productData = { ...product, Created_by: currentUserEmail };  

    return this.http.post<Product>(`${this.apiUrl}/add-product`, productData, this.httpOptions)
      .pipe(catchError(this.handleError<Product>('add Product')));
  }

  updateProduct(formData: FormData): Observable<any> {
  const currentUserEmail = this.authService.getCurrentUser();
  formData.append('Changed_by', currentUserEmail);
  return this.http.put(`${this.apiUrl}/update-product`, formData, {
    withCredentials: true,
    // Don't set content-type header for FormData
  })
    .pipe(catchError(this.handleError<any>('updateProduct')));
}
 
uploadProductImage(productId: number, formData: FormData) {

  return this.http.post(`${this.apiUrl}/${productId}/image`, formData, {withCredentials: true})
    .pipe(catchError(this.handleError<any>('uploadProductImage')));
}

  // Delete a product
  deleteProduct(productId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${productId}`, this.httpOptions)
      .pipe(catchError(this.handleError<void>('delete Product')));
  }

  // Search products with Pagination
  // Search products with Pagination and Sorting
  searchProducts(
    searchTerm: string,
    paginationParams: { page: number; limit: number; sortColumn?: string; sortDirection?: string }
  ): Observable<any> {
    const { page, limit, sortColumn = 'created_date', sortDirection = 'desc' } = paginationParams;
    const httpParams = new HttpParams()
      .set('query', searchTerm)
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('sortColumn', sortColumn)
      .set('sortDirection', sortDirection);

    return this.http.get<any>(`${this.apiUrl}/search`, {
      params: httpParams,
      ...this.httpOptions
    }).pipe(catchError(this.handleError<any>('searchProducts', { data: [], pagination: {} })));
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