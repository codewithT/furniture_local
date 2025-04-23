import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DashboardDataService {
  getStats() {
    return [
      { title: 'Revenue', value: '$50K', description: 'Monthly Revenue' },
      { title: 'Users', value: '2,500', description: 'Active Users' },
      { title: 'Orders', value: '1,200', description: 'Completed Orders' }
    ];
  }
}
