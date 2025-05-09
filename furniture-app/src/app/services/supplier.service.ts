import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Supplier } from '../models/supplier.model';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  private apiUrl = `${environment.apiBaseUrl}/u/supplier`; // Backend API URL

  constructor(private http: HttpClient, private authService : AuthService) {}

 
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: true  
  };

  // Fetch all suppliers
  getSupplierDetails(): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(this.apiUrl, this.httpOptions)
      .pipe(catchError(this.handleError<Supplier[]>('getSupplierDetails', [])));
  }

  uploadExcelFile(formData: FormData): Observable<any> {
    
    return this.http.post(`${this.apiUrl}/upload-excel`, formData, {
      reportProgress: true,
      observe: 'events',
      withCredentials: true 
    },)
      .pipe(catchError(this.handleError<any>('uploadExcelFile')));
  }

  // Add a new supplier
  addSupplier(supplier: Supplier): Observable<Supplier> {
    const currentUserEmail = this.authService.getCurrentUser();  
    const supplierData = { ...supplier, Created_by: currentUserEmail };  

    return this.http.post<Supplier>(this.apiUrl, supplierData, this.httpOptions)
      .pipe(catchError(this.handleError<Supplier>('addSupplier')));
  }

  // Update an existing supplier
  updateSupplier(supplier: Supplier): Observable<Supplier> {
    const currentUserEmail = this.authService.getCurrentUser();
    console.log("Current User Email:", currentUserEmail); // Debugging line
    const supplierData = {...supplier, Changed_by : currentUserEmail};
    return this.http.put<Supplier>(`${this.apiUrl}/${supplier.SupplierID}`, supplierData, this.httpOptions)
      .pipe(catchError(this.handleError<Supplier>('updateSupplier')));
  }

  // Delete a supplier
  deleteSupplier(supplierID: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${supplierID}`, this.httpOptions)
      .pipe(catchError(this.handleError<void>('deleteSupplier')));
  }
   // Search Suppliers with Pagination
   searchSuppliers(query: string): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(
      `${this.apiUrl}/search?query=${encodeURIComponent(query)}`,
      this.httpOptions
    ).pipe(catchError(this.handleError<Supplier[]>('searchSuppliers', [])));
  }

  // Sort Suppliers with Pagination
  sortSuppliers(column: string, order: 'asc' | 'desc', page: number, limit: number): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(
      `${this.apiUrl}/sort?column=${column}&order=${order}&page=${page}&limit=${limit}`,
      this.httpOptions
    ).pipe(catchError(this.handleError<Supplier[]>('sortSuppliers', [])));
  }
  cancelJob(jobId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cancel-job`, { jobId }, this.httpOptions)
      .pipe(catchError(this.handleError<any>('cancelJob')));
  }
  // Get the status of the job
  getJobStatus(jobId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/job-status/${jobId}`, this.httpOptions)
      .pipe(catchError(this.handleError<any>('getJobStatus')));
  }
  checkJobProgress(jobId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/job-progress/${jobId}`, this.httpOptions)
      .pipe(catchError(this.handleError<any>('checkJobProgress')));
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
