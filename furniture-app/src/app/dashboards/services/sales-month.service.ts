import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface SalesBarData{
    sales : number,
    month : string
}
@Injectable({
  providedIn: 'root'
})
export class SalesPerMonthService {

   salesPerMonthData : SalesBarData[] = [
    { sales : 500, month: 'January'},
    { sales : 250, month: 'February' },
    { sales : 650, month: 'March'}
  ];

  getSalesPerMonth() :Observable<SalesBarData[]>{
    return of(this.salesPerMonthData);
  }
}
