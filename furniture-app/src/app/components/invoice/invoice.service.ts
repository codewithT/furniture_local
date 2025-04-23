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
}