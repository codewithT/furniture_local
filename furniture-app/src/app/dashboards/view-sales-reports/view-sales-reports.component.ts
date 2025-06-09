import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-view-sales-reports',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './view-sales-reports.component.html',
  styleUrls: ['./view-sales-reports.component.css']
})
export class ViewSalesReportsComponent implements OnInit {
  salesReports: any[] = [];
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
  
  // Enhanced filter properties with new filters
  filters = {
    SalesID: '',
    SONumber: '',
    Customer_name: '',
    SoldToParty: '',
    ShipToParty: '',
    Customer_Contact: '',
    Payment_Status: '',
    Payment_Mode: '',
    Delivery_date: '',
    // Date range filters
    CreatedStartDate: '',  
    CreatedEndDate: '',
    DeliveryStartDate: '',
    DeliveryEndDate: '',
    // Price range filters
    PriceMin: null,
    PriceMax: null,
    // Quantity range filters
    QtyMin: null,
    QtyMax: null,
    // Total price range filters
    TotalPriceMin: null,
    TotalPriceMax: null,
    // GST range filters
    GSTMin: null,
    GSTMax: null,
    // User filters
    Created_by: '',
    Changed_by: ''
  };

  constructor(
    private dashboardService: DashboardService
  ) {}

  ngOnInit() {
    this.loadSalesReports();
  }

  loadSalesReports() {
    this.loading = true;
    this.error = null;

    // Clean up filters - remove empty values to avoid unnecessary API calls
    const cleanedFilters = this.cleanFilters(this.filters);

    const requestData = {
      filters: cleanedFilters,
      page: this.currentPage,
      pageSize: this.pageSize
    };

    this.dashboardService.getSalesReportsData(requestData).subscribe({
      next: (response: any) => {
        // Handle the response structure from the backend
        console.log('Response from backend:', response);
        if (response && response.data) {
          this.salesReports = response.data;
          
          if (response.pagination) {
            this.currentPage = response.pagination.currentPage;
            this.pageSize = response.pagination.pageSize;
            this.totalPages = response.pagination.totalPages;
            this.totalRecords = response.pagination.totalRecords;
          }
        } else {
          // Fallback for old response format (if needed during transition)
          this.salesReports = Array.isArray(response) ? response : [];
          this.totalRecords = this.salesReports.length;
          this.totalPages = 1;
        }
        
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading sales reports:', err);
        this.error = err.message || 'Failed to load sales reports data';
        this.loading = false;
      }
    });
  }

  // Helper method to clean filters - remove empty/null values
  private cleanFilters(filters: any): any {
    const cleaned: any = {};
    
    Object.keys(filters).forEach(key => {
      const value = filters[key];
      if (value !== null && value !== undefined && value !== '') {
        // For numeric values, ensure they're properly converted
        if (['PriceMin', 'PriceMax', 'QtyMin', 'QtyMax', 'TotalPriceMin', 'TotalPriceMax', 'GSTMin', 'GSTMax'].includes(key)) {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            cleaned[key] = numValue;
          }
        } else {
          cleaned[key] = value;
        }
      }
    });
    
    return cleaned;
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.loadSalesReports();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadSalesReports();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadSalesReports();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadSalesReports();
    }
  }

  // Method to apply filters
  applyFilters() {
    this.currentPage = 1;
    this.loadSalesReports();
  }

  // Method to clear all filters
  clearFilters() {
    this.filters = {
      SalesID: '',
      SONumber: '',
      Customer_name: '',
      SoldToParty: '',
      ShipToParty: '',
      Customer_Contact: '',
      Payment_Status: '',
      Payment_Mode: '',
      Delivery_date: '',
      CreatedStartDate: '',
      CreatedEndDate: '',
      DeliveryStartDate: '',
      DeliveryEndDate: '',
      PriceMin: null,
      PriceMax: null,
      QtyMin: null,
      QtyMax: null,
      TotalPriceMin: null,
      TotalPriceMax: null,
      GSTMin: null,
      GSTMax: null,
      Created_by: '',
      Changed_by: ''
    };
    this.currentPage = 1;
    this.loadSalesReports();
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
  trackBySalesId(index: number, item: any): any {
    return item.SalesID || index;
  }

  // Helper method to validate date ranges
  private validateDateRange(startDate: string, endDate: string): boolean {
    if (startDate && endDate) {
      return new Date(startDate) <= new Date(endDate);
    }
    return true;
  }

  // Helper method to validate number ranges
  private validateNumberRange(min: number | null, max: number | null): boolean {
    if (min !== null && max !== null) {
      return min <= max;
    }
    return true;
  }

  // Method to validate all filters before applying
  validateFilters(): boolean {
    // Validate date ranges
    if (!this.validateDateRange(this.filters.CreatedStartDate, this.filters.CreatedEndDate)) {
      this.error = 'Created date range is invalid';
      return false;
    }
    
    if (!this.validateDateRange(this.filters.DeliveryStartDate, this.filters.DeliveryEndDate)) {
      this.error = 'Delivery date range is invalid';
      return false;
    }

    // Validate number ranges
    if (!this.validateNumberRange(this.filters.PriceMin, this.filters.PriceMax)) {
      this.error = 'Price range is invalid';
      return false;
    }

    if (!this.validateNumberRange(this.filters.QtyMin, this.filters.QtyMax)) {
      this.error = 'Quantity range is invalid';
      return false;
    }

    if (!this.validateNumberRange(this.filters.TotalPriceMin, this.filters.TotalPriceMax)) {
      this.error = 'Total price range is invalid';
      return false;
    }

    if (!this.validateNumberRange(this.filters.GSTMin, this.filters.GSTMax)) {
      this.error = 'GST range is invalid';
      return false;
    }

    this.error = null;
    return true;
  }
}