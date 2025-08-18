// invoice.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private invoiceDataSubject = new BehaviorSubject<any>(null);
  public invoiceData$: Observable<any> = this.invoiceDataSubject.asObservable();

  constructor() { }

  setInvoiceData(data: any) {
    this.invoiceDataSubject.next(data);
  }

  getInvoiceData(): Observable<any> {
    return this.invoiceData$;
  }

  // Generate new invoice for a sales order (calls backend API)
  generateNewInvoice(soNumber: string) {
    // TODO: Replace with actual HttpClient call when backend is ready
    // return this.http.post(`/api/order-details/${soNumber}/invoice`, {});
    return new Observable(observer => {
      setTimeout(() => {
        observer.next({ success: true });
        observer.complete();
      }, 1000);
    });
  }
}