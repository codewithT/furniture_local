import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { catchError, Observable } from "rxjs";

export interface DeliveryProduct {
    selected?: boolean; 
    PurchaseID: number;
    SalesID : number;
  Supplier_Date: string; // pick up date
  PONumber: string;
  ProductCode: string;
  ProductName: string;
  Customer_name: string;
  POStatus: string;
  SONumber: string;
  Qty : number;
  Payment_Status: string;
  Transfer_Date ?: string;
  Delivery_date?: Date;
  Signature?: Blob;
}

@Injectable({
  providedIn: 'root'
})

export class ScheduleDeliveryService{
    private apiUrl = `${environment.apiBaseUrl}/u/delivery`;
    constructor(private http: HttpClient) {}
    private httpOptions = {
        headers: new HttpHeaders({
            'Content-Type': 'application/json'
        }),
        withCredentials: true  
      };
    getDeliveryProducts (): Observable<DeliveryProduct[]> {
        return this.http.get<DeliveryProduct[]>(this.apiUrl, this.httpOptions)
        .pipe(catchError(this.handleError<any>('Get about to receive products ', [])));
      }
      searchDeliveryProducts (query: string): Observable<DeliveryProduct[]> {
        return this.http.get<DeliveryProduct[]>(`${this.apiUrl}/search/${encodeURIComponent(query)}`, this.httpOptions) 
        .pipe(catchError(this.handleError<any>('Search delivery products', [])));
      }
      updateTransferDate(selectedProducts: DeliveryProduct[], transferDate: string): Observable<any> {
        const payload = selectedProducts.map(product => ({
          SalesID: product.SalesID,
          transferDate: transferDate
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
      

      // schedule-delivery.service.ts
      getSignature(salesID: number): Observable<Blob> {
        const options = {
          headers: new HttpHeaders({
            'Content-Type': 'application/json'
          }),
          responseType: 'blob' as const,
          withCredentials: true   //  important for sending cookies/session
        };
        return this.http.get(`${this.apiUrl}/${salesID}`, options)
          .pipe(catchError(this.handleError<Blob>('Get Signature')));
      }
      
      
      
       // Handle HTTP errors
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      if (error.status === 404) {
        // Specific handling for "Not Found" (e.g., signature not uploaded)
        alert(`Signature not uploaded yet`);
      }else{
      alert(`${operation} failed: ${error.message}`); // Show error to user
      }
      return new Observable<T>((observer) => {
        observer.next(result as T);
        observer.complete();
      });
    };
  }


    }