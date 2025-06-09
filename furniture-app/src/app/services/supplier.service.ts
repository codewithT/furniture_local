import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Supplier, PaginationResponse } from '../models/supplier.model';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  private apiUrl = `${environment.apiBaseUrl}/u/supplier`; // Backend API URL

  constructor(private http: HttpClient, private authService: AuthService) {}

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: true  
  };

  /**
   * Get paginated suppliers
   * This method is needed by the component for pagination
   */
  getSuppliers(page: number, limit: number): Observable<PaginationResponse<Supplier>> {
    return this.http.get<PaginationResponse<Supplier>>(
      `${this.apiUrl}?page=${page}&limit=${limit}`, 
      this.httpOptions
    ).pipe(catchError(this.handleError<PaginationResponse<Supplier>>('getSuppliers', {
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
    })));
  }

  /**
   * Get all suppliers (non-paginated)
   * Use this when you need the full list without pagination
   */
  getSupplierDetails(): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(this.apiUrl, this.httpOptions)
      .pipe(catchError(this.handleError<Supplier[]>('getSupplierDetails', [])));
  }

  /**
   * Upload Excel file with suppliers data
   */
  uploadExcelFile(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/upload-excel`, formData, {
      reportProgress: true,
       observe: 'events',
      withCredentials: true 
    })
    .pipe(catchError(this.handleError<any>('uploadExcelFile')));
  }

  /**
   * Add a new supplier
   */
  addSupplier(supplier: Supplier): Observable<Supplier> {
    const currentUserEmail = this.authService.getCurrentUser();  
    const supplierData = { ...supplier, Created_by: currentUserEmail };  

    return this.http.post<Supplier>(this.apiUrl, supplierData, this.httpOptions)
      .pipe(catchError(this.handleError<Supplier>('addSupplier')));
  }

  /**
   * Update an existing supplier
   */
  updateSupplier(supplier: Supplier): Observable<Supplier> {
    const currentUserEmail = this.authService.getCurrentUser();
    const supplierData = {...supplier, Changed_by: currentUserEmail};
    
    return this.http.put<Supplier>(
      `${this.apiUrl}/${supplier.SupplierID}`, 
      supplierData, 
      this.httpOptions
    ).pipe(catchError(this.handleError<Supplier>('updateSupplier')));
  }

  /**
   * Delete a supplier
   */
  deleteSupplier(supplierID: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${supplierID}`, 
      this.httpOptions
    ).pipe(catchError(this.handleError<void>('deleteSupplier')));
  }
  
  /**
   * Search suppliers with pagination
   * Updated to match component's expected parameters and return type
   */
  searchSuppliers(query: string, page: number, limit: number): Observable<PaginationResponse<Supplier>> {
    return this.http.get<PaginationResponse<Supplier>>(
      `${this.apiUrl}/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
      this.httpOptions
    ).pipe(catchError(this.handleError<PaginationResponse<Supplier>>('searchSuppliers', {
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
    })));
  }

  /**
   * Sort suppliers with pagination
   * Updated to match the expected return type
   */
  sortSuppliers(column: string, order: 'asc' | 'desc', page: number, limit: number): Observable<PaginationResponse<Supplier>> {
    return this.http.get<PaginationResponse<Supplier>>(
      `${this.apiUrl}/sort?column=${column}&order=${order}&page=${page}&limit=${limit}`,
      this.httpOptions
    ).pipe(catchError(this.handleError<PaginationResponse<Supplier>>('sortSuppliers', {
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
    })));
  }

  /**
   * Cancel an ongoing job
   */
  cancelJob(jobId: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/cancel-job`, 
      { jobId }, 
      this.httpOptions
    ).pipe(catchError(this.handleError<any>('cancelJob')));
  }

  /**
   * Get status of a job
   */
  getJobStatus(jobId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/job-status/${jobId}`, 
      this.httpOptions
    ).pipe(catchError(this.handleError<any>('getJobStatus')));
  }

  /**
   * Check the progress of a job
   */
  checkJobProgress(jobId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/job-progress/${jobId}`, 
      this.httpOptions
    ).pipe(catchError(this.handleError<any>('checkJobProgress')));
  }

  /**
   * Handle HTTP errors
   * @private
   */
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