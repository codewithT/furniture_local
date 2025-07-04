import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import { HttpClient, HttpHeaders, HttpParams } from "@angular/common/http";
import { catchError, Observable } from "rxjs";

export interface DeliveryProduct {
  selected?: boolean; 
  PurchaseID: number;
  SalesID: number;
  Supplier_Date: string;
  PONumber: string;
  ProductCode: string;
  ProductName: string;
  Customer_name: string;
  SOStatus: string;
  SONumber: string;
  Qty: number;
  Payment_Status: string;
  Transfer_Date?: string | Date; // Changed to string or Date
  Delivery_date?: string | Date;
  Signature?: Blob;
  Delivery_Picture?: string;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

@Injectable({
  providedIn: 'root'
})
export class ScheduleDeliveryService {
  private apiUrl = `${environment.apiBaseUrl}/u/delivery`;
  
  constructor(private http: HttpClient) {}
  
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: true  
  };

  // Updated method to support pagination
  getDeliveryProducts(params: PaginationParams = {}): Observable<PaginatedResponse<DeliveryProduct>> {
    let httpParams = new HttpParams();
    
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params.sortOrder) httpParams = httpParams.set('sortOrder', params.sortOrder);

    const options = {
      ...this.httpOptions,
      params: httpParams
    };

    return this.http.get<PaginatedResponse<DeliveryProduct>>(this.apiUrl, options)
      .pipe(catchError(this.handleError<PaginatedResponse<DeliveryProduct>>('Get delivery products', {
        data: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalRecords: 0,
          limit: 10,
          hasNext: false,
          hasPrev: false
        }
      })));
  }

  // Updated search method to support pagination
  searchDeliveryProducts(query: string, params: PaginationParams = {}): Observable<PaginatedResponse<DeliveryProduct>> {
    let httpParams = new HttpParams();
    
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params.sortOrder) httpParams = httpParams.set('sortOrder', params.sortOrder);

    const options = {
      ...this.httpOptions,
      params: httpParams
    };

    return this.http.get<PaginatedResponse<DeliveryProduct>>(
      `${this.apiUrl}/search/${encodeURIComponent(query)}`, 
      options
    ).pipe(catchError(this.handleError<PaginatedResponse<DeliveryProduct>>('Search delivery products', {
      data: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalRecords: 0,
        limit: 10,
        hasNext: false,
        hasPrev: false
      }
    })));
  }

  // Keep existing methods unchanged
  updateTransferDate(selectedProducts: DeliveryProduct[]): Observable<any> {
    const payload = selectedProducts.map(product => ({
      SalesID: product.SalesID,
      Transfer_Date: product.Transfer_Date
    }));

    return this.http.put(`${this.apiUrl}/updateTransferDate`, payload, this.httpOptions)
      .pipe(catchError(this.handleError<any>('Update Transfer Date', [])));
  }

  uploadSignature(formData: FormData): Observable<any> {
    return this.http.put(`${this.apiUrl}/uploadSignature`, formData, {
      withCredentials: true
    }).pipe(
      catchError(this.handleError<any>('Upload Signature'))
    );
  }

  getSignature(salesID: number): Observable<Blob> {
    const options = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      }),
      responseType: 'blob' as const,
      withCredentials: true
    };
    return this.http.get(`${this.apiUrl}/${salesID}`, options)
      .pipe(catchError(this.handleError<Blob>('Get Signature')));
  }

  updateSOStatus(updateData: { salesID: number; soNumber: string; newStatus: string; }) {
    return this.http.put(`${this.apiUrl}/updateSOStatus`, updateData, this.httpOptions)
      .pipe(catchError(this.handleError<any>('Update SO Status')));
  }

  uploadDeliveryPicture(formData: FormData): Observable<any> {
    return this.http.put(`${this.apiUrl}/uploadDeliveryPicture`, formData, {
      withCredentials: true
    }).pipe(
      catchError(this.handleError<any>('Upload Delivery Picture'))
    );
  }

  // Handle HTTP errors
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      if (error.status === 404) {
        alert(`Signature not uploaded yet`);
      } else {
        alert(`${operation} failed: ${error.message}`);
      }
      return new Observable<T>((observer) => {
        observer.next(result as T);
        observer.complete();
      });
    };
  }
}