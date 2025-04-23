import { AfterViewInit, Component, OnInit } from '@angular/core';
import { SalesPerMonthService } from '../../services/sales-month.service';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NgChartsModule } from 'ng2-charts';

export interface SalesBarData{
  sales : number,
  month : string
}
@Component({
  selector: 'app-sales-month',
  imports: [ MatToolbarModule, NgChartsModule],
  templateUrl: './sales-month.component.html',
  styleUrl: './sales-month.component.css'
})
export class SalesMonthComponent implements OnInit{
  salesData : SalesBarData[] = [];
    constructor(private salesPerMonthService : SalesPerMonthService){
    }
   chartData : any = {};
   chartOptions = {
    responsive: true
  };
    ngOnInit() {
      this.salesPerMonthService.getSalesPerMonth().subscribe(data => {
        const months : string[] = data.map((d => d.month));
        const sales : number[] = data.map((d => d.sales));

        this.chartData = {
          labels: months,
          datasets: [{
            label: 'Sales per Month',
            data: sales,
            backgroundColor: 'pink'
          }]
        }
      });
    }
   

}
