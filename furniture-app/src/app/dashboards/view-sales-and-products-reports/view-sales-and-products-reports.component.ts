import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';

// Interface for the combined report item from API
interface SalesProductReportItem {
  // Sales table fields
  SalesID: string;
  SONumber: string;
  ProductID: string;
  SupplierID: string;
  Qty: number;
  Price: number;
  GST: number;
  TotalPrice: number;
  SoldToParty: string;
  ShipToParty: string;
  CustomerEmail: string;
  InternalNote: string;
  ManualPriceChange: boolean;
  Time_stamp: string;
  Delivery_date: string;
  Payment_Status: string;
  Customer_name: string;
  Customer_Contact: string;
  Payment_Mode: string;
  Transfer_Date: string;
  Signature: string;
  SupplierCode : string;
  // Product table fields (joined)
  ProductCode: string;
  ProductName: string;
  SupplierPrice: number;
  FinalPrice: number;
}

@Component({
  selector: 'app-sales-and-products-reports',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './view-sales-and-products-reports.component.html',
  styleUrls: ['./view-sales-and-products-reports.component.css']
})
export class SalesAndProductsReportsComponent implements OnInit {
  // Data arrays
  salesProductsReports: SalesProductReportItem[] = [];
  displayedReports: SalesProductReportItem[] = [];
  
  // UI state
  loading = false;
  error: string | null = null;
  showFilters: boolean = true;
  sortField: string = 'Time_stamp';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Pagination properties
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalRecords = 0;
  pageSizeOptions = [10, 25, 50, 100];
  hasNextPage = false;
  hasPreviousPage = false;
  
  // Filter properties matching the API
  filters = {
    // Sales specific filters
    SalesID: '',
    SONumber: '',
    Customer_name: '',
    SoldToParty: '',
    Payment_Status: '',
    Payment_Mode: '',
    PriceMin: null as number | null,
    PriceMax: null as number | null,
    QtyMin: null as number | null,
    QtyMax: null as number | null,
    DeliveryStartDate: '',
    DeliveryEndDate: '',
    
    // Product specific filters
    ProductID: '',
    ProductCode: '',
    ProductName: '',
    SupplierID: '',
    SupplierPriceMin: null as number | null,
    SupplierPriceMax: null as number | null,
    FinalPriceMin: null as number | null,
    FinalPriceMax: null as number | null
  };

  // Payment status and mode options
  paymentStatusOptions = ['Full Paid', 'Pending', 'Partial'];
  paymentModeOptions = ['Debit', 'Visa', 'Cash', 'Master', 'E-transfer','cheque', 'Finance'];
  // Delivery date range

  constructor(
    private dashboardService: DashboardService
  ) {}

  ngOnInit() {
    this.loadReports();
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  loadReports() {
    this.loading = true;
    this.error = null;

    const cleanedFilters = this.cleanFilters(this.filters);
    const requestData = {
      filters: cleanedFilters,
      page: this.currentPage,
      pageSize: this.pageSize
    };

    // API call to fetch sales-products reports
    this.dashboardService.getSalesProductsReportsData(requestData).subscribe({
      next: (response: any) => {
        this.handleResponse(response);
        this.loading = false;
      },
      error: (err: any) => {
        this.handleError(err, 'sales-products reports');
      }
    });
  }

  private handleResponse(response: any) {
    console.log('Sales-Products response from backend:', response);
    
    if (response && response.success) {
      // Handle the data array from API response
      this.salesProductsReports = Array.isArray(response.data) ? response.data : [];
      this.displayedReports = [...this.salesProductsReports];
      
      // Handle pagination from response
      if (response.pagination) {
        this.currentPage = response.pagination.currentPage || 1;
        this.pageSize = response.pagination.pageSize || 10;
        this.totalPages = response.pagination.totalPages || 1;
        this.totalRecords = response.pagination.totalRecords || 0;
        this.hasNextPage = response.pagination.hasNextPage || false;
        this.hasPreviousPage = response.pagination.hasPreviousPage || false;
      }
    } else {
      // Handle error response
      this.error = response?.message || 'Failed to load data';
      this.salesProductsReports = [];
      this.displayedReports = [];
      this.resetPagination();
    }
  }

  private resetPagination() {
    this.totalRecords = 0;
    this.totalPages = 1;
    this.currentPage = 1;
    this.hasNextPage = false;
    this.hasPreviousPage = false;
  }

  private handleError(err: any, reportType: string = 'reports') {
    console.error(`Error loading ${reportType}:`, err);
    this.error = err.error?.message || err.message || `Failed to load ${reportType} data`;
    this.loading = false;
    
    // Reset data on error
    this.salesProductsReports = [];
    this.displayedReports = [];
    this.resetPagination();
  }

  // Helper method to clean filters - remove empty/null values
  private cleanFilters(filters: any): any {
    const cleaned: any = {};
    
    Object.keys(filters).forEach(key => {
      const value = filters[key];
      if (value !== null && value !== undefined && value !== '') {
        // For numeric values, ensure they're properly converted
        const numericFields = [
          'PriceMin', 'PriceMax', 'QtyMin', 'QtyMax', 
          'SupplierPriceMin', 'SupplierPriceMax', 
          'FinalPriceMin', 'FinalPriceMax'
        ];
        
        if (numericFields.includes(key)) {
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

  // Pagination methods
  onPageSizeChange() {
    this.currentPage = 1;
    this.loadReports(); // Reload with new page size
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadReports();
    }
  }

  previousPage() {
    if (this.hasPreviousPage) {
      this.currentPage--;
      this.loadReports();
    }
  }

  nextPage() {
    if (this.hasNextPage) {
      this.currentPage++;
      this.loadReports();
    }
  }

  // Method to apply filters
  applyFilters() {
    if (this.validateFilters()) {
      this.currentPage = 1;
      this.loadReports();
    }
  }

  // Method to clear all filters
  clearFilters() {
    this.filters = {
      // Sales specific filters
      SalesID: '',
      SONumber: '',
      Customer_name: '',
      SoldToParty: '',
      Payment_Status: '',
      Payment_Mode: '',
      PriceMin: null,
      PriceMax: null,
      QtyMin: null,
      QtyMax: null,
      DeliveryStartDate: '',
      DeliveryEndDate: '',
      
      // Product specific filters
      ProductID: '',
      ProductCode: '',
      ProductName: '',
      SupplierID: '',
      SupplierPriceMin: null,
      SupplierPriceMax: null,
      FinalPriceMin: null,
      FinalPriceMax: null
    };
    this.currentPage = 1;
    this.loadReports();
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
    if (this.totalRecords === 0) return '0 records';
    
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.totalRecords);
    return `${start}-${end} of ${this.totalRecords}`;
  }

  // Get summary statistics
  getSummaryStats() {
    const stats = {
      totalRecords: this.totalRecords,
      totalValue: 0,
      avgOrderValue: 0,
      totalQuantity: 0
    };

    this.salesProductsReports.forEach(report => {
      if (report.TotalPrice) {
        stats.totalValue += report.TotalPrice;
      }
      if (report.Qty) {
        stats.totalQuantity += report.Qty;
      }
    });

    if (this.salesProductsReports.length > 0) {
      stats.avgOrderValue = stats.totalValue / this.salesProductsReports.length;
    }

    return stats;
  }

  // TrackBy method for better performance
  trackByReportId(index: number, item: SalesProductReportItem): any {
    return item.SalesID || index;
  }

  // Helper methods for display
  formatCurrency(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  }

  formatDate(date: string | null | undefined): string {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString('en-IN');
    } catch {
      return date;
    }
  }

  formatDateTime(date: string | null | undefined, time: string | null | undefined): string {
    if (!date) return '-';
    try {
      const dateStr = time ? `${date} ${time}` : date;
      return new Date(dateStr).toLocaleString('en-IN');
    } catch {
      return date + (time ? ` ${time}` : '');
    }
  }

  formatNumber(num: number | null | undefined): string {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString('en-IN');
  }

  // Export functionality
  exportToCsv() {
    const csvContent = this.generateCsvContent();
    this.downloadCsv(csvContent, 'sales-products-reports.csv');
  }

  private generateCsvContent(): string {
    const headers = [
      'Sales ID', 'SO Number', 'Customer Name', 'Product Code', 'Product Name',
      'Quantity', 'Price', 'GST', 'Total Price', 'Payment Status', 'Payment Mode',
      'Supplier Price', 'Final Price', 'Delivery Date'
    ];

    const rows = this.salesProductsReports.map(report => [
      report.SalesID || '',
      report.SONumber || '',
      report.Customer_name || '',
      report.ProductCode || '',
      report.ProductName || '',
      report.Qty || 0,
      report.Price || 0,
      report.GST || 0,
      report.TotalPrice || 0,
      report.Payment_Status || '',
      report.Payment_Mode || '',
      report.SupplierPrice || 0,
      report.FinalPrice || 0,
      report.Delivery_date || '',
      report.Transfer_Date || '',
    ]);

    const csvArray = [headers, ...rows];
    return csvArray.map(row => 
      row.map(field => `"${field || ''}"`).join(',')
    ).join('\n');
  }

  private downloadCsv(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
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
    // Validate delivery date range
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

    if (!this.validateNumberRange(this.filters.SupplierPriceMin, this.filters.SupplierPriceMax)) {
      this.error = 'Supplier price range is invalid';
      return false;
    }

    if (!this.validateNumberRange(this.filters.FinalPriceMin, this.filters.FinalPriceMax)) {
      this.error = 'Final price range is invalid';
      return false;
    }

    this.error = null;
    return true;
  }

  // Refresh data
  refreshData() {
    this.loadReports();
  }
}