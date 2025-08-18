import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { UtcToLocalPipe } from '../../pipes/utc-to-local.pipe';
import { DateUtilityService } from '../../services/date-utility.service';

@Component({
  selector: 'app-view-product-reports',
  imports: [CommonModule, FormsModule, UtcToLocalPipe],
  standalone: true,
  providers: [DateUtilityService],
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
    ChangedEndDate: '',
    Created_By: ''
  };

  // Timezone info for display
  timezoneInfo = {
    offset: '',
    abbreviation: '',
    name: ''
  };

  constructor(
    private dashboardService: DashboardService,
    private dateUtilityService: DateUtilityService
  ) {
    // Get timezone information for display
    this.timezoneInfo = {
      offset: this.dateUtilityService.getTimezoneOffset(),
      abbreviation: this.dateUtilityService.getTimezoneAbbreviation(),
      name: this.dateUtilityService.getTimezoneName()
    };
  }

  ngOnInit() {
    console.log('Current timezone:', this.timezoneInfo);
    console.log('Current local time:', new Date().toLocaleString());
    console.log('Current UTC time:', new Date().toISOString());
    this.loadProducts();
  }

  loadProducts() {
    this.loading = true;
    this.error = null;

    // Convert local date filters to UTC for server query
    const serverFilters = { ...this.filters };
    
    // Convert date filters to UTC if they exist
    if (serverFilters.CreatedStartDate) {
      try {
        const localDate = new Date(serverFilters.CreatedStartDate + 'T00:00:00');
        serverFilters.CreatedStartDate = localDate.toISOString().split('T')[0];
      } catch (error) {
        console.warn('Error converting CreatedStartDate:', error);
      }
    }
    
    if (serverFilters.CreatedEndDate) {
      try {
        const localDate = new Date(serverFilters.CreatedEndDate + 'T23:59:59');
        serverFilters.CreatedEndDate = localDate.toISOString().split('T')[0];
      } catch (error) {
        console.warn('Error converting CreatedEndDate:', error);
      }
    }

    if (serverFilters.ChangedStartDate) {
      try {
        const localDate = new Date(serverFilters.ChangedStartDate + 'T00:00:00');
        serverFilters.ChangedStartDate = localDate.toISOString().split('T')[0];
      } catch (error) {
        console.warn('Error converting ChangedStartDate:', error);
      }
    }
    
    if (serverFilters.ChangedEndDate) {
      try {
        const localDate = new Date(serverFilters.ChangedEndDate + 'T23:59:59');
        serverFilters.ChangedEndDate = localDate.toISOString().split('T')[0];
      } catch (error) {
        console.warn('Error converting ChangedEndDate:', error);
      }
    }

    const requestData = {
      filters: serverFilters,
      page: this.currentPage,
      pageSize: this.pageSize
    };

    console.log('Request filters:', serverFilters);

    this.dashboardService.getProductReportsData(requestData).subscribe({
      next: (response: any) => {
        if (response?.data) {
          this.products = response.data;
          
          // Enhanced debugging for date conversions
          if (this.products.length > 0) {
            const sample = this.products[0];
            console.log('=== SAMPLE PRODUCT DATA ===');
            console.log('Raw sample:', sample);
            console.log('');
            
            // Test all date fields
            const dateFields = [
              'CreatedAt', 'ChangedAt', 'created_date', 'created_time', 
              'Changed_date', 'Changed_time', 'Time_stamp'
            ];
            
            dateFields.forEach(field => {
              const rawValue = sample[field];
              if (rawValue) {
                console.log(`${field}:`);
                console.log(`  Raw: "${rawValue}"`);
                console.log(`  Formatted (datetime): "${this.dateUtilityService.formatUtcToLocal(rawValue, 'datetime')}"`);
                console.log(`  Formatted (date): "${this.dateUtilityService.formatUtcToLocal(rawValue, 'date')}"`);
                console.log(`  Formatted (time): "${this.dateUtilityService.formatUtcToLocal(rawValue, 'time')}"`);
                console.log(`  Is Valid: ${this.dateUtilityService.isValidDate(rawValue)}`);
                console.log('');
              }
            });
          }
          
          if (response.pagination) {
            this.currentPage = response.pagination.currentPage;
            this.pageSize = response.pagination.pageSize;
            this.totalPages = response.pagination.totalPages;
            this.totalRecords = response.pagination.totalRecords;
          }
        } else {
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
      ChangedEndDate: '',
      Created_By: ''
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
    exportToCsv() {
    const csvContent = this.generateCsvContent();
    this.downloadCsv(csvContent, 'products-reports.csv');
  }
  generateCsvContent(): string {
    if (!this.products.length) return '';
    
    const headers = Object.keys(this.products[0]);
    const dateFields = ['CreatedAt', 'ChangedAt', 'created_date', 'created_time', 'Changed_date', 'Changed_time', 'Time_stamp'];
    
    const csvRows = [
      headers.join(','),
      ...this.products.map(row =>
        headers.map(field => {
          let value = row[field] ?? '';
          
          // Format date fields for CSV export
          if (dateFields.includes(field) && value) {
            if (this.dateUtilityService.isValidDate(value)) {
              value = this.dateUtilityService.formatUtcToLocal(value, 'datetime');
            }
          }
          
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ];
    
    return csvRows.join('\r\n');
  }

  downloadCsv(content: string, filename: string) {
    try {
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
        URL.revokeObjectURL(url); // Clean up
      }
    } catch (error) {
      console.error('Error downloading CSV:', error);
      this.error = 'Failed to download CSV file';
    }
  }

  // Helper method to format dates in templates
  formatDate(dateString: string | null | undefined, format: 'date' | 'time' | 'datetime' | 'short' | 'medium' | 'long' = 'medium'): string {
    return this.dateUtilityService.formatUtcToLocal(dateString, format);
  }

  // Helper method to check if date is valid
  isValidDate(dateString: string | null | undefined): boolean {
    return this.dateUtilityService.isValidDate(dateString);
  }

  // Helper method to get relative time
  getRelativeTime(dateString: string | null | undefined): string {
    return this.dateUtilityService.getRelativeTime(dateString);
  }
}