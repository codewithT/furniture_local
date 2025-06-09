import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    FormsModule, 
    CommonModule,
    MatListModule,
    MatIconModule,
    MatDividerModule,
    MatToolbarModule,
    MatButtonModule,
    MatSidenavModule,
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Output() filtersChanged = new EventEmitter<any>();
  @Output() viewChanged = new EventEmitter<'purchases' | 'products' | 'sales' | 'sales-products'>();
  @Input() activeView: 'purchases' | 'products' | 'sales' | 'sales-products' = 'purchases';

  constructor(private router: Router) {}

  navigateToPurchases() {
    this.viewChanged.emit('purchases');
  }

  navigateToProducts() {
    this.viewChanged.emit('products');
  }
navigateToSales() {
  this.viewChanged.emit('sales');
}

navigateToSalesAndProducts() {
  this.viewChanged.emit('sales-products');
}
  isViewActive(view: 'purchases' | 'products' | 'sales' | 'sales-products'): boolean {
    return this.activeView === view;

  }
}