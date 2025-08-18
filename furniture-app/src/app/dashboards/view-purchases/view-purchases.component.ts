import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { UtcToLocalPipe } from '../../pipes/utc-to-local.pipe';
import { DateUtilityService } from '../../services/date-utility.service';

@Component({
  selector: 'app-view-purchases',
  imports: [CommonModule, FormsModule, UtcToLocalPipe],
  standalone: true,
  providers: [DateUtilityService],
  templateUrl: './view-purchases.component.html',
  styleUrls: ['./view-purchases.component.css']
})
export class ViewPurchasesComponent implements OnInit {
  purchases: any[] = [];
  loading = false;
  error: string | null = null;
  showFilters = true;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalRecords = 0;
  pageSizeOptions = [10, 25, 50, 100];

  // Filters
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
    this.loadPurchases();
  }

  loadPurchases() {
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

    const requestData = {
      filters: serverFilters,
      page: this.currentPage,
      pageSize: this.pageSize
    };

    console.log('Request filters:', serverFilters);

    this.dashboardService.getPurchaseOrderData(requestData).subscribe({
      next: (response: any) => {
        if (response?.data) {
          this.purchases = response.data;
          
          // Enhanced debugging for date conversions
          if (this.purchases.length > 0) {
            const sample = this.purchases[0];
            console.log('=== SAMPLE PURCHASE DATA ===');
            console.log('Raw sample:', sample);
            console.log('');
            
            // Test all date fields
            const dateFields = [
              'CreatedAt', 'ChangedAt', 'Created_date', 'Changed_date', 
              'Time_stamp', 'Delivery_Date', 'Supplier_Date', 'Delayed_Date', 'Delivery_date'
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

  // Pagination actions
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

  // Filters
  applyFilters() {
    this.currentPage = 1;
    this.loadPurchases();
  }

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

  // Export CSV with proper date formatting
  exportToCsv() {
    const csvContent = this.generateCsvContent();
    this.downloadCsv(csvContent, 'purchase-reports.csv');
  }

  generateCsvContent() {
    if (!this.purchases.length) return '';
    
    const headers = Object.keys(this.purchases[0]);
    const dateFields = ['CreatedAt', 'ChangedAt', 'Created_date', 'Changed_date', 'Time_stamp', 'Delivery_Date', 'Supplier_Date', 'Delayed_Date', 'Delivery_date'];
    
    const csvRows = [
      headers.join(','),
      ...this.purchases.map(row =>
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

  // Helpers
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  getDisplayRange(): string {
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.totalRecords);
    return `${start}-${end} of ${this.totalRecords}`;
  }

  trackByPurchaseId(index: number, item: any): any {
    return item.PurchaseID || index;
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
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