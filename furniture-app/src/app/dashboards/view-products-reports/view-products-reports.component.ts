import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-view-product-reports',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './view-products-reports.component.html',
  styleUrls: ['./view-products-reports.component.css']
})
export class ViewProductsReportsComponent implements OnInit {
  products: any[] = [];
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
  
  // Filter properties based on productmaster table
  filters = {
    ProductID: '',
    ProductCode: '',
    ProductName: '',
    SupplierID: '',
    SupplierItemNumber: '',
    SupplierPriceMin: '',
    SupplierPriceMax: '',
    MultiplicationFactorMin: '',
    MultiplicationFactorMax: '',
    FinalPriceMin: '',
    FinalPriceMax: '',
    CreatedStartDate: '',
    CreatedEndDate: '',
    ChangedStartDate: '',
    ChangedEndDate: ''
  };

  constructor(
    private dashboardService: DashboardService
  ) {}

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.loading = true;
    this.error = null;

    const requestData = {
      filters: this.filters,
      page: this.currentPage,
      pageSize: this.pageSize
    };

    this.dashboardService.getProductReportsData(requestData).subscribe({
      next: (response: any) => {
        console.log('Response from backend:', response);
        if (response && response.data) {
          this.products = response.data;
          
          if (response.pagination) {
            this.currentPage = response.pagination.currentPage;
            this.pageSize = response.pagination.pageSize;
            this.totalPages = response.pagination.totalPages;
            this.totalRecords = response.pagination.totalRecords;
          }
        } else {
          // Fallback for old response format
          this.products = Array.isArray(response) ? response : [];
          this.totalRecords = this.products.length;
          this.totalPages = 1;
        }
        
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.error = err.message || 'Failed to load product data';
        this.loading = false;
      }
    });
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.loadProducts();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadProducts();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadProducts();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadProducts();
    }
  }

  // Method to apply filters
  applyFilters() {
    this.currentPage = 1;
    this.loadProducts();
  }

  // Method to clear filters
  clearFilters() {
    this.filters = {
      ProductID: '',
      ProductCode: '',
      ProductName: '',
      SupplierID: '',
      SupplierItemNumber: '',
      SupplierPriceMin: '',
      SupplierPriceMax: '',
      MultiplicationFactorMin: '',
      MultiplicationFactorMax: '',
      FinalPriceMin: '',
      FinalPriceMax: '',
      CreatedStartDate: '',
      CreatedEndDate: '',
      ChangedStartDate: '',
      ChangedEndDate: ''
    };
    this.currentPage = 1;
    this.loadProducts();
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

  // Track by method for better performance
  trackByProductId(index: number, item: any): any {
    return item.ProductID || index;
  }
}