import { Component } from '@angular/core';

import { ChartConfiguration } from 'chart.js';
import { NgChartsConfiguration, NgChartsModule } from 'ng2-charts';

@Component({
  selector: 'app-chart-widget',
  standalone: true,
  templateUrl: './chart-widget.component.html',
  styleUrls: ['./chart-widget.component.css'],
   imports : [NgChartsModule]
})
export class ChartWidgetComponent {
  chartData = {
    labels: ['January', 'February', 'March'],
    datasets: [{ data: [10, 20, 30], label: 'Sales' }]
  };

  chartOptions = {
    responsive: true
  };
}
