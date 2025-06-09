import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatMenuModule } from '@angular/material/menu';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

import { ViewPurchasesComponent } from '../view-purchases/view-purchases.component';
import { ViewProductsReportsComponent } from '../view-products-reports/view-products-reports.component';
import { ViewSalesReportsComponent } from '../view-sales-reports/view-sales-reports.component';
import { SalesAndProductsReportsComponent } from '../view-sales-and-products-reports/view-sales-and-products-reports.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SidebarComponent,
    ViewPurchasesComponent,
    ViewProductsReportsComponent,
    ViewSalesReportsComponent,
    SalesAndProductsReportsComponent,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatSidenavModule,
    MatMenuModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  activeView: 'purchases' | 'products' | 'sales' | 'sales-products' = 'purchases';
  appliedFilters: any;
  sidenavOpen = true;
  rightSidenavOpen = true;
  isHandset$!: Observable<boolean>;

  constructor(private breakpointObserver: BreakpointObserver) {
    this.isHandset$ = this.breakpointObserver.observe(Breakpoints.Handset)
      .pipe(
        map(result => result.matches),
        shareReplay()
      );
  }

  toggleSidenav(): void {
    this.sidenavOpen = !this.sidenavOpen;
  }

  onFiltersChanged(filters: any): void {
    this.appliedFilters = filters;
  }

  onViewChanged(view: 'purchases' | 'products' | 'sales' | 'sales-products'): void {
    this.activeView = view;
  }
}
