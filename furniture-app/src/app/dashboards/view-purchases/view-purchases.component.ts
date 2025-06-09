import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-view-purchases',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './view-purchases.component.html',
  styleUrls: ['./view-purchases.component.css']
})
export class ViewPurchasesComponent implements OnInit {
  purchases: any[] = [];
  loading = false;
  error: string | null = null;
   showFilters: boolean = true;
  toggleFilters() {
    this.showFilters = !this.showFilters;
  }
  // Pagination properties
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalRecords = 0;
  pageSizeOptions = [10, 25, 50, 100];
  
  // Filter properties
filters = {
  PurchaseID: '',
  SONumber: '',
  Delivery_date: '',
  Supplier_Date: '',
  PONumber: '',
  POStatus: '',
  CreatedStartDate: '',  
  CreatedEndDate: ''     
};

  constructor(
    private dashboardService: DashboardService, 
    
  ) {}

  ngOnInit() {
    this.loadPurchases();
  }

  loadPurchases() {
    this.loading = true;
    this.error = null;

    const requestData = {
      filters: this.filters,
      page: this.currentPage,
      pageSize: this.pageSize
    };

    this.dashboardService.getPurchaseOrderData(requestData).subscribe({
      next: (response: any) => {
        // Handle the new response structure from the updated backend
        console.log('Response from backend:', response);
        if (response && response.data) {
          this.purchases = response.data;
          
          if (response.pagination) {
            this.currentPage = response.pagination.currentPage;
            this.pageSize = response.pagination.pageSize;
            this.totalPages = response.pagination.totalPages;
            this.totalRecords = response.pagination.totalRecords;
          }
        } else {
          // Fallback for old response format (if needed during transition)
          this.purchases = Array.isArray(response) ? response : [];
          this.totalRecords = this.purchases.length;
          this.totalPages = 1;
        }
        
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading purchases:', err);
        this.error = err.message || 'Failed to load purchase data';
        this.loading = false;
      }
    });
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.loadPurchases();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadPurchases();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadPurchases();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadPurchases();
    }
  }

  // Method to apply filters
  applyFilters() {
    this.currentPage = 1;
    this.loadPurchases();
  }

  // Method to clear filters
  clearFilters() {
    this.filters = {
      PurchaseID: '',
      SONumber: '',
      Delivery_date: '',
      Supplier_Date: '',
      PONumber: '',
      POStatus: '',
      CreatedStartDate: '',
      CreatedEndDate: ''
    };
    this.currentPage = 1;
    this.loadPurchases();
  }

  // Generate page numbers for pagination display
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  // Get display range for current page
  getDisplayRange(): string {
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.totalRecords);
    return `${start}-${end} of ${this.totalRecords}`;
  }

  // Add the trackBy method for better performance
  trackByPurchaseId(index: number, item: any): any {
    return item.PurchaseID || index;
  }
}