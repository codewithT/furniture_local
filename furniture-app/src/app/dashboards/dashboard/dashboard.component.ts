import { Component } from '@angular/core';
import { DashboardDataService } from '../services/dashboard-data.service';
import { ChartWidgetComponent } from '../components/chart-widget/chart-widget.component';
import { TableWidgetComponent } from '../components/table-widget/table-widget.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import { SalesMonthComponent } from '../components/sales-month/sales-month.component';

@Component({
  selector: 'app-dashboard',
  imports: [ChartWidgetComponent, 
    TableWidgetComponent, 
    MatToolbarModule,
    SalesMonthComponent
  ],
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
 
export class DashboardComponent {
  stats: any = [];

  constructor(private dashboardService: DashboardDataService) {
    this.stats = this.dashboardService.getStats();
  }
  
}
